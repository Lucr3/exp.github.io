export function renderDumbbellPlot(container, datasets) {
    const root = d3.select(container);
    const svg = root.select('#dumbbell-svg');

    if (root.empty() || svg.empty() || !datasets.YouthMortality) return;

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color').trim() || '#eaeaea';
    const textMuted = style.getPropertyValue('--text-muted').trim() || '#D9D9D6';
    const cardBg = style.getPropertyValue('--card-background').trim() || '#1a1f2e';
    const bgColor = style.getPropertyValue('--background-color').trim() || '#0C1117';

    const MARGIN = { top: 60, right: 40, bottom: 60, left: 40 };
    const WIDTH = 800 - MARGIN.left - MARGIN.right;
    const HEIGHT = 400 - MARGIN.top - MARGIN.bottom;
    const COLORS = { start: '#69b3e7', improved: '#27ae60', worsened: '#e74c3c' };

    const data = datasets.YouthMortality
        .map(d => ({ year: +d['Year'], rate: +d['Under-fifteen mortality rate'] }))
        .filter(d => d.year && d.rate)
        .sort((a, b) => a.year - b.year);

    const years = data.map(d => d.year);
    const [minYear, maxYear] = [d3.min(years), d3.max(years)];

    const yearStartSelect = root.select('#year-start');
    const yearEndSelect = root.select('#year-end');

    if (!yearStartSelect.empty() && !yearEndSelect.empty()) {
        [yearStartSelect, yearEndSelect].forEach(sel => sel.selectAll('option').remove());
        years.forEach(year => {
            yearStartSelect.append('option').attr('value', year).text(year);
            yearEndSelect.append('option').attr('value', year).text(year);
        });
        yearStartSelect.property('value', years.includes(1990) ? 1990 : minYear);
        yearEndSelect.property('value', maxYear);
    }

    const tooltip = ensureTooltip('dumbbell-tooltip');

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

    function updateChart() {
        svg.selectAll('*').remove();

        const startYear = +yearStartSelect.property('value');
        const endYear = +yearEndSelect.property('value');
        const startData = data.find(d => d.year === startYear);
        const endData = data.find(d => d.year === endYear);

        if (!startData || !endData) return;

        const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

        const change = endData.rate - startData.rate;
        const improved = change < 0;
        const percentChange = Math.abs((change / startData.rate) * 100).toFixed(0);
        const accentColor = improved ? COLORS.improved : COLORS.worsened;

        const allRates = data.map(d => d.rate);
        const [minRate, maxRate] = [d3.min(allRates), d3.max(allRates)];

        const centerX = WIDTH / 2;
        const barHeight = 180;
        const yStart = 30;
        const yEnd = yStart + barHeight;

        // Gradient background
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'rate-gradient')
            .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
        gradient.append('stop').attr('offset', '0%').attr('stop-color', COLORS.worsened).attr('stop-opacity', 0.3);
        gradient.append('stop').attr('offset', '100%').attr('stop-color', COLORS.improved).attr('stop-opacity', 0.3);

        const yScale = d3.scaleLinear()
            .domain([minRate * 0.8, maxRate * 1.1])
            .range([yEnd, yStart]);

        // Background track
        g.append('rect')
            .attr('x', centerX - 30).attr('y', yStart)
            .attr('width', 60).attr('height', barHeight)
            .attr('rx', 30).attr('fill', 'url(#rate-gradient)');

        const y1 = yScale(startData.rate);
        const y2 = yScale(endData.rate);

        // Connection line with animation
        g.append('line')
            .attr('x1', centerX).attr('x2', centerX).attr('y1', y1).attr('y2', y1)
            .attr('stroke', accentColor).attr('stroke-width', 6).attr('stroke-linecap', 'round')
            .transition().duration(800).ease(d3.easeCubicOut).attr('y2', y2);

        // Arrow indicator
        const arrowY = (y1 + y2) / 2;
        const arrowDir = improved ? 1 : -1;
        g.append('path')
            .attr('d', `M${centerX - 15},${arrowY} L${centerX},${arrowY + 15 * arrowDir} L${centerX + 15},${arrowY}`)
            .attr('fill', 'none').attr('stroke', accentColor)
            .attr('stroke-width', 3).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
            .attr('opacity', 0).transition().delay(400).duration(400).attr('opacity', 1);

        // Helper for animated data dots
        function createDataDot(cy, fill, tooltip, delay = 0) {
            return g.append('circle')
                .attr('cx', centerX).attr('cy', cy).attr('r', 0)
                .attr('fill', fill).attr('stroke', bgColor).attr('stroke-width', 3)
                .style('cursor', 'pointer').style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))')
                .on('mouseenter', event => showTooltip(event, tooltip))
                .on('mouseleave', hideTooltip)
                .transition().delay(delay).duration(600).attr('r', 22);
        }

        createDataDot(y1, COLORS.start,
            `<strong style="font-size:16px">${startYear}</strong><br/>Under-15 Mortality: <span style="color:${COLORS.start};font-weight:bold">${startData.rate.toFixed(2)}%</span>`);
        createDataDot(y2, accentColor,
            `<strong style="font-size:16px">${endYear}</strong><br/>Under-15 Mortality: <span style="color:${accentColor};font-weight:bold">${endData.rate.toFixed(2)}%</span>`, 800);

        // Card positioning - avoid overlap when dots are close
        const cardHeight = 80;
        const minDistance = cardHeight + 20;
        const yDistance = Math.abs(y2 - y1);
        let startCardY = y1, endCardY = y2;

        if (yDistance < minDistance) {
            const midY = (y1 + y2) / 2;
            startCardY = midY - cardHeight / 2 - 10;
            endCardY = midY + cardHeight / 2 + 10;
        }

        const leftX = centerX - 180;
        const rightX = centerX + 180;

        // Helper for year cards
        function drawYearCard(x, cardY, dotY, year, rate, color, delay) {
            g.append('rect')
                .attr('x', x - 70).attr('y', cardY - 40)
                .attr('width', 140).attr('height', 80).attr('rx', 10)
                .attr('fill', cardBg).attr('stroke', color).attr('stroke-width', 2)
                .attr('opacity', 0).transition().delay(delay).duration(400).attr('opacity', 1);

            g.append('text')
                .attr('x', x).attr('y', cardY - 15).attr('text-anchor', 'middle')
                .style('font-size', '24px').style('font-weight', 'bold').style('fill', color)
                .text(year).attr('opacity', 0).transition().delay(delay + 100).duration(400).attr('opacity', 1);

            g.append('text')
                .attr('x', x).attr('y', cardY + 15).attr('text-anchor', 'middle')
                .style('font-size', '18px').style('font-weight', 'bold').style('fill', textColor)
                .text(`${rate.toFixed(1)}%`)
                .attr('opacity', 0).transition().delay(delay + 200).duration(400).attr('opacity', 1);

            // Connector line
            const lineX1 = x === leftX ? x + 70 : x - 70;
            const lineX2 = x === leftX ? centerX - 25 : centerX + 25;
            g.append('line')
                .attr('x1', lineX1).attr('x2', lineX2).attr('y1', cardY).attr('y2', dotY)
                .attr('stroke', color).attr('stroke-width', 1).attr('stroke-dasharray', '3,3')
                .attr('opacity', 0).transition().delay(delay + 100).duration(400).attr('opacity', 0.5);
        }

        drawYearCard(leftX, startCardY, y1, startYear, startData.rate, COLORS.start, 200);
        drawYearCard(rightX, endCardY, y2, endYear, endData.rate, accentColor, 600);

        // Bottom summary
        const summaryY = HEIGHT + 20;
        const changeSymbol = improved ? '↓' : '↑';
        const changeLabel = improved ? 'decrease' : 'increase';

        g.append('text')
            .attr('x', centerX).attr('y', summaryY).attr('text-anchor', 'middle')
            .style('font-size', '28px').style('font-weight', 'bold').style('fill', accentColor)
            .text(`${changeSymbol} ${Math.abs(change).toFixed(1)}% ${changeLabel}`)
            .attr('opacity', 0).transition().delay(1000).duration(500).attr('opacity', 1);

        g.append('text')
            .attr('x', centerX).attr('y', summaryY + 25).attr('text-anchor', 'middle')
            .style('font-size', '14px').style('fill', textMuted)
            .text(`(${percentChange}% ${improved ? 'improvement' : 'worsening'} over ${endYear - startYear} years)`)
            .attr('opacity', 0).transition().delay(1100).duration(500).attr('opacity', 1);

        // Scale labels
        g.append('text')
            .attr('x', centerX).attr('y', yStart - 10).attr('text-anchor', 'middle')
            .style('font-size', '10px').style('fill', COLORS.worsened)
            .style('text-transform', 'uppercase').style('letter-spacing', '1px')
            .text('Higher Mortality');

        g.append('text')
            .attr('x', centerX).attr('y', yEnd + 20).attr('text-anchor', 'middle')
            .style('font-size', '10px').style('fill', COLORS.improved)
            .style('text-transform', 'uppercase').style('letter-spacing', '1px')
            .text('Lower Mortality');
    }

    updateChart();
    yearStartSelect.on('change', updateChart);
    yearEndSelect.on('change', updateChart);
}
