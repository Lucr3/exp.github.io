// Grouped Bar Chart for Education Enrollment Ratios
// Dataset: primary-secondary-enrollment-completion-rates.csv
// Compares Primary, Secondary, and Tertiary enrollment for each year

export function renderGroupedBarChart(container, datasets) {
    const root = d3.select(container);
    const svg = root.select('#grouped-bar-svg');
    const legendContainer = root.select('#grouped-bar-legend');

    if (root.empty() || svg.empty() || !datasets.Education) return;

    // --- 1. Theme & Logic Setup ---
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color').trim() || '#eaeaea';
    const textMuted = style.getPropertyValue('--text-muted').trim() || '#D9D9D6';
    const gridColor = style.getPropertyValue('--border-color').trim() || '#444';

    // Colors for each education level
    const COLORS = {
        Primary: '#0173B2',    // Blue
        Secondary: '#DE8F05',  // Orange
        Tertiary: '#7570B3'    // Purple
    };

    // Standardized margins
    const MARGIN = { top: 40, right: 30, bottom: 60, left: 60 };
    const WIDTH = 960 - MARGIN.left - MARGIN.right;
    const HEIGHT = 450 - MARGIN.top - MARGIN.bottom;

    // Set viewBox
    svg.attr('viewBox', `0 0 960 450`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto');

    // --- 2. Data Processing ---
    const rawData = datasets.Education
        .filter(d => d['Gross enrolment ratio in primary education'] || 
                     d['Gross enrolment ratio in secondary education'] ||
                     d['Gross enrolment ratio in tertiary education'])
        .map(d => ({
            year: +d['Year'],
            Primary: parseFloat(d['Gross enrolment ratio in primary education']) || null,
            Secondary: parseFloat(d['Gross enrolment ratio in secondary education']) || null,
            Tertiary: parseFloat(d['Gross enrolment ratio in tertiary education']) || null
        }))
        .sort((a, b) => a.year - b.year);

    if (rawData.length === 0) return;

    const subgroups = ['Primary', 'Secondary', 'Tertiary'];
    const years = rawData.map(d => d.year);

    // --- 3. Scales ---
    const x = d3.scaleBand()
        .domain(years)
        .range([0, WIDTH])
        .padding(0.3);

    const xSubgroup = d3.scaleBand()
        .domain(subgroups)
        .range([0, x.bandwidth()])
        .padding(0.05);

    // Get max value
    const allValues = [];
    rawData.forEach(d => {
        if (d.Primary) allValues.push(d.Primary);
        if (d.Secondary) allValues.push(d.Secondary);
        if (d.Tertiary) allValues.push(d.Tertiary);
    });
    const maxValue = Math.max(...allValues);

    const y = d3.scaleLinear()
        .domain([0, maxValue * 1.15])
        .range([HEIGHT, 0]);

    const color = d3.scaleOrdinal()
        .domain(subgroups)
        .range([COLORS.Primary, COLORS.Secondary, COLORS.Tertiary]);

    // --- 4. Draw ---
    svg.selectAll('*').remove();
    if (legendContainer) legendContainer.html('');

    const g = svg.append('g')
        .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid
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

    // Create groups for each year
    const groups = g.selectAll('g.year-group')
        .data(rawData)
        .join('g')
        .attr('class', 'year-group')
        .attr('transform', d => `translate(${x(d.year)},0)`);

    // Add bars for each subgroup
    subgroups.forEach(subgroup => {
        groups.selectAll(`rect.${subgroup}`)
            .data(d => [d])
            .join('rect')
            .attr('class', subgroup)
            .attr('x', d => xSubgroup(subgroup))
            .attr('y', d => d[subgroup] ? y(d[subgroup]) : y(0))
            .attr('width', xSubgroup.bandwidth())
            .attr('height', d => d[subgroup] ? HEIGHT - y(d[subgroup]) : 0)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', color(subgroup))
            .style('opacity', 0.9)
            .on('mouseover', function(event, d) {
                d3.select(this).style('opacity', 1);
                showTooltip(event, `
                    <div style="font-family: var(--font-body); line-height: 1.6;">
                        <strong style="font-size: 14px; border-bottom: 1px solid #555; padding-bottom: 4px; display:block; margin-bottom:8px;">${d.year}</strong>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span style="width:10px; height:10px; background:${color('Primary')}; display:inline-block; margin-right:6px; border-radius:2px;"></span>
                            <span style="margin-right:12px;">Primary:</span>
                            <strong style="color:${color('Primary')}">${d.Primary ? d.Primary.toFixed(2) + '%' : 'No available data'}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span style="width:10px; height:10px; background:${color('Secondary')}; display:inline-block; margin-right:6px; border-radius:2px;"></span>
                            <span style="margin-right:12px;">Secondary:</span>
                            <strong style="color:${color('Secondary')}">${d.Secondary ? d.Secondary.toFixed(2) + '%' : 'No available data'}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="width:10px; height:10px; background:${color('Tertiary')}; display:inline-block; margin-right:6px; border-radius:2px;"></span>
                            <span style="margin-right:12px;">Tertiary:</span>
                            <strong style="color:${color('Tertiary')}">${d.Tertiary ? d.Tertiary.toFixed(2) + '%' : 'No available data'}</strong>
                        </div>
                    </div>
                `);
            })
            .on('mousemove', moveTooltip)
            .on('mouseleave', function() {
                d3.select(this).style('opacity', 0.9);
                hideTooltip();
            });
    });

    // Title
    g.append('text')
        .attr('x', WIDTH / 2)
        .attr('y', -15)
        .attr('text-anchor', 'middle')
        .style('fill', textColor)
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Education Enrollment Ratios by Level');

    // Axes
    g.append('g')
        .attr('transform', `translate(0,${HEIGHT})`)
        .call(d3.axisBottom(x).tickSize(0).tickPadding(15))
        .select('.domain').remove();

    g.selectAll('.tick text')
        .style('fill', textColor)
        .style('font-size', '13px');

    g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%').tickSize(0).tickPadding(10))
        .select('.domain').remove();

    g.selectAll('.tick text')
        .style('fill', textMuted)
        .style('font-size', '11px');

    // Legend (HTML based)
    if (legendContainer && !legendContainer.empty()) {
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
    }

    // Tooltip logic
    const tooltip = ensureTooltip('grouped-bar-tooltip');

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
