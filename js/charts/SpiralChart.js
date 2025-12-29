
export function renderSpiralChart(container, datasets) {
    const root = d3.select(container);
    const svg = root.select('#spiral-svg');
    const legendContainer = root.select('#spiral-legend');

    if (root.empty() || svg.empty() || !datasets.GoogleTrends) return;


    const textColor = 'var(--text-color)';
    const textMuted = 'var(--text-muted)';
    const bgColor = 'var(--background-color)';


    const WIDTH = 800;
    const HEIGHT = 800;
    const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
    const INNER_RADIUS = 50;
    const OUTER_RADIUS = 350;


    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
        .domain([0, 100]);

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


    const rawData = datasets.GoogleTrends
        .filter(d => d.Month && d['Yemen: (World)'] !== undefined)
        .map(d => {
            let year, month;
            if (d.Month instanceof Date) {
                year = d.Month.getFullYear();
                month = d.Month.getMonth() + 1;
            } else {
                [year, month] = String(d.Month).split('-').map(Number);
            }
            return {
                date: d.Month,
                year: year,
                month: month,
                interest: +d['Yemen: (World)'] || 0
            };
        })
        .filter(d => d.year >= 2004 && d.year <= 2025)
        .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });

    if (rawData.length === 0) return;

    const years = [...new Set(rawData.map(d => d.year))].sort();
    const numYears = years.length;

    const radiusScale = d3.scaleLinear()
        .domain([0, numYears - 1])
        .range([INNER_RADIUS, OUTER_RADIUS]);

    const angleScale = d3.scaleLinear()
        .domain([1, 13])
        .range([0, 2 * Math.PI]);


    svg.selectAll('*').remove();
    legendContainer.html('');

    svg.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g')
        .attr('transform', `translate(${CENTER.x}, ${CENTER.y})`);

    years.forEach((year, i) => {
        const radius = radiusScale(i);
        g.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', radius)
            .attr('fill', 'none')
            .attr('stroke', textMuted)
            .attr('stroke-opacity', 0.3)
            .attr('stroke-dasharray', '2,4');
    });

    for (let m = 1; m <= 12; m++) {
        const angle = angleScale(m) - Math.PI / 2;
        const x1 = INNER_RADIUS * Math.cos(angle);
        const y1 = INNER_RADIUS * Math.sin(angle);
        const x2 = OUTER_RADIUS * Math.cos(angle);
        const y2 = OUTER_RADIUS * Math.sin(angle);

        g.append('line')
            .attr('x1', x1).attr('y1', y1)
            .attr('x2', x2).attr('y2', y2)
            .attr('stroke', textMuted)
            .attr('stroke-opacity', 0.2);

        const labelRadius = OUTER_RADIUS + 20;
        const lx = labelRadius * Math.cos(angle);
        const ly = labelRadius * Math.sin(angle);

        g.append('text')
            .attr('x', lx)
            .attr('y', ly)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('fill', textMuted)
            .style('font-size', '11px')
            .text(MONTHS[m - 1]);
    }

    function ensureTooltip(id) {
        let el = d3.select(`#${id}`);
        if (el.empty()) el = d3.select('body').append('div').attr('id', id);
        return el.style('position', 'fixed')
            .style('pointer-events', 'none')
            .style('display', 'none')
            .style('background', 'var(--card-background)')
            .style('color', 'var(--text-color)')
            .style('padding', '10px 14px')
            .style('border', '1px solid var(--border-color)')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('z-index', 10000)
            .style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)');
    }

    const tooltip = ensureTooltip('spiral-tooltip');

    function showTooltip(event, d) {
        tooltip.html(`
            <strong>${MONTHS[d.month - 1]} ${d.year}</strong><br/>
            Interest: <span style="font-weight:bold; color:${colorScale(d.interest)}">${d.interest}</span>
        `).style('display', 'block').style('opacity', 1);
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

    const arcGenerator = d3.arc();

    rawData.forEach(d => {
        const yearIndex = years.indexOf(d.year);
        if (yearIndex === -1) return;

        const radius = radiusScale(yearIndex);
        const startAngle = angleScale(d.month) - Math.PI / 2;
        const endAngle = angleScale(d.month + 1) - Math.PI / 2;

        const thickness = 8 + yearIndex * 0.5;

        g.append('path')
            .datum(d)
            .attr('d', arcGenerator({
                innerRadius: radius - thickness / 2,
                outerRadius: radius + thickness / 2,
                startAngle: startAngle,
                endAngle: endAngle
            }))
            .attr('fill', colorScale(d.interest))
            .attr('stroke', bgColor)
            .attr('stroke-width', 0.5)
            .style('cursor', 'pointer')
            .on('mouseover', function (event, datum) {
                d3.select(this).attr('stroke', textColor).attr('stroke-width', 2);
                showTooltip(event, datum);
            })
            .on('mousemove', moveTooltip)
            .on('mouseleave', function () {
                d3.select(this).attr('stroke', bgColor).attr('stroke-width', 0.5);
                hideTooltip();
            });
    });

    years.filter((_, i) => i % 3 === 0 || i === numYears - 1).forEach((year, idx) => {
        const yearIndex = years.indexOf(year);
        const radius = radiusScale(yearIndex);
        const angle = angleScale(1) - Math.PI / 2;

        g.append('text')
            .attr('x', (radius + 15) * Math.cos(angle))
            .attr('y', (radius + 15) * Math.sin(angle))
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle')
            .style('fill', textColor)
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .text(year);
    });

    g.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('fill', textColor)
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Yemen');

    g.append('text')
        .attr('x', 0)
        .attr('y', 18)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('fill', textMuted)
        .style('font-size', '10px')
        .text('Google Trends');

    const legendWidth = 150;
    const legendHeight = 12;

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'spiral-legend-gradient')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '100%').attr('y2', '0%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', colorScale(0));
    gradient.append('stop').attr('offset', '50%').attr('stop-color', colorScale(50));
    gradient.append('stop').attr('offset', '100%').attr('stop-color', colorScale(100));

    legendContainer.style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '10px')
        .style('justify-content', 'center');

    legendContainer.append('span')
        .style('color', textMuted)
        .style('font-size', '12px')
        .text('Low Interest');

    const legendSvg = legendContainer.append('svg')
        .attr('width', legendWidth)
        .attr('height', legendHeight + 4);

    legendSvg.append('rect')
        .attr('x', 0).attr('y', 2)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', 'url(#spiral-legend-gradient)')
        .attr('rx', 3);

    legendContainer.append('span')
        .style('color', textMuted)
        .style('font-size', '12px')
        .text('High Interest');
}
