export function renderHistogram(container, datasets) {
    const root = d3.select(container);
    const svg = root.select('#histogram-svg');
    const legendContainer = root.select('#histogram-legend');

    if (root.empty() || svg.empty() || !datasets.GoogleTrends) {
        console.warn('Histogram: Container or SVG not found, or no GoogleTrends data');
        return;
    }

    if (!Array.isArray(datasets.GoogleTrends) || datasets.GoogleTrends.length === 0) {
        console.warn('Histogram: No GoogleTrends data available');
        return;
    }

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color').trim() || '#eaeaea';
    const textMuted = style.getPropertyValue('--text-muted').trim() || '#D9D9D6';
    const gridColor = style.getPropertyValue('--border-color').trim() || '#444';

    const barColor = '#0173B2';

    const MARGIN = { top: 40, right: 30, bottom: 60, left: 60 };
    const WIDTH = 960 - MARGIN.left - MARGIN.right;
    const HEIGHT = 450 - MARGIN.top - MARGIN.bottom;

    svg.attr('viewBox', `0 0 960 450`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto')
        .style('min-height', '450px')
        .style('background', 'transparent');

    const rawData = datasets.GoogleTrends
        .filter(d => d && d['Yemen: (World)'] !== undefined && d['Yemen: (World)'] !== null)
        .map(d => {
            const value = parseFloat(d['Yemen: (World)']);
            return value;
        })
        .filter(d => !isNaN(d) && d > 0);

    console.log('Histogram: Loaded', rawData.length, 'data points');

    if (rawData.length === 0) {
        console.warn('Histogram: No valid data points after filtering');
        return;
    }

    const binSize = 10;
    const bins = d3.bin()
        .domain([0, 100])
        .thresholds(d3.range(0, 101, binSize))(rawData);

    const histogramData = bins.map(bin => ({
        x0: bin.x0,
        x1: bin.x1,
        length: bin.length,
        label: `${bin.x0}-${bin.x1}`
    })).filter(d => d.length > 0);

    console.log('Histogram: Created', histogramData.length, 'bins');

    if (histogramData.length === 0) {
        console.warn('Histogram: No histogram bins created');
        return;
    }

    const x = d3.scaleBand()
        .domain(histogramData.map(d => d.label))
        .range([0, WIDTH])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(histogramData, d => d.length) * 1.15])
        .range([HEIGHT, 0]);

    svg.selectAll('*').remove();
    if (legendContainer) legendContainer.html('');

    const g = svg.append('g')
        .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(y)
            .tickSize(-WIDTH)
            .tickFormat('')
            .ticks(5)
        )
        .style('stroke', gridColor)
        .style('stroke-opacity', 0.1)
        .style('stroke-dasharray', '3,3')
        .select('.domain').remove();

    let selectedBar = null;

    g.append('rect')
        .attr('class', 'background-click-area')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', WIDTH)
        .attr('height', HEIGHT)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('click', function (event) {
            if (event.target === this) {
                resetAllBars();
            }
        });

    const bars = g.selectAll('rect.bar')
        .data(histogramData)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.label))
        .attr('y', HEIGHT)
        .attr('width', x.bandwidth())
        .attr('height', 0)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill', barColor)
        .style('opacity', 0.9)
        .style('cursor', 'pointer')
        .transition()
        .duration(800)
        .delay((d, i) => i * 80)
        .ease(d3.easeBackOut.overshoot(0.3))
        .attr('y', d => y(d.length))
        .attr('height', d => HEIGHT - y(d.length));

    g.selectAll('rect.bar')
        .on('mouseover', function (event, d) {
            if (selectedBar === null) {
                d3.select(this).style('opacity', 1);
            }
            showTooltip(event, `
                <div style="font-family: var(--font-body); line-height: 1.6;">
                    <strong style="font-size: 14px; border-bottom: 1px solid #555; padding-bottom: 4px; display:block; margin-bottom:8px;">Range: ${d.label}</strong>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="margin-right:12px;">Frequency:</span>
                        <strong style="color:${barColor}">${d.length}</strong>
                    </div>
                </div>
            `);
        })
        .on('mousemove', moveTooltip)
        .on('mouseleave', function () {
            if (selectedBar === null) {
                d3.select(this).style('opacity', 0.9);
            }
            hideTooltip();
        })
        .on('click', function (event, d) {
            event.stopPropagation();
            const clickedLabel = d.label;
            
            if (selectedBar === clickedLabel) {
                resetAllBars();
            } else {
                selectedBar = clickedLabel;
                
                g.selectAll('rect.bar')
                    .transition()
                    .duration(300)
                    .style('opacity', d => d.label === clickedLabel ? 0 : 0.2)
                    .attr('y', d => d.label === clickedLabel ? HEIGHT : y(d.length))
                    .attr('height', d => d.label === clickedLabel ? 0 : HEIGHT - y(d.length));
                
                setTimeout(() => {
                    g.selectAll('rect.bar')
                        .filter(d => d.label === clickedLabel)
                        .transition()
                        .duration(500)
                        .ease(d3.easeBackOut.overshoot(0.5))
                        .attr('y', d => y(d.length))
                        .attr('height', d => HEIGHT - y(d.length))
                        .style('opacity', 1);
                }, 300);
            }
        });

    function resetAllBars() {
        if (selectedBar === null) return;
        
        selectedBar = null;
        
        g.selectAll('rect.bar')
            .transition()
            .duration(200)
            .attr('y', HEIGHT)
            .attr('height', 0)
            .style('opacity', 0);
        
        setTimeout(() => {
            g.selectAll('rect.bar')
                .transition()
                .duration(800)
                .delay((d, i) => i * 80)
                .ease(d3.easeBackOut.overshoot(0.3))
                .attr('y', d => y(d.length))
                .attr('height', d => HEIGHT - y(d.length))
                .style('opacity', 0.9);
        }, 200);
    }

    g.append('text')
        .attr('x', WIDTH / 2)
        .attr('y', -15)
        .attr('text-anchor', 'middle')
        .style('fill', textColor)
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Google Trends Interest Distribution (0-100)');

    g.append('g')
        .attr('transform', `translate(0,${HEIGHT})`)
        .call(d3.axisBottom(x).tickSize(0).tickPadding(15))
        .select('.domain').remove();

    g.selectAll('.tick text')
        .style('fill', textColor)
        .style('font-size', '13px');

    g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d).tickSize(0).tickPadding(10))
        .select('.domain').remove();

    g.selectAll('.tick text')
        .style('fill', textMuted)
        .style('font-size', '11px');

    g.append('text')
        .attr('x', WIDTH / 2)
        .attr('y', HEIGHT + MARGIN.bottom - 10)
        .attr('text-anchor', 'middle')
        .style('fill', textMuted)
        .style('font-size', '12px')
        .text('Interest Score Range');

    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -HEIGHT / 2)
        .attr('y', -MARGIN.left + 15)
        .attr('text-anchor', 'middle')
        .style('fill', textMuted)
        .style('font-size', '12px')
        .text('Frequency');

    const tooltip = ensureTooltip('histogram-tooltip');

    function ensureTooltip(id) {
        let el = d3.select(`#${id}`);
        if (el.empty()) el = d3.select('body').append('div').attr('id', id);
        return el.style('position', 'fixed')
            .style('pointer-events', 'none')
            .style('display', 'none')
            .style('background', 'var(--card-background)')
            .style('color', 'var(--text-color)')
            .style('padding', '12px')
            .style('border', '1px solid var(--border-color)')
            .style('border-radius', '6px')
            .style('font-size', '13px')
            .style('z-index', 10000)
            .style('box-shadow', '0 4px 20px rgba(0,0,0,0.2)');
    }

    function showTooltip(event, html) {
        tooltip.html(html).style('display', 'block').style('opacity', 1);
        moveTooltip(event);
    }

    function moveTooltip(event) {
        const rect = tooltip.node().getBoundingClientRect();
        let x = event.clientX + 14;
        let y = event.clientY + 14;
        if (x + rect.width > window.innerWidth - 20) x = event.clientX - rect.width - 14;
        if (y + rect.height > window.innerHeight - 20) y = event.clientY - rect.height - 14;
        tooltip.style('left', `${x}px`).style('top', `${y}px`);
    }

    function hideTooltip() {
        tooltip.style('opacity', 0).style('display', 'none');
    }
}
