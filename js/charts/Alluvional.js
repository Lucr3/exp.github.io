export function renderAlluvional(container, datasets) {
    const root = d3.select(container);
    const svg = root.select('#alluvial-svg');
    const yearStartSelect = root.select('#alluvial-year-start');
    const yearEndSelect = root.select('#alluvial-year-end');

    if (svg.empty()) return;

    const rawData = datasets.Natural_Disasters;
    const allYears = [...new Set(rawData.map(d => +d['Start Year']).filter(y => y && y > 1900))].sort((a, b) => a - b);
    const YEAR_MIN = 2014;
    const YEAR_MAX = allYears[allYears.length - 1] || 2025;

    const getTextColor = () => {
        const theme = document.documentElement.getAttribute('data-theme');
        return theme === 'dark' ? '#e0e0e0' : '#333333';
    };

    const tooltip = d3.select('#alluvial-tooltip').empty()
        ? d3.select('body').append('div').attr('id', 'alluvial-tooltip')
        : d3.select('#alluvial-tooltip');

    tooltip
        .classed('chart-tooltip', true)
        .style('position', 'fixed')
        .style('pointer-events', 'none')
        .style('display', 'none')
        .style('opacity', 0)
        .style('background', 'rgba(0, 0, 0, 0.95)')
        .style('color', '#fff')
        .style('padding', '12px 16px')
        .style('border-radius', '8px')
        .style('font-size', '13px')
        .style('font-family', 'Roboto Slab, serif')
        .style('z-index', 10000)
        .style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)')
        .style('max-width', '320px');

    const showTooltip = (event, content) => {
        tooltip.style('display', 'block').style('opacity', 1).html(content);
        let x = event.clientX + 15;
        let y = event.clientY + 15;
        const rect = tooltip.node().getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 15;
        if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - 15;
        tooltip.style('left', x + 'px').style('top', y + 'px');
    };

    const hideTooltip = () => tooltip.style('display', 'none').style('opacity', 0);

    const updateYearOptions = (selectElement, years, setDefault = null) => {
        selectElement.selectAll('option').remove();
        selectElement.selectAll('option')
            .data(years)
            .enter()
            .append('option')
            .attr('value', d => d)
            .text(d => d);
        if (setDefault !== null) selectElement.property('value', setDefault);
    };

    const syncYearSelectors = () => {
        const startVal = +yearStartSelect.property('value');
        const endVal = +yearEndSelect.property('value');
        updateYearOptions(yearEndSelect, allYears.filter(y => y >= startVal), endVal >= startVal ? endVal : allYears[allYears.length - 1]);
    };

    updateYearOptions(yearStartSelect, allYears, YEAR_MIN);
    updateYearOptions(yearEndSelect, allYears, YEAR_MAX);

    yearStartSelect.on('change', () => {
        syncYearSelectors();
        updateChart();
    });
    yearEndSelect.on('change', () => {
        const endVal = +yearEndSelect.property('value');
        updateYearOptions(yearStartSelect, allYears.filter(y => y <= endVal), +yearStartSelect.property('value'));
        updateChart();
    });

    const truncateLabel = (text, maxLength) => {
        if (!text) return '';
        if (text.toLowerCase().startsWith('explosion')) return text;
        return text.replace(/\s*\([^)]*\)\s*/g, '').trim();
    };

    const drawChart = (yearStart, yearEnd) => {
        svg.selectAll('*').remove();

        const margin = { top: 40, right: 200, bottom: 40, left: 200 };
        const containerNode = root.node();
        const containerWidth = containerNode ? Math.max(800, Math.round(containerNode.getBoundingClientRect().width)) : 1200;
        const fullWidth = containerWidth;
        const fullHeight = Math.max(500, Math.round(fullWidth * 0.55));

        svg.attr('viewBox', `0 0 ${fullWidth} ${fullHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .attr('width', '100%')
            .style('max-width', '100%')
            .style('height', 'auto');

        const data = rawData.filter(d => {
            const year = +d['Start Year'];
            return year >= yearStart && year <= yearEnd;
        });

        if (data.length === 0) {
            svg.append('text')
                .attr('x', fullWidth / 2)
                .attr('y', fullHeight / 2)
                .attr('text-anchor', 'middle')
                .attr('font-size', '16px')
                .attr('fill', getTextColor())
                .text('No data available for this year range');
            return;
        }

        const flowCounts = new Map();
        const eventsByPath = new Map();
        const eventCounts = new Map();

        data.forEach(d => {
            const group = d['Disaster Group'] || 'Unknown';
            const subgroup = d['Disaster Subgroup'] || 'Unknown';
            const type = d['Disaster Type'] || 'Unknown';
            const subtype = d['Disaster Subtype'] || 'Unknown';
            const eventName = d['Event Name'] || 'Others';

            if (group === 'Unknown' || type === 'Unknown') return;

            const key = `${group}|${subgroup}|${type}|${subtype}`;
            flowCounts.set(key, (flowCounts.get(key) || 0) + 1);

            if (!eventsByPath.has(key)) eventsByPath.set(key, []);
            eventsByPath.get(key).push({ name: eventName, year: d['Start Year'] });
            eventCounts.set(eventName, (eventCounts.get(eventName) || 0) + 1);
        });

        const nodesMap = new Map();
        const links = [];
        const getNodeId = (level, name) => `${level}_${name}`;

        flowCounts.forEach((count, key) => {
            const [group, subgroup, type, subtype] = key.split('|');
            const subgroupId = getNodeId('subgroup', subgroup);
            const typeId = getNodeId('type', type);
            const subtypeId = getNodeId('subtype', subtype);

            if (!nodesMap.has(subgroupId)) nodesMap.set(subgroupId, { id: subgroupId, name: subgroup, level: 0 });
            if (!nodesMap.has(typeId)) nodesMap.set(typeId, { id: typeId, name: type, level: 1 });
            if (!nodesMap.has(subtypeId)) nodesMap.set(subtypeId, { id: subtypeId, name: subtype, level: 2 });

            const events = eventsByPath.get(key) || [];
            const uniqueEventNames = [...new Set(events.map(e => e.name))];

            uniqueEventNames.forEach(eventName => {
                const eventId = getNodeId('event', eventName);
                if (!nodesMap.has(eventId)) {
                    const eventCount = eventCounts.get(eventName) || 1;
                    nodesMap.set(eventId, { id: eventId, name: eventName, level: 3, value: eventCount });
                }
                const eventCountInPath = events.filter(e => e.name === eventName).length;
                links.push({ source: subtypeId, target: eventId, value: eventCountInPath });
            });

            links.push({ source: subgroupId, target: typeId, value: count });
            links.push({ source: typeId, target: subtypeId, value: count });
        });

        const linkMap = new Map();
        links.forEach(link => {
            const key = `${link.source}|${link.target}`;
            if (linkMap.has(key)) {
                linkMap.get(key).value += link.value;
            } else {
                linkMap.set(key, { ...link });
            }
        });

        const nodes = Array.from(nodesMap.values());
        const aggregatedLinks = Array.from(linkMap.values());

        const paletteColors = ['#4A90E2', '#7B5BA6', '#C0392B', '#E67E22', '#F39C12'];
        const uniqueSubgroups = [...new Set(nodes.filter(n => n.level === 0).map(n => n.name))].sort();
        const subgroupColorMap = {};
        uniqueSubgroups.forEach((subgroup, idx) => {
            subgroupColorMap[subgroup] = idx < paletteColors.length ? paletteColors[idx] : '#5A7FA6';
        });

        const sankey = d3.sankey()
            .nodeId(d => d.id)
            .nodeWidth(20)
            .nodePadding(14)
            .nodeAlign(d3.sankeyLeft)
            .extent([[margin.left, margin.top], [fullWidth - margin.right, fullHeight - margin.bottom]]);

        const sankeyData = sankey({
            nodes: nodes.map(d => ({ ...d })),
            links: aggregatedLinks.map(d => ({ ...d }))
        });

        const clipId = 'alluvial-clip-' + Math.random().toString(36).substr(2, 9);
        svg.append('defs').append('clipPath')
            .attr('id', clipId)
            .append('rect')
            .attr('x', 0).attr('y', 0).attr('width', 0).attr('height', fullHeight)
            .transition().duration(600).ease(d3.easeQuadOut).attr('width', fullWidth);

        const g = svg.append('g').attr('clip-path', `url(#${clipId})`);

        const getLinkColor = (link) => {
            let current = link.source;
            while (current && current.level > 0) {
                const parent = sankeyData.links.find(l => l.target.id === current.id);
                if (parent) current = parent.source;
                else break;
            }
            return current && current.level === 0 ? subgroupColorMap[current.name] : '#5A7FA6';
        };

        const getNodeColor = (node) => {
            if (node.level === 0) return subgroupColorMap[node.name];
            if (node.level === 1) {
                const parentLink = sankeyData.links.find(l => l.target.id === node.id && l.source.level === 0);
                return parentLink ? subgroupColorMap[parentLink.source.name] : '#5A7FA6';
            }

            let typeLink;
            if (node.level === 2) {
                typeLink = sankeyData.links.find(l => l.target === node && l.source.level === 1);
            } else if (node.level === 3) {
                const subtypeLink = sankeyData.links.find(l => l.target.id === node.id && l.source.level === 2);
                if (subtypeLink) typeLink = sankeyData.links.find(l => l.target.id === subtypeLink.source.id && l.source.level === 1);
            }

            if (typeLink) {
                const subgroupLink = sankeyData.links.find(l => l.target.id === typeLink.source.id && l.source.level === 0);
                if (subgroupLink) {
                    const color = subgroupColorMap[subgroupLink.source.name];
                    return d3.color(color).darker(0.6);
                }
            }
            return '#5A7FA6';
        };

        const linkGroup = g.append('g').attr('class', 'links');
        linkGroup.selectAll('path')
            .data(sankeyData.links)
            .join('path')
            .attr('d', d3.sankeyLinkHorizontal())
            .attr('fill', 'none')
            .attr('stroke', getLinkColor)
            .attr('stroke-width', d => Math.max(2, d.width))
            .attr('stroke-opacity', 0.5)
            .style('cursor', 'pointer')
            .on('mouseover', function (event, d) {
                const percentage = ((d.value / d.source.value) * 100).toFixed(1);
                linkGroup.selectAll('path').transition().duration(200)
                    .attr('stroke-opacity', l => (l.source.id === d.source.id && l.target.id === d.target.id) ? 0.85 : 0.1);
                nodeGroup.selectAll('g.node').transition().duration(200)
                    .style('opacity', n => [d.source.id, d.target.id].includes(n.id) ? 1 : 0.2);
                showTooltip(event, `
                    <div style="text-align: center; margin-bottom: 8px;">
                        <strong>${d.source.name}</strong> → <strong>${d.target.name}</strong>
                    </div>
                    <strong>Event:</strong> ${d3.format(',')(d.value)}<br>
                    <strong>Percentage:</strong> ${percentage}%
                `);
            })
            .on('mousemove', event => tooltip.style('left', (event.clientX + 15) + 'px').style('top', (event.clientY + 15) + 'px'))
            .on('mouseout', () => {
                linkGroup.selectAll('path').transition().duration(200).attr('stroke-opacity', 0.5);
                nodeGroup.selectAll('g.node').transition().duration(200).style('opacity', 1);
                hideTooltip();
            });

        const nodeGroup = g.append('g').attr('class', 'nodes');
        const nodeElements = nodeGroup.selectAll('g')
            .data(sankeyData.nodes)
            .join('g')
            .attr('class', 'node');

        const highlightPath = (d) => {
            const connectedLinks = sankeyData.links.filter(l => l.source.id === d.id || l.target.id === d.id);
            const nodeIds = new Set([d.id, ...connectedLinks.flatMap(l => [l.source.id, l.target.id])]);
            linkGroup.selectAll('path').transition().duration(200)
                .attr('stroke-opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 0.85 : 0.1);
            nodeGroup.selectAll('g.node').transition().duration(200).style('opacity', n => nodeIds.has(n.id) ? 1 : 0.2);
        };

        const resetHighlight = () => {
            linkGroup.selectAll('path').transition().duration(200).attr('stroke-opacity', 0.5);
            nodeGroup.selectAll('g.node').transition().duration(200).style('opacity', 1);
        };

        const showNodeTooltip = (event, d) => {
            const totalValue = d.value || 0;
            const outgoingLinks = sankeyData.links.filter(l => l.source.id === d.id);
            const levelNames = ['Subgroup', 'Type', 'Subtype', 'Event'];
            let content = `<div style="text-align: center; margin-bottom: 8px;"><strong>${d.name}</strong></div>
                <strong>Level:</strong> ${levelNames[d.level]}<br>
                <strong>Total Events:</strong> ${d3.format(',')(totalValue)}`;
            if (outgoingLinks.length > 0) {
                content += '<hr style="margin: 8px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.3);">';
                outgoingLinks.forEach((l, idx) => {
                    const pct = ((l.value / totalValue) * 100).toFixed(1);
                    content += `${idx > 0 ? '<br>' : ''}<strong>${l.target.name}:</strong> ${d3.format(',')(l.value)} (${pct}%)`;
                });
            }
            showTooltip(event, content);
        };

        nodeElements.append('rect')
            .attr('x', d => d.x0).attr('y', d => d.y0)
            .attr('height', d => Math.max(4, d.y1 - d.y0))
            .attr('width', d => d.x1 - d.x0)
            .attr('fill', getNodeColor)
            .attr('stroke', 'none')
            .attr('rx', 4).attr('ry', 4)
            .style('cursor', 'pointer')
            .on('mouseover', function (event, d) {
                highlightPath(d);
                d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);
                showNodeTooltip(event, d);
            })
            .on('mousemove', event => tooltip.style('left', (event.clientX + 15) + 'px').style('top', (event.clientY + 15) + 'px'))
            .on('mouseout', function () {
                resetHighlight();
                hideTooltip();
                d3.select(this).attr('stroke', 'none');
            });

        nodeElements.append('text')
            .attr('x', d => d.level === 3 ? d.x1 + 8 : d.x0 - 8)
            .attr('y', d => (d.y0 + d.y1) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => d.level === 3 ? 'start' : 'end')
            .attr('font-size', d => d.level === 0 ? '13px' : '10px')
            .attr('font-weight', d => d.level === 0 ? 'bold' : 'normal')
            .attr('font-family', 'Roboto Slab, serif')
            .attr('class', 'alluvial-label')
            .attr('fill', getTextColor())
            .text(d => truncateLabel(d.name, d.level === 0 ? 25 : 22))
            .style('cursor', 'pointer')
            .on('mouseover', function (event, d) {
                highlightPath(d);
                d3.select(this.parentNode).select('rect').attr('stroke', '#fff').attr('stroke-width', 2);
                showNodeTooltip(event, d);
            })
            .on('mousemove', event => tooltip.style('left', (event.clientX + 15) + 'px').style('top', (event.clientY + 15) + 'px'))
            .on('mouseout', function () {
                resetHighlight();
                hideTooltip();
                d3.select(this.parentNode).select('rect').attr('stroke', 'none');
            });

        const columnTitles = ['Subgroup', 'Type', 'Subtype', 'Event'];
        const columnX = [
            margin.left + 10,
            (fullWidth - margin.left - margin.right) * 0.33 + margin.left,
            (fullWidth - margin.left - margin.right) * 0.66 + margin.left,
            fullWidth - margin.right - 10
        ];

        svg.append('g').attr('class', 'column-headers')
            .selectAll('text')
            .data(columnTitles)
            .join('text')
            .attr('x', (d, i) => columnX[i])
            .attr('y', 22)
            .attr('text-anchor', 'middle')
            .attr('font-size', '15px')
            .attr('font-weight', 'bold')
            .attr('font-family', 'Roboto Slab, serif')
            .attr('class', 'alluvial-header')
            .attr('fill', getTextColor())
            .text(d => d);

        svg.append('text')
            .attr('class', 'alluvial-year-range')
            .attr('x', fullWidth - 20)
            .attr('y', fullHeight - 15)
            .attr('text-anchor', 'end')
            .attr('font-size', '24px')
            .attr('font-weight', 'bold')
            .attr('font-family', 'Roboto Slab, serif')
            .attr('fill', getTextColor())
            .attr('opacity', 0.5)
            .text(`${yearStart} - ${yearEnd}`);
    };

    const updateChart = () => {
        const yearStart = +yearStartSelect.property('value') || YEAR_MIN;
        const yearEnd = +yearEndSelect.property('value') || YEAR_MAX;
        drawChart(Math.min(yearStart, yearEnd), Math.max(yearStart, yearEnd));
    };

    drawChart(YEAR_MIN, YEAR_MAX);

    const updateTextColors = () => {
        svg.selectAll('.alluvial-label,.alluvial-header,.alluvial-year-range')
            .attr('fill', getTextColor());
    };

    new MutationObserver(mutations => {
        mutations.forEach(m => {
            if (m.attributeName === 'data-theme') updateTextColors();
        });
    }).observe(document.documentElement, { attributes: true });

    const debounce = (fn, wait) => {
        let t;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    };

    window.addEventListener('resize', debounce(updateChart, 200));
}
