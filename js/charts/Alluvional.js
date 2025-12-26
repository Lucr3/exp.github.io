export function renderAlluvional(container, datasets) {

    const root = d3.select(container);
    const svg = root.select('#alluvial-svg');
    const yearStartSelect = root.select('#alluvial-year-start');
    const yearEndSelect = root.select('#alluvial-year-end');

    if (svg.empty()) return;

    // Parse all data and extract years
    const rawData = datasets.Natural_Disasters;
    const allYears = [...new Set(rawData.map(d => +d['Start Year']).filter(y => y && y > 1900))].sort((a, b) => a - b);

    const YEAR_MIN = allYears[0] || 1991;
    const YEAR_MAX = allYears[allYears.length - 1] || 2025;

    // Dynamic year selector functions
    function updateYearEndOptions(minYear) {
        if (yearEndSelect.empty()) return;

        const currentEnd = +yearEndSelect.property('value');
        const validYears = allYears.filter(y => y >= minYear);

        yearEndSelect.selectAll('option').remove();
        yearEndSelect.selectAll('option')
            .data(validYears)
            .enter()
            .append('option')
            .attr('value', d => d)
            .text(d => d);

        if (currentEnd >= minYear) {
            yearEndSelect.property('value', currentEnd);
        } else {
            yearEndSelect.property('value', validYears[validYears.length - 1]);
        }
    }

    function updateYearStartOptions(maxYear) {
        if (yearStartSelect.empty()) return;

        const currentStart = +yearStartSelect.property('value');
        const validYears = allYears.filter(y => y <= maxYear);

        yearStartSelect.selectAll('option').remove();
        yearStartSelect.selectAll('option')
            .data(validYears)
            .enter()
            .append('option')
            .attr('value', d => d)
            .text(d => d);

        if (currentStart <= maxYear) {
            yearStartSelect.property('value', currentStart);
        } else {
            yearStartSelect.property('value', validYears[0]);
        }
    }

    // Initial population
    function populateYearSelects() {
        if (!yearStartSelect.empty()) {
            yearStartSelect.selectAll('option').remove();
            yearStartSelect.selectAll('option')
                .data(allYears)
                .enter()
                .append('option')
                .attr('value', d => d)
                .text(d => d);
            yearStartSelect.property('value', YEAR_MIN);
        }

        if (!yearEndSelect.empty()) {
            yearEndSelect.selectAll('option').remove();
            yearEndSelect.selectAll('option')
                .data(allYears)
                .enter()
                .append('option')
                .attr('value', d => d)
                .text(d => d);
            yearEndSelect.property('value', YEAR_MAX);
        }
    }

    populateYearSelects();

    // Get theme-aware text color
    function getTextColor() {
        const theme = document.documentElement.getAttribute('data-theme');
        return theme === 'dark' ? '#e0e0e0' : '#333333';
    }

    // Tooltip setup
    const TOOLTIP_ID = 'alluvial-tooltip';
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
        .style('background', 'rgba(0, 0, 0, 0.95)')
        .style('color', '#fff')
        .style('padding', '12px 16px')
        .style('border-radius', '8px')
        .style('font-size', '13px')
        .style('font-family', 'Roboto Slab, serif')
        .style('z-index', 10000)
        .style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)')
        .style('max-width', '320px');

    function showTooltip(event, content) {
        tooltip
            .style('display', 'block')
            .style('opacity', 1)
            .html(content);

        let x = event.clientX + 15;
        let y = event.clientY + 15;
        const rect = tooltip.node().getBoundingClientRect();

        if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 15;
        if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - 15;

        tooltip.style('left', x + 'px').style('top', y + 'px');
    }

    function hideTooltip() {
        tooltip.style('display', 'none').style('opacity', 0);
    }

    // Main draw function
    function drawChart(yearStart, yearEnd) {
        svg.selectAll('*').remove();

        // Responsive dimensions
        const margin = { top: 40, right: 200, bottom: 40, left: 200 };

        function computeDimensions() {
            const containerNode = root.node();
            let containerWidth = 1200;
            if (containerNode) {
                const rect = containerNode.getBoundingClientRect();
                if (rect && rect.width) containerWidth = Math.max(800, Math.round(rect.width));
            }
            const fullWidth = containerWidth;
            const fullHeight = Math.max(500, Math.round(fullWidth * 0.55));
            return { fullWidth, fullHeight };
        }

        const dims = computeDimensions();
        svg.attr('viewBox', `0 0 ${dims.fullWidth} ${dims.fullHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .attr('width', '100%')
            .style('max-width', '100%')
            .style('height', 'auto');

        // Filter data by year range
        const data = rawData.filter(d => {
            const year = +d['Start Year'];
            return year >= yearStart && year <= yearEnd;
        });

        if (data.length === 0) {
            svg.append('text')
                .attr('x', dims.fullWidth / 2)
                .attr('y', dims.fullHeight / 2)
                .attr('text-anchor', 'middle')
                .attr('font-size', '16px')
                .attr('fill', getTextColor())
                .text('Nessun dato disponibile per questo intervallo di anni');
            return;
        }

        // Count occurrences for each combination with event details
        const flowCounts = new Map();
        const eventsByPath = new Map();
        const eventCounts = new Map();

        data.forEach(d => {
            const group = d['Disaster Group'] || 'Unknown';
            const subgroup = d['Disaster Subgroup'] || 'Unknown';
            const type = d['Disaster Type'] || 'Unknown';
            const subtype = d['Disaster Subtype'] || 'Unknown';
            const eventName = d['Event Name'] || 'Unnamed event';
            const year = d['Start Year'] || 'Unknown';

            if (group === 'Unknown' || type === 'Unknown') return;

            const key = `${group}|${subgroup}|${type}|${subtype}`;
            flowCounts.set(key, (flowCounts.get(key) || 0) + 1);

            // Store event details for tooltip
            if (!eventsByPath.has(key)) {
                eventsByPath.set(key, []);
            }
            eventsByPath.get(key).push({ name: eventName, year: year });

            // Count occurrences of each event by name only
            eventCounts.set(eventName, (eventCounts.get(eventName) || 0) + 1);
        });

        // Build nodes and links for sankey
        const nodesMap = new Map();
        const links = [];
        const linkEvents = new Map();

        const getNodeId = (level, name) => `${level}_${name}`;

        flowCounts.forEach((count, key) => {
            const [group, subgroup, type, subtype] = key.split('|');

            const groupId = getNodeId('group', group);
            const subgroupId = getNodeId('subgroup', subgroup);
            const typeId = getNodeId('type', type);
            const subtypeId = getNodeId('subtype', subtype);

            if (!nodesMap.has(groupId)) {
                nodesMap.set(groupId, { id: groupId, name: group, level: 0 });
            }
            if (!nodesMap.has(subgroupId)) {
                nodesMap.set(subgroupId, { id: subgroupId, name: subgroup, level: 1 });
            }
            if (!nodesMap.has(typeId)) {
                nodesMap.set(typeId, { id: typeId, name: type, level: 2 });
            }
            if (!nodesMap.has(subtypeId)) {
                nodesMap.set(subtypeId, { id: subtypeId, name: subtype, level: 3 });
            }

            // Create nodes for events and links to them
            const events = eventsByPath.get(key) || [];
            // Get unique event names (not by year)
            const uniqueEventNames = [...new Set(events.map(e => e.name))];

            uniqueEventNames.forEach(eventName => {
                const eventId = getNodeId('event', eventName);
                if (!nodesMap.has(eventId)) {
                    const eventCount = eventCounts.get(eventName) || 1;
                    nodesMap.set(eventId, { id: eventId, name: eventName, level: 4, value: eventCount });
                }
                // Count how many times this event appears in this subtype path
                const eventCountInPath = events.filter(e => e.name === eventName).length;
                // Create link from subtype to event with the count from this path
                links.push({ source: subtypeId, target: eventId, value: eventCountInPath });
            });

            links.push({ source: groupId, target: subgroupId, value: count, key: key });
            links.push({ source: subgroupId, target: typeId, value: count, key: key });
            links.push({ source: typeId, target: subtypeId, value: count, key: key });
        });

        // Aggregate duplicate links
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

        // Accessible palette for colorblind-safe visualization
        // High-contrast palette (Okabe-Ito / IBM Design inspired)
        const groupColors = {
            'Natural': '#0077BB',      // Accessibile Blue
            'Technological': '#EE7733' // Accessibile Orange
        };

        // Map types to their base colors
        // Natural types use cool spectrum, Technological types use warm spectrum
        const typeBaseColors = {
            // Natural disaster types - Cool spectrum
            'Hydrological': '#33BBEE',    // Cyan
            'Biological': '#009988',      // Teal
            'Geophysical': '#004488',     // Dark Blue (High contrast)
            'Meteorological': '#6633CC',  // Purple (Distinct from blues)

            // Technological disaster types - Warm spectrum
            'Transport': '#EE7733',             // Orange (matches group)
            'Industrial accident': '#CC3311',   // Red/Vermilion
            'Miscellaneous accident': '#EE3377',// Magenta
            'Collapse (Miscellaneous)': '#DDAA33' // Gold/Dark Yellow
        };

        // Color function for types
        const typeColorScale = (name) => typeBaseColors[name] || '#808080';

        // Create sankey generator
        const sankey = d3.sankey()
            .nodeId(d => d.id)
            .nodeWidth(20)
            .nodePadding(14)
            .nodeAlign(d3.sankeyLeft)
            .extent([[margin.left, margin.top], [dims.fullWidth - margin.right, dims.fullHeight - margin.bottom]]);

        // Generate layout
        const sankeyData = sankey({
            nodes: nodes.map(d => ({ ...d })),
            links: aggregatedLinks.map(d => ({ ...d }))
        });

        // Clip path for reveal animation
        const clipId = 'alluvial-clip-' + Math.random().toString(36).substr(2, 9);
        const defs = svg.append('defs');
        const clipRect = defs.append('clipPath')
            .attr('id', clipId)
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 0)
            .attr('height', dims.fullHeight);

        clipRect.transition()
            .duration(600)
            .ease(d3.easeQuadOut)
            .attr('width', dims.fullWidth);

        const g = svg.append('g').attr('clip-path', `url(#${clipId})`);

        // Draw links
        const linkGroup = g.append('g').attr('class', 'links');

        const linkPaths = linkGroup.selectAll('path')
            .data(sankeyData.links)
            .join('path')
            .attr('d', d3.sankeyLinkHorizontal())
            .attr('fill', 'none')
            .attr('stroke', d => {
                const sourceNode = d.source;
                if (sourceNode.level === 0) {
                    return groupColors[sourceNode.name] || '#666';
                }
                return typeColorScale(sourceNode.name);
            })
            .attr('stroke-width', d => Math.max(2, d.width))
            .attr('stroke-opacity', 0.5)
            .style('cursor', 'pointer');

        // Draw nodes
        const nodeGroup = g.append('g').attr('class', 'nodes');

        const nodeElements = nodeGroup.selectAll('g')
            .data(sankeyData.nodes)
            .join('g')
            .attr('class', 'node');

        function getNodeColor(d) {
            if (d.level === 0) {
                return groupColors[d.name] || '#808080';
            }

            // Level 1 (Subgroup): variation of group color with opacity/lightness
            const parentLink = sankeyData.links.find(l => l.target.id === d.id);
            if (d.level === 1) {
                const groupColor = parentLink ? groupColors[parentLink.source.name] : '#808080';
                return d3.color(groupColor).brighter(0.5);
            }

            // Level 2 (Type): use type color scale
            if (d.level === 2) {
                return typeColorScale(d.name);
            }

            // Level 3 (Subtype): match type color if names correspond, otherwise darker
            const typeLink = sankeyData.links.find(l => l.target === d && l.source.level === 2);
            if (typeLink) {
                const typeColor = typeColorScale(typeLink.source.name);
                // If subtype name matches type name exactly, use same color
                if (d.name === typeLink.source.name) {
                    return typeColor;
                }
                // Otherwise use darker variation of the same color
                return d3.color(typeColor).darker(0.6);
            }
            return '#808080';
        }

        // Highlight functions
        function highlightLink(linkData) {
            const connectedNodeIds = new Set([linkData.source.id, linkData.target.id]);

            linkGroup.selectAll('path')
                .transition()
                .duration(200)
                .attr('stroke-opacity', l =>
                    (l.source.id === linkData.source.id && l.target.id === linkData.target.id) ? 0.85 : 0.1
                );

            nodeGroup.selectAll('g.node')
                .transition()
                .duration(200)
                .style('opacity', n => connectedNodeIds.has(n.id) ? 1 : 0.2);
        }

        function highlightPath(d) {
            const connectedLinks = sankeyData.links.filter(l =>
                l.source.id === d.id || l.target.id === d.id
            );

            const connectedNodeIds = new Set([d.id]);
            connectedLinks.forEach(l => {
                connectedNodeIds.add(l.source.id);
                connectedNodeIds.add(l.target.id);
            });

            linkGroup.selectAll('path')
                .transition()
                .duration(200)
                .attr('stroke-opacity', l =>
                    (l.source.id === d.id || l.target.id === d.id) ? 0.85 : 0.1
                );

            nodeGroup.selectAll('g.node')
                .transition()
                .duration(200)
                .style('opacity', n => connectedNodeIds.has(n.id) ? 1 : 0.2);
        }

        function resetHighlight() {
            linkGroup.selectAll('path')
                .transition()
                .duration(200)
                .attr('stroke-opacity', 0.5);

            nodeGroup.selectAll('g.node')
                .transition()
                .duration(200)
                .style('opacity', 1);
        }

        // Link interactions
        linkPaths
            .on('mouseover', function (event, d) {
                highlightLink(d);
                const percentage = ((d.value / d.source.value) * 100).toFixed(1);
                showTooltip(event, `
                    <div style="text-align: center; margin-bottom: 8px;">
                        <strong>${d.source.name}</strong> → <strong>${d.target.name}</strong>
                    </div>
                    <strong>Eventi:</strong> ${d3.format(',')(d.value)}<br>
                    <strong>Percentuale:</strong> ${percentage}%
                `);
            })
            .on('mousemove', (event) => {
                tooltip
                    .style('left', (event.clientX + 15) + 'px')
                    .style('top', (event.clientY + 15) + 'px');
            })
            .on('mouseout', function () {
                resetHighlight();
                hideTooltip();
            });

        // Node rectangles
        nodeElements.append('rect')
            .attr('x', d => d.x0)
            .attr('y', d => d.y0)
            .attr('height', d => Math.max(4, d.y1 - d.y0))
            .attr('width', d => d.x1 - d.x0)
            .attr('fill', d => getNodeColor(d))
            .attr('stroke', 'none')
            .attr('rx', 4)
            .attr('ry', 4)
            .style('cursor', 'pointer')
            .on('mouseover', function (event, d) {
                highlightPath(d);
                d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);

                const totalValue = d.value || 0;
                const outgoingLinks = sankeyData.links.filter(l => l.source.id === d.id);
                const levelNames = ['Gruppo Disastro', 'Sottogruppo', 'Tipo', 'Sottotipo'];

                let content = `
                    <div style="text-align: center; margin-bottom: 8px;">
                        <strong>${d.name}</strong>
                    </div>
                    <strong>Livello:</strong> ${levelNames[d.level]}<br>
                    <strong>Totale Eventi:</strong> ${d3.format(',')(totalValue)}
                `;

                if (outgoingLinks.length > 0) {
                    content += '<hr style="margin: 8px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.3);">';
                    outgoingLinks.forEach((l, index) => {
                        const percentage = ((l.value / totalValue) * 100).toFixed(1);
                        content += `${index > 0 ? '<br>' : ''}<strong>${l.target.name}:</strong> ${d3.format(',')(l.value)} (${percentage}%)`;
                    });
                }

                showTooltip(event, content);
            })
            .on('mousemove', (event) => {
                tooltip
                    .style('left', (event.clientX + 15) + 'px')
                    .style('top', (event.clientY + 15) + 'px');
            })
            .on('mouseout', function () {
                resetHighlight();
                hideTooltip();
                d3.select(this).attr('stroke', 'none');
            });

        // Node labels
        nodeElements.append('text')
            .attr('x', d => d.level === 4 ? d.x1 + 8 : d.x0 - 8)
            .attr('y', d => (d.y0 + d.y1) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => d.level === 4 ? 'start' : 'end')
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

                const totalValue = d.value || 0;
                const levelNames = ['Gruppo Disastro', 'Sottogruppo', 'Tipo', 'Sottotipo', 'Event'];

                let content = `
                    <div style="text-align: center; margin-bottom: 8px;">
                        <strong>${d.name}</strong>
                    </div>
                    <strong>Livello:</strong> ${levelNames[d.level]}<br>
                    <strong>Totale Eventi:</strong> ${d3.format(',')(totalValue)}
                `;

                showTooltip(event, content);
            })
            .on('mousemove', (event) => {
                tooltip
                    .style('left', (event.clientX + 15) + 'px')
                    .style('top', (event.clientY + 15) + 'px');
            })
            .on('mouseout', function () {
                resetHighlight();
                hideTooltip();
                d3.select(this.parentNode).select('rect').attr('stroke', 'none');
            });

        // Column headers
        const columnTitles = ['Gruppo Disastro', 'Sottogruppo', 'Tipo', 'Sottotipo', 'Event'];
        const columnX = [margin.left + 10, (dims.fullWidth - margin.left - margin.right) * 0.25 + margin.left, (dims.fullWidth - margin.left - margin.right) * 0.5 + margin.left, (dims.fullWidth - margin.left - margin.right) * 0.75 + margin.left, dims.fullWidth - margin.right - 10];

        svg.append('g')
            .attr('class', 'column-headers')
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

        // Year range indicator
        svg.append('text')
            .attr('class', 'alluvial-year-range')
            .attr('x', dims.fullWidth - 20)
            .attr('y', dims.fullHeight - 15)
            .attr('text-anchor', 'end')
            .attr('font-size', '24px')
            .attr('font-weight', 'bold')
            .attr('font-family', 'Roboto Slab, serif')
            .attr('fill', getTextColor())
            .attr('opacity', 0.5)
            .text(`${yearStart} - ${yearEnd}`);
    }

    function truncateLabel(text, maxLength) {
        if (!text) return '';
        // Keep parentheses for Explosion, remove for others
        if (text.toLowerCase().startsWith('explosion')) {
            return text;
        }
        // Remove text in parentheses
        return text.replace(/\s*\([^)]*\)\s*/g, '').trim();
    }

    // Initial draw
    drawChart(YEAR_MIN, YEAR_MAX);

    // Update on year selection change
    function updateChart() {
        const yearStart = +yearStartSelect.property('value') || YEAR_MIN;
        const yearEnd = +yearEndSelect.property('value') || YEAR_MAX;
        const actualStart = Math.min(yearStart, yearEnd);
        const actualEnd = Math.max(yearStart, yearEnd);
        drawChart(actualStart, actualEnd);
    }

    if (!yearStartSelect.empty()) {
        yearStartSelect.on('change', function () {
            const selectedStart = +this.value;
            updateYearEndOptions(selectedStart);
            updateChart();
        });
    }
    if (!yearEndSelect.empty()) {
        yearEndSelect.on('change', function () {
            const selectedEnd = +this.value;
            updateYearStartOptions(selectedEnd);
            updateChart();
        });
    }

    // Watch for theme changes
    function updateTextColors() {
        svg.selectAll('.alluvial-label').attr('fill', getTextColor());
        svg.selectAll('.alluvial-header').attr('fill', getTextColor());
        svg.selectAll('.alluvial-year-range').attr('fill', getTextColor());
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                updateTextColors();
            }
        });
    });

    observer.observe(document.documentElement, { attributes: true });

    // Responsive resize
    function debounce(fn, wait) {
        let t;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    const handleResize = debounce(updateChart, 200);
    window.addEventListener('resize', handleResize);
}
