export function renderDumbbellPlot(container, datasets) {
    const root = d3.select(container);
    const svg = root.select('#dumbbell-svg');

    if (root.empty() || svg.empty() || !datasets.YouthMortality) return;

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color').trim() || '#eaeaea';
    const textMuted = style.getPropertyValue('--text-muted').trim() || '#D9D9D6';
    const cardBg = style.getPropertyValue('--card-background').trim() || '#1a1f2e';
    const bgColor = style.getPropertyValue('--background-color').trim() || '#0C1117';

    const MARGIN = { top: 40, right: 60, bottom: 100, left: 60 };
    const WIDTH = 900 - MARGIN.left - MARGIN.right;
    const HEIGHT = 500 - MARGIN.top - MARGIN.bottom;
    const COLORS = { start: '#0173B2', improved: '#7570B3', worsened: '#DE8F05', neutral: '#999999' };

    const data = datasets.YouthMortality
        .map(d => ({ year: +d['Year'], rate: +d['Under-fifteen mortality rate'] }))
        .filter(d => d.year && d.rate)
        .sort((a, b) => a.year - b.year);

    // Filter data from 1950 to 2025
    const filteredData = data.filter(d => d.year >= 1950 && d.year <= 2025);
    
    if (filteredData.length === 0) return;

    const startData = filteredData[0];
    const endData = filteredData[filteredData.length - 1];

    const allRates = filteredData.map(d => d.rate);
    const [minRate, maxRate] = [d3.min(allRates), d3.max(allRates)];

    const tooltip = ensureTooltip('slope-tooltip');

    function ensureTooltip(id) {
        let el = d3.select(`#${id}`);
        if (el.empty()) el = d3.select('body').append('div').attr('id', id);
        return el.style('position', 'fixed')
            .style('pointer-events', 'none')
            .style('display', 'none')
            .style('background', 'rgba(0,0,0,0.9)')
            .style('color', '#fff')
            .style('padding', '12px 16px')
            .style('border-radius', '8px')
            .style('font-size', '13px')
            .style('z-index', 10000)
            .style('box-shadow', '0 4px 20px rgba(0,0,0,0.5)');
    }

    function showTooltip(event, html) {
        tooltip.html(html).style('display', 'block').style('opacity', 1);
        const rect = tooltip.node().getBoundingClientRect();
        let x = event.clientX + 14, y = event.clientY + 16;
        if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 14;
        if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - 14;
        tooltip.style('left', `${x}px`).style('top', `${y}px`);
    }

    const hideTooltip = () => tooltip.style('opacity', 0).style('display', 'none');

    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
    const yScale = d3.scaleLinear()
        .domain([minRate * 0.85, maxRate * 1.05])
        .range([HEIGHT, 0]);

    const xScale = d3.scaleLinear()
        .domain([startData.year, endData.year])
        .range([0, WIDTH]);

    // Define tick values first (before using them in grid)
    const tickValues = d3.ticks(minRate * 0.85, maxRate * 1.05, 5);
    if (!tickValues.includes(0) && 0 >= minRate * 0.85 && 0 <= maxRate * 1.05) {
        tickValues.push(0);
        tickValues.sort((a, b) => a - b);
    }

    // Background grid
    g.append('g')
        .attr('class', 'grid')
        .style('stroke', '#444')
        .style('stroke-opacity', 0.1)
        .call(d3.axisLeft(yScale)
            .tickSize(-WIDTH)
            .tickFormat('')
            .tickValues(tickValues)
        );

    // Zero line indicator - stylish if zero is visible
    const zeroY = yScale(0);
    if (zeroY >= 0 && zeroY <= HEIGHT) {
        g.append('line')
            .attr('x1', 0).attr('x2', WIDTH).attr('y1', zeroY).attr('y2', zeroY)
            .attr('stroke', textColor).attr('stroke-width', 1).attr('stroke-dasharray', '6,3')
            .attr('opacity', 0.4)
            .style('pointer-events', 'none');
        
        g.append('text')
            .attr('x', -15).attr('y', zeroY - 8).attr('text-anchor', 'end')
            .style('font-size', '9px').style('fill', textMuted).style('font-style', 'italic')
            .style('alignment-baseline', 'middle')
            .text('0%');
    }

    // Left axis (year 1950) - ensure 0 is included in ticks
    g.append('g')
        .attr('class', 'axis')
        .style('fill', textColor)
        .style('font-size', '12px')
        .call(d3.axisLeft(yScale).tickValues(tickValues).tickFormat(d => d.toFixed(0)));

    // Right axis (year 2025)
    g.append('g')
        .attr('transform', `translate(${WIDTH},0)`)
        .style('fill', textColor)
        .style('font-size', '12px')
        .call(d3.axisRight(yScale).tickValues(tickValues).tickFormat(d => d.toFixed(0)));

    // Year labels
    g.append('text')
        .attr('x', -30).attr('y', -10)
        .style('font-size', '14px').style('font-weight', 'bold').style('fill', textColor)
        .style('text-anchor', 'middle')
        .text(startData.year);

    g.append('text')
        .attr('x', WIDTH + 30).attr('y', -10)
        .style('font-size', '14px').style('font-weight', 'bold').style('fill', textColor)
        .style('text-anchor', 'middle')
        .text(endData.year);

    // Draw connecting lines (slope chart) - color based on mortality rate
    for (let i = 0; i < filteredData.length - 1; i++) {
        const current = filteredData[i];
        const next = filteredData[i + 1];
        
        // Color based on mortality rate (average of current and next)
        const avgRate = (current.rate + next.rate) / 2;
        const progress = (avgRate - minRate) / (maxRate - minRate);
        const color = d3.interpolate(COLORS.start, COLORS.worsened)(progress);
        
        const x1 = xScale(current.year);
        const y1 = yScale(current.rate);
        const x2 = xScale(next.year);
        const y2 = yScale(next.rate);

        g.append('line')
            .attr('x1', x1).attr('y1', y1)
            .attr('x2', x2).attr('y2', y2)
            .attr('stroke', color).attr('stroke-width', 2.5).attr('opacity', 1)
            .style('pointer-events', 'none');
    }

    // Add vertical line for interaction
    const verticalLine = g.append('line')
        .attr('class', 'vertical-line')
        .attr('y1', 0).attr('y2', HEIGHT)
        .attr('stroke', textColor).attr('stroke-width', 1.5)
        .attr('opacity', 0)
        .style('pointer-events', 'none');

    // Add interactive overlay
    g.append('rect')
        .attr('width', WIDTH).attr('height', HEIGHT)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mousemove', (event) => {
            const [mouseX] = d3.pointer(event);
            const year = Math.round(xScale.invert(mouseX));
            const dataPoint = filteredData.find(d => d.year === year);
            
            if (dataPoint) {
                verticalLine
                    .attr('x1', xScale(year))
                    .attr('x2', xScale(year))
                    .attr('opacity', 0.6);
                
                showTooltip(event,
                    `<strong>${dataPoint.year}</strong><br/>Under-15 Mortality: <span style="font-weight:bold">${dataPoint.rate.toFixed(2)}%</span>`);
            }
        })
        .on('mouseleave', () => {
            verticalLine.attr('opacity', 0);
            hideTooltip();
        });

    // Add color scale legend at the bottom

    // Add color scale legend at the bottom
    const legendX = WIDTH / 2 - 100;
    const legendY = HEIGHT + 30;
    const legendWidth = 150;
    
    // Create color scale gradient (inverted)
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'color-scale-gradient')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '100%').attr('y2', '0%');
    
    gradient.append('stop').attr('offset', '0%').attr('stop-color', COLORS.worsened);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', COLORS.start);
    
    // Max value label (left)
    g.append('text')
        .attr('x', legendX - 10).attr('y', legendY + 20)
        .style('font-size', '11px').style('fill', textColor)
        .style('text-anchor', 'end')
        .text(`${maxRate.toFixed(1)}%`);
    
    // Legend background rectangle (gradient)
    g.append('rect')
        .attr('x', legendX).attr('y', legendY)
        .attr('width', legendWidth).attr('height', 15)
        .attr('fill', 'url(#color-scale-gradient)')
        .attr('stroke', textMuted).attr('stroke-width', 1);
    
    // Min value label (right)
    g.append('text')
        .attr('x', legendX + legendWidth + 10).attr('y', legendY + 20)
        .style('font-size', '11px').style('fill', textColor)
        .style('text-anchor', 'start')
        .text(`${minRate.toFixed(1)}%`);
}
