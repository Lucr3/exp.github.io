export function renderBoxPlot(container, datasets) {
  const root = d3.select(container);
  if (root.empty()) {
    console.warn('Container not found for box plot');
    return;
  }

  const svg = root.select('#boxplot-svg');
  if (svg.empty()) {
    console.warn('SVG element #boxplot-svg not found');
    return;
  }

  if (!datasets.YemenPrices) {
    console.error('Missing required dataset: YemenPrices');
    return;
  }

  const FUEL_KEYWORDS = ['diesel', 'petrol', 'benzina', 'kerosene', 'fuel', 'gas'];
  const ESSENTIAL_KEYWORDS = ['farina', 'flour', 'uova', 'eggs', 'riso', 'rice', 'fagioli', 'beans', 'pane', 'bread', 'pane', 'zucchero', 'sugar', 'sale', 'salt', 'olio', 'oil', 'latte', 'milk', 'burro', 'butter'];

  function getCommodityCategory(commodity) {
    const lower = commodity.toLowerCase();
    if (FUEL_KEYWORDS.some(kw => lower.includes(kw))) return 'fuel';
    if (ESSENTIAL_KEYWORDS.some(kw => lower.includes(kw))) return 'essential';
    return 'other';
  }

  const rootElement = document.documentElement;
  const computedStyle = getComputedStyle(rootElement);
  const textColor = computedStyle.getPropertyValue('--text-color').trim() || '#000';
  const textMuted = computedStyle.getPropertyValue('--text-muted').trim() || '#666';

  const MARGIN = { top: 40, right: 30, bottom: 60, left: 50 };
  const WIDTH = 960 - MARGIN.left - MARGIN.right;
  const HEIGHT = 500 - MARGIN.top - MARGIN.bottom;

  let allPriceData = [];

  function updateBoxPlot(filterCategory = 'all') {
    svg.selectAll('g.chart-root').remove();
    const g = svg
      .append('g')
      .attr('class', 'chart-root')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    let priceData = datasets.YemenPrices
      .map(d => ({
        commodity: d['Commodity']?.trim() || '',
        admin1: d['Admin 1']?.trim() || '',
        price: +d['Price'] || 0,
        date: d['Price Date']?.trim() || '',
        category: getCommodityCategory(d['Commodity']?.trim() || '')
      }))
      .filter(d => d.commodity && d.price > 0);

    allPriceData = priceData;

    if (filterCategory !== 'all') {
      priceData = priceData.filter(d => d.category === filterCategory);
    }

    if (priceData.length === 0) {
      g.append('text')
        .attr('x', WIDTH / 2)
        .attr('y', HEIGHT / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', textMuted)
        .text('No data available for this category');
      return;
    }

    const commoditiesMap = new Map();
    priceData.forEach(d => {
      if (!commoditiesMap.has(d.commodity)) {
        commoditiesMap.set(d.commodity, []);
      }
      commoditiesMap.get(d.commodity).push(d);
    });

    const boxplotData = Array.from(commoditiesMap.entries())
      .map(([commodity, items]) => {
        const prices = items.map(d => d.price);
        const sorted = prices.sort((a, b) => a - b);
        const q1 = d3.quantile(sorted, 0.25);
        const median = d3.quantile(sorted, 0.5);
        const q3 = d3.quantile(sorted, 0.75);
        const iqr = q3 - q1;
        const whiskerLow = Math.max(d3.min(sorted), q1 - 1.5 * iqr);
        const whiskerHigh = Math.min(d3.max(sorted), q3 + 1.5 * iqr);
        const outliers = sorted.filter(d => d < whiskerLow || d > whiskerHigh);

        return {
          commodity,
          q1,
          median,
          q3,
          whiskerLow,
          whiskerHigh,
          outliers,
          min: d3.min(sorted),
          max: d3.max(sorted),
          count: prices.length,
          rawData: items
        };
      })
      .sort((a, b) => a.commodity.localeCompare(b.commodity));

    const xScale = d3.scaleBand()
      .domain(boxplotData.map(d => d.commodity))
      .range([0, WIDTH])
      .padding(0.4);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(boxplotData, d => d.whiskerHigh) * 1.15])
      .range([HEIGHT, 0]);

    const TOOLTIP_ID = 'boxplot-tooltip';
    let tooltip = d3.select(`#${TOOLTIP_ID}`);
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div').attr('id', TOOLTIP_ID);
    }

    tooltip
      .style('position', 'fixed')
      .style('pointer-events', 'none')
      .style('display', 'none')
      .style('opacity', 0)
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', '#fff')
      .style('padding', '10px 14px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('font-family', 'sans-serif')
      .style('z-index', 10000)
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.4)');

    const showTooltip = (event, html) => {
      tooltip.html(html).style('display', 'block').style('opacity', 1);
      let x = event.clientX + 14;
      let y = event.clientY + 16;
      const rect = tooltip.node().getBoundingClientRect();
      if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 14;
      if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - 14;
      tooltip.style('left', `${x}px`).style('top', `${y}px`);
    };

    const hideTooltip = () => tooltip.style('opacity', 0).style('display', 'none');
    const formatNum = d3.format(',');

    const boxes = g.selectAll('.boxplot')
      .data(boxplotData)
      .enter()
      .append('g')
      .attr('class', 'boxplot')
      .attr('transform', d => `translate(${xScale(d.commodity) + xScale.bandwidth() / 2}, 50)`)
      .attr('opacity', 0);

    boxes.transition()
      .duration(600)
      .delay((d, i) => i * 30)
      .ease(d3.easeCubicOut)
      .attr('transform', d => `translate(${xScale(d.commodity) + xScale.bandwidth() / 2},0)`)
      .attr('opacity', 1);

    boxes.append('line')
      .attr('class', 'whisker')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', d => yScale(d.whiskerLow))
      .attr('y2', d => yScale(d.whiskerHigh))
      .attr('stroke', textColor)
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.6);

    boxes.append('line')
      .attr('x1', -8)
      .attr('x2', 8)
      .attr('y1', d => yScale(d.whiskerLow))
      .attr('y2', d => yScale(d.whiskerLow))
      .attr('stroke', textColor)
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.6);

    boxes.append('line')
      .attr('x1', -8)
      .attr('x2', 8)
      .attr('y1', d => yScale(d.whiskerHigh))
      .attr('y2', d => yScale(d.whiskerHigh))
      .attr('stroke', textColor)
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.6);

    const boxWidth = Math.min(40, xScale.bandwidth() * 0.8);
    boxes.append('rect')
      .attr('class', 'box')
      .attr('x', -boxWidth / 2)
      .attr('y', d => yScale(d.q3))
      .attr('width', boxWidth)
      .attr('height', d => Math.max(1, yScale(d.q1) - yScale(d.q3)))
      .attr('fill', '#69b3e7')
      .attr('stroke', textColor)
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('fill', '#8fc9f0').attr('stroke-width', 2);
        showTooltip(event,
          `<strong style="font-size:14px">${d.commodity}</strong><br/>` +
          `<span style="color:#e74c3c">Median: ${formatNum(Math.round(d.median))}</span><br/>` +
          `Q1: ${formatNum(Math.round(d.q1))} · Q3: ${formatNum(Math.round(d.q3))}<br/>` +
          `${d.outliers.length > 0 ? `⚠ ${d.outliers.length} outliers<br/>` : ''}` +
          `<em style="color:#888">Click for details →</em>`
        );
      })
      .on('mousemove', (event, d) => {
        showTooltip(event,
          `<strong style="font-size:14px">${d.commodity}</strong><br/>` +
          `<span style="color:#e74c3c">Median: ${formatNum(Math.round(d.median))}</span><br/>` +
          `Q1: ${formatNum(Math.round(d.q1))} · Q3: ${formatNum(Math.round(d.q3))}<br/>` +
          `<em style="color:#888">Click for details →</em>`
        );
      })
      .on('mouseleave', function () {
        d3.select(this).attr('fill', '#69b3e7').attr('stroke-width', 1);
        hideTooltip();
      })
      .on('click', (event, d) => {
        hideTooltip();
        openDetailModal(d, allPriceData);
      });

    boxes.append('line')
      .attr('class', 'median')
      .attr('x1', -boxWidth / 2)
      .attr('x2', boxWidth / 2)
      .attr('y1', d => yScale(d.median))
      .attr('y2', d => yScale(d.median))
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none');

    boxes.append('text')
      .attr('x', boxWidth / 2 + 6)
      .attr('y', d => yScale(d.median))
      .attr('dy', '0.35em')
      .style('font-size', '10px')
      .style('fill', '#e74c3c')
      .style('font-weight', 'bold')
      .text(d => formatNum(Math.round(d.median)));

    boxes.filter(d => d.outliers.length > 0)
      .append('g')
      .attr('class', 'outlier-indicator')
      .attr('transform', d => `translate(0, ${yScale(d.whiskerHigh) - 20})`)
      .each(function (d) {
        const group = d3.select(this);
        group.append('circle')
          .attr('r', 10)
          .attr('fill', '#e74c3c')
          .attr('opacity', 0.85);
        group.append('text')
          .attr('y', 3)
          .attr('text-anchor', 'middle')
          .style('font-size', '8px')
          .style('font-weight', 'bold')
          .style('fill', '#fff')
          .text(d.outliers.length);
      })
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        showTooltip(event,
          `<strong>${d.commodity}</strong><br/>` +
          `<span style="color:#e74c3c">⚠ ${d.outliers.length} outliers</span><br/>` +
          `Max: ${formatNum(Math.round(d.max))}`
        );
      })
      .on('mouseleave', hideTooltip)
      .on('click', (event, d) => {
        hideTooltip();
        openDetailModal(d, allPriceData);
      });

    boxes.append('text')
      .attr('x', 0)
      .attr('y', HEIGHT + 12)
      .attr('text-anchor', 'end')
      .attr('transform', `rotate(-35, 0, ${HEIGHT + 12})`)
      .style('font-size', '10px')
      .style('fill', textColor)
      .text(d => d.commodity.length > 15 ? d.commodity.substring(0, 15) + '…' : d.commodity);

  }

  function openDetailModal(boxData, allPriceData) {
    d3.select('#boxplot-detail-modal').remove();

    const computedStyle = getComputedStyle(document.documentElement);
    const cardBg = computedStyle.getPropertyValue('--card-background').trim() || '#1a1f2e';
    const bgColor = computedStyle.getPropertyValue('--background-color').trim() || '#0C1117';
    const textCol = computedStyle.getPropertyValue('--text-color').trim() || '#eaeaea';
    const textMut = computedStyle.getPropertyValue('--text-muted').trim() || '#D9D9D6';
    const borderCol = computedStyle.getPropertyValue('--border-color').trim() || '#3d4555';

    const modal = d3.select('body')
      .append('div')
      .attr('id', 'boxplot-detail-modal')
      .style('position', 'fixed')
      .style('top', '0')
      .style('left', '0')
      .style('width', '100%')
      .style('height', '100%')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('z-index', '10001')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('opacity', '0')
      .style('transition', 'opacity 0.2s ease');

    const modalContent = modal.append('div')
      .style('background', cardBg)
      .style('border-radius', '12px')
      .style('width', '90%')
      .style('max-width', '900px')
      .style('max-height', '85vh')
      .style('overflow', 'auto')
      .style('box-shadow', '0 20px 60px rgba(0,0,0,0.5)');

    const header = modalContent.append('div')
      .style('display', 'flex')
      .style('justify-content', 'space-between')
      .style('align-items', 'center')
      .style('padding', '16px 20px')
      .style('border-bottom', `1px solid ${borderCol}`);

    header.append('h2')
      .style('margin', '0')
      .style('color', textCol)
      .style('font-size', '1.25rem')
      .style('font-weight', '600')
      .text(boxData.commodity);

    header.append('button')
      .style('background', 'transparent')
      .style('border', 'none')
      .style('color', textMut)
      .style('font-size', '24px')
      .style('cursor', 'pointer')
      .style('padding', '0')
      .style('line-height', '1')
      .html('×')
      .on('click', closeModal)
      .on('mouseenter', function () { d3.select(this).style('color', '#e74c3c'); })
      .on('mouseleave', function () { d3.select(this).style('color', textMut); });

    const formatNum = d3.format(',');
    const statsBar = modalContent.append('div')
      .style('display', 'flex')
      .style('gap', '24px')
      .style('padding', '12px 20px')
      .style('background', bgColor)
      .style('border-bottom', `1px solid ${borderCol}`)
      .style('flex-wrap', 'wrap');

    const stats = [
      { label: 'Median', value: formatNum(Math.round(boxData.median)), color: '#e74c3c' },
      { label: 'Q1–Q3', value: `${formatNum(Math.round(boxData.q1))} – ${formatNum(Math.round(boxData.q3))}`, color: '#69b3e7' },
      { label: 'Range', value: `${formatNum(Math.round(boxData.whiskerLow))} – ${formatNum(Math.round(boxData.whiskerHigh))}`, color: textMut },
      { label: 'Outliers', value: boxData.outliers.length, color: boxData.outliers.length > 0 ? '#e74c3c' : textMut },
      { label: 'N', value: formatNum(boxData.count), color: textMut }
    ];

    stats.forEach(stat => {
      statsBar.append('div')
        .style('font-size', '12px')
        .html(`<span style="color:${textMut}">${stat.label}:</span> <strong style="color:${stat.color}">${stat.value}</strong>`);
    });

    const chartsContainer = modalContent.append('div')
      .style('padding', '16px');

    const commodityData = allPriceData.filter(d => d.commodity === boxData.commodity);

    const boxPanel = chartsContainer.append('div')
      .style('background', bgColor)
      .style('border-radius', '8px')
      .style('padding', '16px');

    boxPanel.append('div')
      .style('font-size', '11px')
      .style('color', textMut)
      .style('margin-bottom', '12px')
      .style('text-transform', 'uppercase')
      .style('letter-spacing', '0.5px')
      .text('Price Distribution');

    const boxSvg = boxPanel.append('svg')
      .attr('width', '100%')
      .attr('viewBox', '0 0 800 220');

    renderCombinedChart(boxSvg, boxData, commodityData, textCol, textMut);

    requestAnimationFrame(() => modal.style('opacity', '1'));

    modal.on('click', (event) => {
      if (event.target === modal.node()) closeModal();
    });

    document.addEventListener('keydown', handleEscape);

    function handleEscape(e) {
      if (e.key === 'Escape') closeModal();
    }

    function closeModal() {
      document.removeEventListener('keydown', handleEscape);
      modal.style('opacity', '0');
      setTimeout(() => modal.remove(), 200);
    }
  }

  function renderCombinedChart(svg, data, rawData, textCol, textMut) {
    const margin = { top: 20, right: 30, bottom: 35, left: 55 };
    const width = 800 - margin.left - margin.right;
    const height = 220 - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    const prices = rawData.map(d => d.price);

    const xScale = d3.scaleLinear()
      .domain([d3.min(prices) * 0.9, d3.max(prices) * 1.05])
      .range([0, width]);

    const histogram = d3.histogram()
      .value(d => d)
      .domain(xScale.domain())
      .thresholds(xScale.ticks(15));

    const bins = histogram(prices);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length)])
      .range([height, 0]);

    const HIST_TOOLTIP_ID = 'histogram-tooltip';
    let histTooltip = d3.select(`#${HIST_TOOLTIP_ID}`);
    if (histTooltip.empty()) {
      histTooltip = d3.select('body').append('div').attr('id', HIST_TOOLTIP_ID);
    }
    histTooltip
      .style('position', 'fixed')
      .style('pointer-events', 'none')
      .style('display', 'none')
      .style('opacity', 0)
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', '#fff')
      .style('padding', '10px 14px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('font-family', 'sans-serif')
      .style('z-index', 10002)
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.4)');

    const formatNum = d3.format(',');

    const isOutlierBin = (bin) => bin.x1 <= data.whiskerLow || bin.x0 >= data.whiskerHigh;
    const getBarColor = (bin) => isOutlierBin(bin) ? '#e74c3c' : '#69b3e7';
    const getBarHoverColor = (bin) => isOutlierBin(bin) ? '#f5756a' : '#8fc9f0';

    g.selectAll('.bar')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.x0) + 1)
      .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 2))
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', d => getBarColor(d))
      .attr('opacity', 0.7)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('fill', getBarHoverColor(d));
        const isOutlier = isOutlierBin(d);
        histTooltip
          .html(
            `<strong>Range: ${formatNum(Math.round(d.x0))} – ${formatNum(Math.round(d.x1))}</strong><br/>` +
            `Count: <span style="color:${getBarColor(d)};font-weight:bold">${d.length}</span>` +
            (isOutlier ? '<br/><span style="color:#e74c3c">⚠ Outlier range</span>' : '')
          )
          .style('display', 'block')
          .style('opacity', 1);
        let x = event.clientX + 14;
        let y = event.clientY - 40;
        const rect = histTooltip.node().getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 14;
        if (y < 8) y = event.clientY + 20;
        histTooltip.style('left', `${x}px`).style('top', `${y}px`);
      })
      .on('mousemove', function (event, d) {
        let x = event.clientX + 14;
        let y = event.clientY - 40;
        const rect = histTooltip.node().getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 14;
        if (y < 8) y = event.clientY + 20;
        histTooltip.style('left', `${x}px`).style('top', `${y}px`);
      })
      .on('mouseleave', function (event, d) {
        d3.select(this).attr('opacity', 0.7).attr('fill', getBarColor(d));
        histTooltip.style('opacity', 0).style('display', 'none');
      })
      .transition()
      .duration(750)
      .ease(d3.easeBackOut.overshoot(0.7))
      .attr('y', d => yScale(d.length))
      .attr('height', d => height - yScale(d.length));

    g.append('line')
      .attr('x1', xScale(data.median))
      .attr('x2', xScale(data.median))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.8);

    g.append('text')
      .attr('x', xScale(data.median) + 6)
      .attr('y', 12)
      .style('font-size', '10px')
      .style('fill', '#e74c3c')
      .style('font-weight', 'bold')
      .text(`Median: ${formatNum(Math.round(data.median))}`);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format(',')))
      .call(g => g.select('.domain').remove())
      .style('font-size', '10px')
      .style('color', textMut);

    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', textMut)
      .text('Price (YER)');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-width))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line')
        .attr('stroke', textMut)
        .attr('stroke-opacity', 0.2)
        .attr('stroke-dasharray', '2,2')) 
      .style('font-size', '10px')
      .style('color', textMut);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', textMut)
      .text('Frequency');
  }

  function renderTemporalChart(svg, data, textCol, textMut) {
    const margin = { top: 15, right: 15, bottom: 25, left: 45 };
    const width = 380 - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse('%Y-%m-%d');
    const monthlyData = d3.rollups(
      data.filter(d => d.date),
      v => d3.mean(v, d => d.price),
      d => {
        const date = parseDate(d.date);
        return date ? d3.timeMonth(date).toISOString() : null;
      }
    )
      .filter(d => d[0] !== null)
      .map(([key, value]) => ({ date: new Date(key), price: value }))
      .sort((a, b) => a.date - b.date);

    if (monthlyData.length < 2) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', textMut)
        .style('font-size', '11px')
        .text('Insufficient temporal data');
      return;
    }

    const xScale = d3.scaleTime()
      .domain(d3.extent(monthlyData, d => d.date))
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(monthlyData, d => d.price) * 1.1])
      .range([height, 0]);

    const area = d3.area()
      .x(d => xScale(d.date))
      .y0(height)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(monthlyData)
      .attr('d', area)
      .attr('fill', 'rgba(105, 179, 231, 0.2)');

    const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(monthlyData)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#69b3e7')
      .attr('stroke-width', 2);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(4).tickFormat(d3.timeFormat('%b %y')))
      .style('font-size', '9px')
      .style('color', textMut);

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(d3.format(',s')))
      .style('font-size', '9px')
      .style('color', textMut);
  }

  updateBoxPlot('all');

  const filterSelect = root.select('#commodity-filter');
  if (!filterSelect.empty()) {
    filterSelect.on('change', function () {
      updateBoxPlot(this.value);
    });
  }
}
