export function renderSymbolMap(container, datasets) {
    if (!container || !datasets?.AggregatedData) {
        console.error('Missing container or AggregatedData');
        return;
    }

    const root = d3.select(container);
    const svg = root.select('#symbolic-map-svg');
    const yearSlider = root.select('#symbolic-map-year-slider');
    const yearLabel = root.select('#symbolic-map-year-slider-value');
    const playBtn = root.select('#symbolic-map-play-btn');
    const speedSlider = root.select('#symbolic-map-speed-slider');
    const speedLabel = root.select('#symbolic-map-speed-value');

    if (svg.empty() || yearSlider.empty()) return;

    const MARGIN = { top: 10, right: 20, bottom: 20, left: 20 };
    const WIDTH = 960 - MARGIN.left - MARGIN.right;
    const HEIGHT = 500 - MARGIN.top - MARGIN.bottom;
    const VIOLENT_TYPES = ['battles', 'explosions', 'riots', 'violence against civilians'];

    const TOOLTIP_CONFIG = {
        position: 'fixed',
        background: 'rgba(0, 0, 0, 0.95)',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: '10000',
        maxWidth: '250px'
    };

    let animationInterval = null;
    let isPlaying = false;
    const yearTrails = [];

    let tooltip = d3.select('#symbolic-map-tooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div').attr('id', 'symbolic-map-tooltip');
    }

    Object.entries(TOOLTIP_CONFIG).forEach(([key, value]) => {
        tooltip.style(key, value);
    });

    svg.selectAll('g.chart-root, rect.background').remove();
    svg.append('rect').attr('class', 'background').attr('width', 960).attr('height', 500).attr('fill', '#2d3436');

    const g = svg.append('g').attr('class', 'chart-root').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
    const mapGroup = g.append('g').attr('class', 'map-group');
    const mapLayer = mapGroup.append('g').attr('class', 'map-layer');
    const trailsGroup = mapGroup.append('g').attr('class', 'trails-group');
    const bubblesGroup = mapGroup.append('g').attr('class', 'bubbles-group');

    const setupZoom = () => {
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .translateExtent([[0, 0], [WIDTH, HEIGHT]])
            .on('zoom', event => mapGroup.attr('transform', event.transform));

        svg.call(zoom);

        const zoomActions = [
            { selector: '#symbolic-map-zoom-in', scale: 1.3 },
            { selector: '#symbolic-map-zoom-out', scale: 0.7 }
        ];

        zoomActions.forEach(({ selector, scale }) => {
            root.select(selector).on('click', () => 
                svg.transition().duration(300).call(zoom.scaleBy, scale)
            );
        });

        root.select('#symbolic-map-zoom-reset').on('click', () => 
            svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1))
        );
    };

    setupZoom();

    const extractYear = str => +str.split('-')[2] || null;

    const filteredData = datasets.AggregatedData.filter(d => {
        const eventType = (d.EVENT_TYPE || '').toLowerCase().trim();
        return VIOLENT_TYPES.some(type => eventType.includes(type));
    });

    if (!filteredData.length) {
        console.error('No violent events found');
        return;
    }

    const locationData = new Map();
    filteredData.forEach(d => {
        const year = extractYear(d.WEEK);
        const lat = +d.CENTROID_LATITUDE;
        const lon = +d.CENTROID_LONGITUDE;
        const deaths = +d.FATALITIES || 0;
        const location = (d.ADMIN1 || 'Unknown').trim();

        if (!year || isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon)) return;

        if (!locationData.has(location)) {
            locationData.set(location, { location, latitude: lat, longitude: lon, years: {} });
        }

        const loc = locationData.get(location);
        loc.years[year] = (loc.years[year] || 0) + deaths;
    });

    const locationArray = Array.from(locationData.values());
    const years = [...new Set(locationArray.flatMap(loc => Object.keys(loc.years)))]
        .map(Number)
        .sort((a, b) => a - b);

    if (!years.length) {
        console.error('No valid years found');
        return;
    }

    yearSlider.attr('min', 0).attr('max', years.length - 1).attr('value', years.length - 1);
    yearLabel.text(years[years.length - 1]);

    const projection = d3.geoMercator()
        .center([48, 14.5])
        .scale(3000)
        .translate([WIDTH / 2, HEIGHT / 2]);

    const path = d3.geoPath().projection(projection);
    const maxDeaths = d3.max(locationArray.flatMap(loc => Object.values(loc.years))) || 1;

    const colorScale = d3.scaleSequential()
        .domain([0, maxDeaths])
        .interpolator(d3.interpolateRgb('#ffeaa7', '#d63031'));

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxDeaths])
        .range([2, 35]);

    const formatNum = d3.format(',');

    const showTooltip = (event, html) => {
        tooltip.html(html).style('display', 'block').style('opacity', 1);

        let x = event.clientX + 14;
        let y = event.clientY + 16;
        const rect = tooltip.node().getBoundingClientRect();

        if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 14;
        if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - 14;

        tooltip.style('left', `${x}px`).style('top', `${y}px`);
    };

    const hideTooltip = () => tooltip.style('opacity', 0).style('display', 'none');

    const renderLegend = () => {
        const breaks = d3.range(6).map(i => Math.round(i / 5 * maxDeaths));
        const legendData = breaks.map((b, i) => {
            let label = i === 0 ? '0' : i === 5 ? `${formatNum(b)}+` : `${formatNum(breaks[i - 1] + 1)}–${formatNum(b)}`;
            return { label, color: colorScale(i === 0 ? 0 : Math.round((breaks[i - 1] + b) / 2)) };
        });

        const legend = svg.append('g').attr('class', 'legend');
        const items = legend.selectAll().data(legendData).enter().append('g').attr('class', 'legend-item');

        items.append('rect').attr('width', 16).attr('height', 16).attr('fill', d => d.color);
        items.append('text').attr('x', 24).attr('y', 8).attr('dominant-baseline', 'middle')
            .style('font-size', '12px').style('fill', '#fff').text(d => d.label);

        let lx = 0;
        items.each(function() {
            const width = 16 + 8 + d3.select(this).select('text').node().getBBox().width;
            d3.select(this).attr('transform', `translate(${lx}, 0)`);
            lx += width + 30;
        });

        legend.attr('transform', `translate(${MARGIN.left + Math.max(0, (WIDTH - (lx - 30)) / 2)}, ${HEIGHT + MARGIN.top - 465})`);
    };

    d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
        .then(topo => {
            renderLegend();

            const update = yearIndex => {
                const selectedYear = years[yearIndex];
                yearLabel.text(selectedYear);
                root.select('#year-display').text(selectedYear);

                if (yearIndex < yearTrails.length) yearTrails.length = yearIndex;

                mapLayer.selectAll('path.country')
                    .data(topo.features)
                    .join('path')
                    .attr('class', 'country')
                    .attr('d', path)
                    .attr('fill', '#636e72')
                    .attr('stroke', '#4a5459')
                    .attr('stroke-width', 0.5);

                const bubbleData = locationArray
                    .filter(loc => loc.years[selectedYear])
                    .map(loc => {
                        const [x, y] = projection([loc.longitude, loc.latitude]);
                        return {
                            location: loc.location,
                            deaths: loc.years[selectedYear],
                            x, y
                        };
                    })
                    .filter(d => !isNaN(d.x) && !isNaN(d.y));

                yearTrails.forEach(trail => {
                    trailsGroup.selectAll(`circle.trail-${trail.index}`)
                        .data(trail.data)
                        .join('circle')
                        .attr('class', `trail trail-${trail.index}`)
                        .attr('cx', d => d.x)
                        .attr('cy', d => d.y)
                        .attr('r', d => radiusScale(d.deaths) * 0.6)
                        .attr('fill', d => colorScale(d.deaths))
                        .attr('opacity', 0.3);
                });

                const tooltipHtml = (d, year) => 
                    `<div style="text-align: center;"><strong>${d.location}</strong></div>` +
                    `<strong>Year:</strong> ${year}<br/><strong>Deaths:</strong> ${formatNum(d.deaths)}`;

                bubblesGroup.selectAll('circle.bubble')
                    .data(bubbleData, d => d.location)
                    .join(
                        enter => enter.append('circle')
                            .attr('class', 'bubble')
                            .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', 0)
                            .attr('fill', d => colorScale(d.deaths)).attr('opacity', 0.8)
                            .style('cursor', 'pointer')
                            .call(sel => sel.transition().duration(500).attr('r', d => radiusScale(d.deaths))),
                        update => update
                            .call(sel => sel.transition().duration(500)
                                .attr('cx', d => d.x).attr('cy', d => d.y)
                                .attr('r', d => radiusScale(d.deaths))
                                .attr('fill', d => colorScale(d.deaths))),
                        exit => exit.call(sel => sel.transition().duration(300).attr('r', 0).remove())
                    )
                    .on('mouseenter', (event, d) => {
                        showTooltip(event, tooltipHtml(d, selectedYear));
                        d3.select(event.currentTarget).attr('opacity', 1);
                    })
                    .on('mousemove', (event, d) => showTooltip(event, tooltipHtml(d, selectedYear)))
                    .on('mouseleave', event => {
                        hideTooltip();
                        d3.select(event.currentTarget).attr('opacity', 0.8);
                    });

                g.selectAll('.year-label').remove();
                g.append('text')
                    .attr('class', 'year-label')
                    .attr('x', WIDTH - 10).attr('y', HEIGHT - 10)
                    .attr('text-anchor', 'end')
                    .attr('font-size', 48).attr('font-weight', 'bold')
                    .style('fill', '#fff').attr('opacity', 0.7)
                    .text(selectedYear);

                yearTrails.push({ index: yearIndex, data: bubbleData });
            };

            update(years.length - 1);

            yearSlider.on('input', function() { update(+this.value); });

            speedSlider.on('input', function() {
                const speed = +this.value;
                speedLabel.text((speed / 1000).toFixed(1) + 's');
                if (isPlaying) {
                    clearInterval(animationInterval);
                    startAnimation(speed);
                }
            });

            const startAnimation = speed => {
                animationInterval = setInterval(() => {
                    let idx = +yearSlider.property('value');
                    idx = (idx + 1) % years.length;
                    yearSlider.property('value', idx);
                    update(idx);
                }, speed);
            };

            playBtn.on('click', function() {
                isPlaying = !isPlaying;
                if (isPlaying) {
                    const speed = +speedSlider.property('value');
                    playBtn.html('<i class="bi bi-stop-fill"></i> Stop').classed('btn-primary', false).classed('btn-danger', true);
                    startAnimation(speed);
                } else {
                    clearInterval(animationInterval);
                    playBtn.html('<i class="bi bi-play-fill"></i> Play').classed('btn-primary', true).classed('btn-danger', false);
                }
            });
        })
        .catch(error => {
            console.error('Error loading map:', error);
            g.append('text')
                .attr('x', WIDTH / 2).attr('y', HEIGHT / 2)
                .attr('text-anchor', 'middle')
                .attr('font-size', 16).attr('fill', '#666')
                .text('Error loading map data');
        });
}