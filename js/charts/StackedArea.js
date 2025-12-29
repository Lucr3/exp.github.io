export function renderStackedArea(container, datasets) {
    const root = d3.select(container);
    const svg = root.select('#stacked-area-svg');

    if (root.empty() || svg.empty() || !datasets.BirthsDeaths) return;

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color').trim() || '#eaeaea';
    const textMuted = style.getPropertyValue('--text-muted').trim() || '#D9D9D6';

    const MARGIN = { top: 30, right: 30, bottom: 50, left: 70 };
    const WIDTH = 960 - MARGIN.left - MARGIN.right;
    const HEIGHT = 450 - MARGIN.top - MARGIN.bottom;
    const CURRENT_YEAR = 2026;
    const COLORS = { births: '#69b3e7', deaths: '#e74c3c', positive: '#27ae60' };

    const data = datasets.BirthsDeaths
        .map(d => {
            const year = +d['Year'];
            const deaths = +(d['Deaths - Sex: all - Age: all - Variant: estimates'] ||
                d['Deaths - Sex: all - Age: all - Variant: medium'] || 0);
            const births = +(d['Births - Sex: all - Age: all - Variant: estimates'] ||
                d['Births - Sex: all - Age: all - Variant: medium'] || 0);
            const isProjection = !d['Deaths - Sex: all - Age: all - Variant: estimates'];
            return { year, deaths, births, isProjection };
        })
        .filter(d => d.year && (d.deaths || d.births) && d.year <= 2030)
        .sort((a, b) => a.year - b.year);

    const fullDomain = d3.extent(data, d => d.year);
    let currentDomain = [...fullDomain];

    const tooltip = ensureTooltip('stacked-area-tooltip');
    const formatNum = d3.format(',');

    function ensureTooltip(id) {
        let el = d3.select(`#${id}`);
        if (el.empty()) el = d3.select('body').append('div').attr('id', id);
        return el.style('position', 'fixed')
            .style('pointer-events', 'none')
            .style('display', 'none')
            .style('background', 'rgba(0,0,0,0.9)')
            .style('color', '#fff')
            .style('padding', '10px 14px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('z-index', 10000)
            .style('box-shadow', '0 4px 12px rgba(0,0,0,0.4)');
    }

    function positionTooltip(event) {
        const rect = tooltip.node().getBoundingClientRect();
        let x = event.clientX + 14;
        let y = event.clientY - 60;
        if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 14;
        if (y < 8) y = event.clientY + 20;
        tooltip.style('left', `${x}px`).style('top', `${y}px`);
    }

    function drawPath(parent, pathData, generator, color, opts = {}) {
        const { isLine = false, dashed = false, opacity = 1 } = opts;
        const path = parent.append('path')
            .datum(pathData)
            .attr('d', generator)
            .attr('fill', isLine ? 'none' : color)
            .attr('opacity', opacity);

        if (isLine) {
            path.attr('stroke', color).attr('stroke-width', dashed ? 1.5 : 2);
            if (dashed) path.attr('stroke-dasharray', '5,3');
        }
        return path;
    }

    function renderChart(domain) {
        svg.selectAll('*').remove();

        const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

        svg.append('defs').append('clipPath').attr('id', 'clip-area')
            .append('rect').attr('width', WIDTH).attr('height', HEIGHT);

        const chartArea = g.append('g').attr('clip-path', 'url(#clip-area)');

        const xScale = d3.scaleLinear().domain(domain).range([0, WIDTH]);
        const filteredData = data.filter(d => d.year >= domain[0] && d.year <= domain[1]);
        const maxValue = d3.max(filteredData, d => Math.max(d.births, d.deaths));
        const yScale = d3.scaleLinear().domain([0, maxValue * 1.1]).range([HEIGHT, 0]);

        const historical = filteredData.filter(d => !d.isProjection);
        const projected = filteredData.filter(d => d.isProjection);

        const makeAreaGen = key => d3.area()
            .x(d => xScale(d.year))
            .y0(HEIGHT)
            .y1(d => yScale(d[key]))
            .curve(d3.curveMonotoneX);

        const makeLineGen = key => d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d[key]))
            .curve(d3.curveMonotoneX);

        const birthsArea = makeAreaGen('births');
        const deathsArea = makeAreaGen('deaths');
        const birthsLine = makeLineGen('births');
        const deathsLine = makeLineGen('deaths');


        if (historical.length) {
            drawPath(chartArea, historical, birthsArea, COLORS.births, { opacity: 0.6 });
            drawPath(chartArea, historical, deathsArea, COLORS.deaths, { opacity: 0.6 });
            drawPath(chartArea, historical, birthsLine, COLORS.births, { isLine: true });
            drawPath(chartArea, historical, deathsLine, COLORS.deaths, { isLine: true });
        }


        if (projected.length) {
            const bridgeData = historical.length ? [historical.at(-1), ...projected] : projected;
            drawPath(chartArea, bridgeData, birthsArea, COLORS.births, { opacity: 0.3 });
            drawPath(chartArea, bridgeData, deathsArea, COLORS.deaths, { opacity: 0.3 });
            drawPath(chartArea, bridgeData, birthsLine, COLORS.births, { isLine: true, dashed: true, opacity: 0.7 });
            drawPath(chartArea, bridgeData, deathsLine, COLORS.deaths, { isLine: true, dashed: true, opacity: 0.7 });
        }


        if (CURRENT_YEAR >= domain[0] && CURRENT_YEAR <= domain[1]) {
            g.append('line')
                .attr('x1', xScale(CURRENT_YEAR)).attr('x2', xScale(CURRENT_YEAR))
                .attr('y1', 0).attr('y2', HEIGHT)
                .attr('stroke', textColor).attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '6,4').attr('opacity', 0.5);

            g.append('text')
                .attr('x', xScale(CURRENT_YEAR) + 5).attr('y', 15)
                .style('font-size', '10px').style('fill', textMuted)
                .text('2024');
        }


        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const labelColor = isDark ? '#ffffff' : '#1a1a1a';
        const yearRange = domain[1] - domain[0];
        const yearStep = yearRange <= 30 ? 5 : yearRange <= 60 ? 10 : 25;

        for (let year = Math.ceil(domain[0] / yearStep) * yearStep; year <= domain[1]; year += yearStep) {
            g.append('text')
                .attr('x', xScale(year)).attr('y', HEIGHT + 25)
                .attr('text-anchor', 'middle')
                .style('font-size', '14px').style('font-weight', '600').style('fill', labelColor)
                .text(year);
        }


        const brush = d3.brushX()
            .extent([[0, 0], [WIDTH, HEIGHT]])
            .on('end', event => {
                if (!event.selection) return;
                const [x0, x1] = event.selection;
                const newDomain = [Math.round(xScale.invert(x0)), Math.round(xScale.invert(x1))];

                if (newDomain[1] - newDomain[0] >= 5) {
                    currentDomain = newDomain;
                    renderChart(currentDomain);
                } else {
                    g.select('.brush').call(brush.move, null);
                }
            });

        g.append('g').attr('class', 'brush').call(brush);
        g.select('.brush .selection')
            .attr('fill', COLORS.births).attr('fill-opacity', 0.3)
            .attr('stroke', COLORS.births).attr('stroke-width', 1);


        const hoverLine = g.append('line')
            .attr('stroke', textColor).attr('stroke-width', 1).attr('stroke-dasharray', '3,2')
            .attr('y1', 0).attr('y2', HEIGHT)
            .style('opacity', 0).style('pointer-events', 'none');

        const createDot = color => g.append('circle')
            .attr('r', 5).attr('fill', color)
            .attr('stroke', textColor).attr('stroke-width', 2)
            .style('opacity', 0).style('pointer-events', 'none');

        const birthsDot = createDot(COLORS.births);
        const deathsDot = createDot(COLORS.deaths);

        g.select('.brush .overlay')
            .on('mousemove', event => {
                const [mx] = d3.pointer(event);
                const year = Math.round(xScale.invert(mx));
                const d = data.find(item => item.year === year);

                if (d && year >= domain[0] && year <= domain[1]) {
                    hoverLine.attr('x1', xScale(year)).attr('x2', xScale(year)).style('opacity', 0.5);
                    birthsDot.attr('cx', xScale(year)).attr('cy', yScale(d.births)).style('opacity', 1);
                    deathsDot.attr('cx', xScale(year)).attr('cy', yScale(d.deaths)).style('opacity', 1);

                    const net = d.births - d.deaths;
                    const netColor = net > 0 ? COLORS.positive : COLORS.deaths;
                    tooltip.html(
                        `<strong>${year}</strong>${d.isProjection ? '<br/><span style="color:#888;font-style:italic">(Projected)</span>' : ''}<br/>` +
                        `<span style="color:${COLORS.births}">Births:</span> <strong>${formatNum(d.births)}</strong><br/>` +
                        `<span style="color:${COLORS.deaths}">Deaths:</span> <strong>${formatNum(d.deaths)}</strong><br/>` +
                        `<span style="color:${netColor}">Net: ${net > 0 ? '+' : ''}${formatNum(net)}</span>`
                    ).style('display', 'block').style('opacity', 1);
                    positionTooltip(event);
                }
            })
            .on('mouseleave', () => {
                hoverLine.style('opacity', 0);
                birthsDot.style('opacity', 0);
                deathsDot.style('opacity', 0);
                tooltip.style('opacity', 0).style('display', 'none');
            })
            .on('dblclick', () => {
                currentDomain = [...fullDomain];
                renderChart(currentDomain);
            });


        const isZoomed = domain[0] !== fullDomain[0] || domain[1] !== fullDomain[1];
        if (isZoomed) {
            g.append('rect')
                .attr('x', WIDTH - 80).attr('y', 5).attr('width', 75).attr('height', 24)
                .attr('rx', 4).attr('fill', COLORS.births).attr('cursor', 'pointer')
                .on('click', () => { currentDomain = [...fullDomain]; renderChart(currentDomain); });

            g.append('text')
                .attr('x', WIDTH - 42).attr('y', 21).attr('text-anchor', 'middle')
                .style('font-size', '11px').style('fill', '#fff')
                .style('font-weight', 'bold').style('pointer-events', 'none')
                .text('Reset Zoom');
        } else {
            g.append('text')
                .attr('x', WIDTH / 2).attr('y', -10).attr('text-anchor', 'middle')
                .style('font-size', '11px').style('fill', textMuted).style('font-style', 'italic')
                .text('Drag to select a time range to zoom • Double-click to reset');
        }
    }

    renderChart(currentDomain);
}
