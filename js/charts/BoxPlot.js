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

  // Commodity categorization
  const FUEL_KEYWORDS = ['diesel', 'petrol', 'benzina', 'kerosene', 'fuel', 'gas'];
  const ESSENTIAL_KEYWORDS = ['farina', 'flour', 'uova', 'eggs', 'riso', 'rice', 'fagioli', 'beans', 'pane', 'bread', 'pane', 'zucchero', 'sugar', 'sale', 'salt', 'olio', 'oil', 'latte', 'milk', 'burro', 'butter'];

  function getCommodityCategory(commodity) {
    const lower = commodity.toLowerCase();
    if (FUEL_KEYWORDS.some(kw => lower.includes(kw))) return 'fuel';
    if (ESSENTIAL_KEYWORDS.some(kw => lower.includes(kw))) return 'essential';
    return 'other';
  }

  // Get CSS variables for theme colors
  const rootElement = document.documentElement;
  const computedStyle = getComputedStyle(rootElement);
  const textColor = computedStyle.getPropertyValue('--text-color').trim() || '#000';
  const textMuted = computedStyle.getPropertyValue('--text-muted').trim() || '#666';

  const MARGIN = { top: 30, right: 40, bottom: 50, left: 50 };
  const WIDTH = 960 - MARGIN.left - MARGIN.right;
  const HEIGHT = 500 - MARGIN.top - MARGIN.bottom;

  // Function to render the boxplot with filtered data
  function updateBoxPlot(filterCategory = 'all') {
    svg.selectAll('g.chart-root').remove();
    const g = svg
      .append('g')
      .attr('class', 'chart-root')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Parse data
    let priceData = datasets.YemenPrices
      .map(d => ({
        commodity: d['Commodity']?.trim() || '',
        admin1: d['Admin 1']?.trim() || '',
        price: +d['Price'] || 0,
        date: d['Price Date']?.trim() || '',
        category: getCommodityCategory(d['Commodity']?.trim() || '')
      }))
      .filter(d => d.commodity && d.price > 0);

    // Apply filter
    if (filterCategory !== 'all') {
      priceData = priceData.filter(d => d.category === filterCategory);
    }

    if (priceData.length === 0) {
      console.error('No valid price data found');
      g.append('text')
        .attr('x', WIDTH / 2)
        .attr('y', HEIGHT / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', textMuted)
        .text('Nessun dato disponibile per questa categoria');
      return;
    }

    // Group by commodity
    const commoditiesMap = new Map();
    priceData.forEach(d => {
      if (!commoditiesMap.has(d.commodity)) {
        commoditiesMap.set(d.commodity, []);
      }
      commoditiesMap.get(d.commodity).push(d.price);
    });

    // Calculate quartiles for each commodity
    const boxplotData = Array.from(commoditiesMap.entries())
      .map(([commodity, prices]) => {
        const sorted = prices.sort((a, b) => a - b);
        const q1 = d3.quantile(sorted, 0.25);
        const median = d3.quantile(sorted, 0.5);
        const q3 = d3.quantile(sorted, 0.75);
        const iqr = q3 - q1;
        const whiskerLow = Math.max(d3.min(sorted), q1 - 1.5 * iqr);
        const whiskerHigh = Math.min(d3.max(sorted), q3 + 1.5 * iqr);

        // Identify outliers
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
          count: prices.length
        };
      })
      .sort((a, b) => a.commodity.localeCompare(b.commodity));

    // Scales
    const xScale = d3.scaleBand()
      .domain(boxplotData.map(d => d.commodity))
      .range([0, WIDTH])
      .padding(0.3);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(boxplotData, d => d.max)])
      .range([HEIGHT, 0]);

    // Y-axis label (price unit indicator)
    g.append('text')
      .attr('x', -HEIGHT / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', textMuted)
      .style('font-style', 'italic')
      .text('YER/KG');

    // Tooltip
    const TOOLTIP_ID = 'boxplot-tooltip';
    let tooltip = d3.select(`#${TOOLTIP_ID}`);
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div').attr('id', TOOLTIP_ID);
    }

    tooltip
      .classed('chart-tooltip', true)
      .style('position', 'fixed')
      .style('pointer-events', 'none')
      .style('display', 'none')
      .style('opacity', 0)
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('font-family', 'sans-serif')
      .style('z-index', 10000)
      .style('white-space', 'nowrap')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.3)');

    const showTooltip = (event, html) => {
      tooltip
        .html(html)
        .style('display', 'block')
        .style('opacity', 1);

      let x = event.clientX + 14;
      let y = event.clientY + 16;

      const rect = tooltip.node().getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (x + rect.width > vw - 8) {
        x = event.clientX - rect.width - 14;
      }
      if (y + rect.height > vh - 8) {
        y = event.clientY - rect.height - 14;
      }

      tooltip.style('left', `${x}px`).style('top', `${y}px`);
    };

    const hideTooltip = () => {
      tooltip.style('opacity', 0).style('display', 'none');
    };

    const formatNum = d3.format(',');

    // Draw boxplots
    const boxes = g.selectAll('.boxplot')
      .data(boxplotData)
      .enter()
      .append('g')
      .attr('class', 'boxplot')
      .attr('transform', d => `translate(${xScale(d.commodity) + xScale.bandwidth() / 2},0)`);

    // Commodity label below box
    boxes.append('text')
      .attr('x', 0)
      .attr('y', HEIGHT + 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', textColor)
      .text(d => d.commodity);

    // Whiskers (lines)
    boxes.append('line')
      .attr('class', 'whisker')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', d => yScale(d.whiskerLow))
      .attr('y2', d => yScale(d.whiskerHigh))
      .attr('stroke', textColor)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        showTooltip(
          event,
          `<strong>${d.commodity}</strong><br/>` +
          `Min Whisker: ${formatNum(Math.round(d.whiskerLow))}<br/>` +
          `Max Whisker: ${formatNum(Math.round(d.whiskerHigh))}<br/>` +
          `Data Points: ${d.count}`
        );
      })
      .on('mousemove', (event, d) => {
        showTooltip(
          event,
          `<strong>${d.commodity}</strong><br/>` +
          `Min Whisker: ${formatNum(Math.round(d.whiskerLow))}<br/>` +
          `Max Whisker: ${formatNum(Math.round(d.whiskerHigh))}`
        );
      })
      .on('mouseleave', hideTooltip);

    // Box (IQR)
    boxes.append('rect')
      .attr('class', 'box')
      .attr('x', -25)
      .attr('y', d => yScale(d.q3))
      .attr('width', 50)
      .attr('height', d => yScale(d.q1) - yScale(d.q3))
      .attr('fill', '#69b3e7')
      .attr('stroke', textColor)
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        showTooltip(
          event,
          `<strong>${d.commodity}</strong><br/>` +
          `Q1: ${formatNum(Math.round(d.q1))}<br/>` +
          `Q3: ${formatNum(Math.round(d.q3))}<br/>` +
          `IQR: ${formatNum(Math.round(d.q3 - d.q1))}`
        );
      })
      .on('mousemove', (event, d) => {
        showTooltip(
          event,
          `<strong>${d.commodity}</strong><br/>` +
          `Q1: ${formatNum(Math.round(d.q1))}<br/>` +
          `Q3: ${formatNum(Math.round(d.q3))}`
        );
      })
      .on('mouseleave', hideTooltip);

    // Median line
    boxes.append('line')
      .attr('class', 'median')
      .attr('x1', -25)
      .attr('x2', 25)
      .attr('y1', d => yScale(d.median))
      .attr('y2', d => yScale(d.median))
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2.5)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        showTooltip(
          event,
          `<strong>${d.commodity}</strong><br/>` +
          `Mediana: ${formatNum(Math.round(d.median))}`
        );
      })
      .on('mousemove', (event, d) => {
        showTooltip(
          event,
          `<strong>${d.commodity}</strong><br/>` +
          `Mediana: ${formatNum(Math.round(d.median))}`
        );
      })
      .on('mouseleave', hideTooltip);

    // Outliers
    boxes.selectAll('.outlier')
      .data(d => d.outliers.map(price => ({ commodity: d.commodity, price })))
      .enter()
      .append('circle')
      .attr('class', 'outlier')
      .attr('cx', 0)
      .attr('cy', d => yScale(d.price))
      .attr('r', 3)
      .attr('fill', '#e74c3c')
      .attr('opacity', 0.6)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        showTooltip(
          event,
          `<strong>${d.commodity}</strong><br/>` +
          `Outlier: ${formatNum(Math.round(d.price))}`
        );
      })
      .on('mousemove', (event, d) => {
        showTooltip(
          event,
          `<strong>${d.commodity}</strong><br/>` +
          `Outlier: ${formatNum(Math.round(d.price))}`
        );
      })
      .on('mouseleave', hideTooltip);

    // Value labels on the plot
    boxes.append('text')
      .attr('x', 35)
      .attr('y', d => yScale(d.median))
      .attr('dy', '-0.5em')
      .style('font-size', '10px')
      .style('fill', '#e74c3c')
      .style('font-weight', 'bold')
      .text(d => `${formatNum(Math.round(d.median))}`);

    boxes.append('text')
      .attr('x', -35)
      .attr('y', d => yScale(d.q1))
      .attr('dy', '-0.3em')
      .style('font-size', '9px')
      .style('fill', textMuted)
      .text(d => `Q1: ${formatNum(Math.round(d.q1))}`);

    boxes.append('text')
      .attr('x', -35)
      .attr('y', d => yScale(d.q3))
      .attr('dy', '1.2em')
      .style('font-size', '9px')
      .style('fill', textMuted)
      .text(d => `Q3: ${formatNum(Math.round(d.q3))}`);

    boxes.append('text')
      .attr('x', 0)
      .attr('y', d => yScale(d.whiskerLow))
      .attr('dy', '1.2em')
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('fill', textMuted)
      .text(d => `${formatNum(Math.round(d.whiskerLow))}`);

    boxes.append('text')
      .attr('x', 0)
      .attr('y', d => yScale(d.whiskerHigh))
      .attr('dy', '-0.4em')
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('fill', textMuted)
      .text(d => `${formatNum(Math.round(d.whiskerHigh))}`);
  }

  // Initial render
  updateBoxPlot('all');

  // Event listener for filter changes
  const filterSelect = root.select('#commodity-filter');
  if (!filterSelect.empty()) {
    filterSelect.on('change', function() {
      updateBoxPlot(this.value);
    });
  }
}
