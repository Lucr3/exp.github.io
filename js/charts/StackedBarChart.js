

export function renderStackedBarChart(container, datasets) {
    const root = d3.select(container);
    const svg = root.select('#stacked-bar-svg');
    const legendContainer = root.select('#stacked-bar-legend');

    if (root.empty() || svg.empty() || !datasets.Education) return;

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color').trim() || '#eaeaea';
    const textMuted = style.getPropertyValue('--text-muted').trim() || '#D9D9D6';
    const gridColor = style.getPropertyValue('--border-color').trim() || '#444';

    const COLORS = {
        Completed: '#0173B2',
        Incomplete: '#DE8F05'
    };

    const MARGIN = { top: 40, right: 30, bottom: 60, left: 60 };
    const WIDTH = 960 - MARGIN.left - MARGIN.right;
    const HEIGHT = 450 - MARGIN.top - MARGIN.bottom;

    svg.attr('viewBox', `0 0 960 450`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto');

    const rawData = datasets.Education.filter(d =>
        d.Entity === 'Yemen' &&
        d['Completion rate, primary education, both sexes (%), CR.1']
    );

    const data = rawData.map(d => {
        const completed = +d['Completion rate, primary education, both sexes (%), CR.1'];
        return {
            year: +d.Year,
            Completed: completed,
            Incomplete: 100 - completed
        };
    }).sort((a, b) => a.year - b.year);

    if (data.length === 0) return;

    const subgroups = ['Completed', 'Incomplete'];
    const years = data.map(d => d.year);

    const x = d3.scaleBand()
        .domain(years)
        .range([0, WIDTH])
        .padding(0.4);

    const y = d3.scaleLinear()
        .domain([0, 100])
        .range([HEIGHT, 0]);

    const color = d3.scaleOrdinal()
        .domain(subgroups)
        .range([COLORS.Completed, COLORS.Incomplete]);

    svg.selectAll('*').remove();
    legendContainer.html('');

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

    const stackedData = d3.stack()
        .keys(subgroups)
        (data);


    const layers = g.append('g')
        .selectAll('g')
        .data(stackedData)
        .join('g')
        .attr('fill', d => color(d.key));


    layers.selectAll('rect')
        .data(d => d)
        .join('rect')
        .attr('x', d => x(d.data.year))
        .attr('y', d => y(d[1]))
        .attr('height', d => y(d[0]) - y(d[1]))
        .attr('width', x.bandwidth())
        .attr('rx', 2)
        .attr('ry', 2)
        .style('opacity', 0.9)
        .on('mouseover', function (event, d) {
            d3.select(this).style('opacity', 1);
            const subgroupName = d3.select(this.parentNode).datum().key;
            const value = d.data[subgroupName];
            showTooltip(event, `
                <div style="font-family: var(--font-body); line-height: 1.4;">
                    <strong style="font-size: 14px; border-bottom: 1px solid #555; padding-bottom: 4px; display:block; margin-bottom:4px;">${d.data.year}</strong>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="width:10px; height:10px; background:${color(subgroupName)}; display:inline-block; margin-right:6px; border-radius:2px;"></span>
                        <span style="margin-right:8px;">${subgroupName}:</span>
                        <strong style="color:${color(subgroupName)}">${value.toFixed(1)}%</strong>
                    </div>
                </div>
            `);
        })
        .on('mousemove', moveTooltip)
        .on('mouseleave', function () {
            d3.select(this).style('opacity', 0.9);
            hideTooltip();
        });

    g.append('g')
        .attr('transform', `translate(0,${HEIGHT})`)
        .call(d3.axisBottom(x).tickSize(0).tickPadding(15))
        .select('.domain').remove();

    g.selectAll('.tick text')
        .style('fill', textColor)
        .style('font-size', '13px')
        .style('font-family', 'var(--font-body)');

    g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%').tickSize(0).tickPadding(10))
        .select('.domain').remove();

    g.selectAll('.tick text')
        .style('fill', textMuted)
        .style('font-size', '11px');


    stackedData.forEach(layer => {
        g.selectAll(`.label-${layer.key}`)
            .data(layer)
            .join('text')
            .filter(d => (y(d[0]) - y(d[1])) > 25)
            .attr('x', d => x(d.data.year) + x.bandwidth() / 2)
            .attr('y', d => y(d[1]) + (y(d[0]) - y(d[1])) / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('fill', '#fff')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('pointer-events', 'none')

            .style('text-shadow', '0px 1px 3px rgba(0,0,0,0.5)')
            .text(d => {
                const val = d[1] - d[0];
                return val.toFixed(0) + '%';
            });
    });

    g.append('text')
        .attr('x', WIDTH / 2)
        .attr('y', -15)
        .attr('text-anchor', 'middle')
        .style('fill', textColor)
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Primary Education Completion Rate (Yemen)');


    subgroups.forEach(key => {
        const item = legendContainer.append('div')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '6px');

        item.append('span')
            .style('width', '16px')
            .style('height', '16px')
            .style('background', color(key))
            .style('border-radius', '3px');

        item.append('span')
            .style('color', 'var(--text-color)')
            .style('font-size', '13px')
            .text(key);
    });


    const tooltip = ensureTooltip('stacked-tooltip');

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
