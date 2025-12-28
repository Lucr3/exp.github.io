/**
 * Choropleth Map Chart - Costo del Cibo per Governatorato Yemen
 * Based on reference implementation pattern
 */

export function renderChoroplethMap(container, datasets) {
    const root = d3.select(container);
    if (root.empty()) {
        console.warn('Container not found for choropleth map');
        return;
    }

    const svg = root.select('#choropleth-svg');
    if (svg.empty()) {
        console.warn('SVG element #choropleth-svg not found');
        return;
    }

    const yearSlider = root.select('#choropleth-year-slider');
    const yearLabel = root.select('#choropleth-year-slider-value');
    const playBtn = root.select('#choropleth-play-btn');
    const speedSlider = root.select('#choropleth-speed-slider');
    const speedLabel = root.select('#choropleth-speed-value');
    const commoditySelect = root.select('#choropleth-commodity');

    const zoomInBtn = root.select('#choropleth-zoom-in');
    const zoomOutBtn = root.select('#choropleth-zoom-out');
    const zoomResetBtn = root.select('#choropleth-zoom-reset');

    let animationInterval = null;
    let isPlaying = false;

    // Tooltip setup
    const TOOLTIP_ID = 'choropleth-tooltip';
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
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', '#fff')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('font-family', 'sans-serif')
        .style('z-index', 10000)
        .style('white-space', 'nowrap')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.3)');

    const margin = { top: 10, right: 20, bottom: 20, left: 20 };
    const fullWidth = 960;
    const fullHeight = 500;
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;

    // Make SVG responsive using viewBox
    svg
        .attr('viewBox', `0 0 ${fullWidth} ${fullHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto')
        .style('max-height', '70vh'); // Prevent it from being too tall on wide screens

    svg.selectAll('g.chart-root, rect.background').remove();

    // Add dark background like SymbolMap
    svg.append('rect')
        .attr('class', 'background')
        .attr('width', fullWidth)
        .attr('height', fullHeight)
        .attr('fill', '#2d3436');

    const g = svg
        .append('g')
        .attr('class', 'chart-root')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    const mapGroup = g.append('g').attr('class', 'map-group');

    // Zoom setup
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            mapGroup.attr('transform', event.transform);
        });

    svg.call(zoom);

    if (!zoomInBtn.empty()) {
        zoomInBtn.on('click', () => {
            svg.transition().duration(300).call(zoom.scaleBy, 1.3);
        });
    }

    if (!zoomOutBtn.empty()) {
        zoomOutBtn.on('click', () => {
            svg.transition().duration(300).call(zoom.scaleBy, 0.7);
        });
    }

    if (!zoomResetBtn.empty()) {
        zoomResetBtn.on('click', () => {
            svg.transition().duration(500).call(
                zoom.transform,
                d3.zoomIdentity.translate(0, 0).scale(1)
            );
        });
    }

    // Check for required data
    if (!datasets.YemenPrices) {
        console.error('Missing required dataset: YemenPrices');
        return;
    }

    const priceData = datasets.YemenPrices;

    // Extract years from data
    const extractYear = dateStr => {
        if (!dateStr) return null;
        // Handle potentially different date formats
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
        if (parts.length === 3) {
            // Assuming d/m/y or y-m-d, usually year is last or first. 
            // Given previous code was index 2, let's try to find the 4-digit part.
            const fourDigit = parts.find(p => p.length === 4);
            return fourDigit ? +fourDigit : null;
        }
        return null;
    };

    const years = [...new Set(priceData.map(d => extractYear(d['Price Date'])))]
        .filter(y => y && y >= 2010 && y <= 2030) // Filter reasonable range
        .sort((a, b) => a - b);

    if (years.length === 0) {
        console.error('No valid years found in the data');
        return;
    }

    // Get unique commodities
    const commodities = [...new Set(priceData.map(d => d.Commodity))].filter(c => c).sort();

    // Populate commodity dropdown
    if (!commoditySelect.empty()) {
        commoditySelect.selectAll('option').remove();
        commodities.forEach(c => {
            commoditySelect.append('option').attr('value', c).text(c);
        });
    }

    // Setup year slider
    if (!yearSlider.empty()) {
        yearSlider
            .attr('min', 0)
            .attr('max', years.length - 1)
            .attr('value', years.length - 1);
    }

    if (!yearLabel.empty()) {
        yearLabel.text(years[years.length - 1]);
    }

    // Name mapping for GeoJSON to CSV
    // Name mapping for GeoJSON to CSV
    // Key: GeoJSON name, Value: Array of possible CSV names
    const nameMapping = {
        "Sanʿaʾ": ["Sana'a", "Sanaa", "Amanat Al Asimah"],
        "Sanʿaʾ Governorate": ["Sana'a", "Sanaa", "Amanat Al Asimah"], // Explicitly map Governorate version too
        "Lahij Governorate": ["Lahj"],
        "'Adan Governorate": ["Aden"],
        "Ḥaḍramawt Governorate": ["Hadramaut", "Hadhramaut"],
        "Al Ḥudaydah Governorate": ["Al Hudaydah", "Al Hodeidah"],
        "Taʿizz Governorate": ["Taizz", "Ta'izz", "Taiz"],
        "Ibb Governorate": ["Ibb"],
        "Dhamār Governorate": ["Dhamar"],
        "Al Maḥwīt Governorate": ["Al Mahwit"],
        "Ḥajjah Governorate": ["Hajjah"],
        "Ṣaʿdah Governorate": ["Sa'ada", "Saada"],
        "ʿAmrān Governorate": ["Amran"],
        "Al Jawf Governorate": ["Al Jawf"],
        "Mārib Governorate": ["Marib"],
        "Al Bayḍāʾ Governorate": ["Al Bayda"],
        "Shabwah Governorate": ["Shabwah"],
        "Abyan Governorate": ["Abyan"],
        "Al Mahrah Governorate": ["Al Maharah"],
        "Ad Dāliʿ Governorate": ["Al Dhale'e", "Ad Dali", "Al Dhale"],
        "Raymah Governorate": ["Raymah"],
        "Socotra Governorate": ["Socotra"]
    };

    const normalizeGovName = (geoName) => {
        if (!geoName) return null;
        const cleanName = geoName.trim();

        // 1. Check direct mapping
        if (nameMapping[cleanName]) return nameMapping[cleanName][0];

        // 2. Check mapping with partial matches
        for (const [geoKey, csvVariants] of Object.entries(nameMapping)) {
            // If the key is contained in the name (e.g. key "Lahij" in "Lahij Governorate")
            if (cleanName.includes(geoKey) || geoKey.includes(cleanName)) {
                return csvVariants[0];
            }
        }

        // 3. Fallback: simplify string
        let simple = cleanName
            .replace(' Governorate', '')
            .replace(/[ʿʾ]/g, "'") // Replace glottal stops
            .replace(/[āīūḥḍṭẓṣ]/g, (c) => { // Remove diacritics
                const map = { 'ā': 'a', 'ī': 'i', 'ū': 'u', 'ḥ': 'h', 'ḍ': 'd', 'ṭ': 't', 'ẓ': 'z', 'ṣ': 's' };
                return map[c] || c;
            });

        return simple;
    };

    // Aggregate prices by Admin1
    const aggregatePrices = (commodity, year) => {
        const filtered = priceData.filter(d => {
            const dYear = extractYear(d['Price Date']);
            const dCommodity = d.Commodity;
            return dYear === +year && (commodity === 'all' || dCommodity === commodity);
        });

        const byAdmin = new Map();
        filtered.forEach(d => {
            const admin = d['Admin 1']?.trim();
            // Handle number parsing carefully (e.g. "1,200.50")
            let rawPrice = d.Price;
            if (typeof rawPrice === 'string') {
                rawPrice = rawPrice.replace(/,/g, '');
            }
            const price = +rawPrice;

            if (admin && !isNaN(price) && price > 0) {
                // Normalize admin name from CSV side as well if needed, 
                // but usually we match FROM GeoJSON TO CSV.
                // Here we just store by the CSV name.

                if (!byAdmin.has(admin)) {
                    byAdmin.set(admin, { sum: 0, count: 0 });
                }
                byAdmin.get(admin).sum += price;
                byAdmin.get(admin).count += 1;
            }
        });

        const result = new Map();
        byAdmin.forEach((v, k) => {
            result.set(k, v.sum / v.count);
        });
        return result;
    };

    // Projection for Yemen
    // Use fitSize to ensure the map is correctly scaled and centered based on the data
    const projection = d3.geoMercator();
    const path = d3.geoPath().projection(projection);

    // Color gradient for prices - matching SymbolMap colors (yellow to red)
    const gradient = [
        '#ffeaa7', // Light yellow (low prices)
        '#fdcb6e',
        '#f9a825',
        '#f39c12',
        '#e67e22',
        '#e74c3c',
        '#c0392b',
        '#a93226',
        '#d63031'  // Deep red (high prices)
    ];

    const colorScale = d3.scaleThreshold()
        .domain([100, 200, 300, 500, 1000, 2000, 5000, 10000])
        .range(gradient);

    const formatNum = d3.format(',.0f');

    function showTooltip(event, html) {
        tooltip
            .html(html)
            .style('display', 'block')
            .style('opacity', 1);

        let x = event.clientX + 14;
        let y = event.clientY + 16;

        const rect = tooltip.node().getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (x + rect.width > vw - 8) {
            x = event.clientX - rect.width - 14;
        }
        if (y + rect.height > vh - 8) {
            y = event.clientY - rect.height - 14;
        }

        tooltip.style('left', `${x}px`).style('top', `${y}px`);
    }

    function hideTooltip() {
        tooltip.style('opacity', 0).style('display', 'none');
    }

    // Load local GeoJSON
    d3.json('datasets/yemen_admin1.geojson')
        .then(function (geoData) {
            // FIX: Rewind GeoJSON - unconditionally reverse all rings
            // The original GeoJSON has clockwise winding which causes D3 to render the exterior
            // (the entire world minus the shape) instead of the interior.
            // Reversing makes them counter-clockwise as D3 expects for exterior rings.

            geoData.features.forEach(feature => {
                if (feature.geometry.type === "Polygon") {
                    feature.geometry.coordinates.forEach(ring => {
                        ring.reverse();
                    });
                } else if (feature.geometry.type === "MultiPolygon") {
                    feature.geometry.coordinates.forEach(polygon => {
                        polygon.forEach(ring => {
                            ring.reverse();
                        });
                    });
                }
            });

            // Fit projection to the data
            projection.fitSize([width, height], geoData);

            // Build legend
            const legendData = [
                { value: "≤100", color: gradient[0] },
                { value: "100-199", color: gradient[1] },
                { value: "200-299", color: gradient[2] },
                { value: "300-499", color: gradient[3] },
                { value: "500-999", color: gradient[4] },
                { value: "1,000-1,999", color: gradient[5] },
                { value: "2,000-4,999", color: gradient[6] },
                { value: "5,000-9,999", color: gradient[7] },
                { value: "10,000+", color: gradient[8] }
            ];

            const legend = svg.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(0, ${height + margin.top - 465})`);

            const rectSize = 16;
            const textPadding = 8;
            const gapBetweenTexts = 20;

            const items = legend.selectAll('.legend-item')
                .data(legendData)
                .enter()
                .append('g')
                .attr('class', 'legend-item');

            items.append('rect')
                .attr('width', rectSize)
                .attr('height', rectSize)
                .attr('fill', d => d.color)
                .attr('stroke', '#333')
                .attr('stroke-width', 0.5);

            items.append('text')
                .attr('x', rectSize + textPadding)
                .attr('y', rectSize / 2)
                .attr('alignment-baseline', 'middle')
                .style('font-size', '10px')
                .style('fill', 'var(--text-color)')
                .text(d => d.value);

            let x = 0;
            items.each(function () {
                const elem = d3.select(this);
                const textNode = elem.select('text').node();
                const textBBox = textNode.getBBox();
                const groupWidth = rectSize + textPadding + textBBox.width;

                elem.attr('transform', `translate(${x}, 0)`);
                x += groupWidth + gapBetweenTexts;
            });

            // Center legend
            const totalLegendWidth = x - gapBetweenTexts;
            const startX = margin.left + Math.max(0, (width - totalLegendWidth) / 2);
            legend.attr('transform', `translate(${startX}, ${height + margin.top - 465})`);

            function update(yearIndex) {
                const selectedYear = years[yearIndex];
                if (!yearLabel.empty()) yearLabel.text(selectedYear);

                const commodity = commoditySelect.empty() ? commodities[0] : commoditySelect.property('value');
                const pricesByAdmin = aggregatePrices(commodity, selectedYear);

                // Match GeoJSON features to CSV data
                mapGroup.selectAll('path.governorate')
                    .data(geoData.features)
                    .join('path')
                    .attr('class', 'governorate')
                    .attr('d', path)
                    .transition()
                    .duration(400)
                    .attr('fill', function (d) {
                        const geoName = d.properties.shapeName;
                        const csvName = normalizeGovName(geoName);

                        // Try to find price in data
                        let price = null;

                        // Direct lookup first (fastest)
                        if (csvName && pricesByAdmin.has(csvName)) {
                            price = pricesByAdmin.get(csvName);
                        } else {
                            // Fuzzy lookup
                            for (const [admin, avgPrice] of pricesByAdmin.entries()) {
                                if (csvName && (admin.toLowerCase() === csvName.toLowerCase() ||
                                    admin.toLowerCase().includes(csvName.toLowerCase()) ||
                                    csvName.toLowerCase().includes(admin.toLowerCase()))) {
                                    price = avgPrice;
                                    break;
                                }
                            }
                        }

                        if (price === null) {
                            // console.debug(`No price for ${geoName} (mapped to ${csvName}) in ${selectedYear}`);
                        }

                        if (!price) return '#636e72'; // Grey for no data (matching SymbolMap)
                        return colorScale(price);
                    })
                    .selection()
                    .attr('stroke', '#4a5459') // Grey stroke matching SymbolMap
                    .attr('stroke-width', 0.5)
                    .style('cursor', 'pointer')
                    .on('mouseenter', (event, d) => {
                        const geoName = d.properties.shapeName;
                        const csvName = normalizeGovName(geoName);

                        let price = null;
                        for (const [admin, avgPrice] of pricesByAdmin.entries()) {
                            if (admin.toLowerCase().includes(csvName?.toLowerCase()) ||
                                csvName?.toLowerCase().includes(admin.toLowerCase())) {
                                price = avgPrice;
                                break;
                            }
                        }

                        showTooltip(
                            event,
                            `<div style="text-align: center;"><strong>${geoName}</strong></div>` +
                            `<strong>Anno:</strong> ${selectedYear}<br/>` +
                            `<strong>Commodity:</strong> ${commodity}<br/>` +
                            `<strong>Prezzo Medio:</strong> ${price ? formatNum(price) + ' YER' : 'N/A'}`
                        );
                    })
                    .on('mousemove', (event, d) => {
                        const geoName = d.properties.shapeName;
                        const csvName = normalizeGovName(geoName);

                        let price = null;
                        for (const [admin, avgPrice] of pricesByAdmin.entries()) {
                            if (admin.toLowerCase().includes(csvName?.toLowerCase()) ||
                                csvName?.toLowerCase().includes(admin.toLowerCase())) {
                                price = avgPrice;
                                break;
                            }
                        }

                        showTooltip(
                            event,
                            `<div style="text-align: center;"><strong>${geoName}</strong></div>` +
                            `<strong>Anno:</strong> ${selectedYear}<br/>` +
                            `<strong>Commodity:</strong> ${commodity}<br/>` +
                            `<strong>Prezzo Medio:</strong> ${price ? formatNum(price) + ' YER' : 'N/A'}`
                        );
                    })
                    .on('mouseleave', () => {
                        hideTooltip();
                    });

                // Year label watermark
                const yearLabelSelection = g.selectAll('.year-label')
                    .data([selectedYear]);

                yearLabelSelection.exit()
                    .transition()
                    .duration(200)
                    .attr('opacity', 0)
                    .remove();

                yearLabelSelection.enter()
                    .append('text')
                    .attr('class', 'year-label')
                    .attr('x', width - 10)
                    .attr('y', height - 80) // Moved higher to avoid Socotra
                    .attr('text-anchor', 'end')
                    .attr('font-size', 48)
                    .attr('font-weight', 'bold')
                    .attr('fill', 'var(--text-color)')
                    .style('pointer-events', 'none') // Allow mouse events to pass through to map
                    .attr('opacity', 0)
                    .merge(yearLabelSelection)
                    .text(d => d)
                    .transition()
                    .duration(200)
                    .attr('opacity', 0.15);
            }

            // Initial render
            update(years.length - 1);

            // Slider event
            if (!yearSlider.empty()) {
                yearSlider.on('input', function () {
                    update(+this.value);
                });
            }

            // Commodity change event
            if (!commoditySelect.empty()) {
                commoditySelect.on('change', function () {
                    const yearIndex = yearSlider.empty() ? years.length - 1 : +yearSlider.property('value');
                    update(yearIndex);
                });
            }

            // Speed slider
            if (!speedSlider.empty()) {
                speedSlider.on('input', function () {
                    const speed = +this.value;
                    if (!speedLabel.empty()) speedLabel.text((speed / 1000).toFixed(1) + 's');

                    if (isPlaying) {
                        clearInterval(animationInterval);
                        startAnimation(speed);
                    }
                });
            }

            function startAnimation(speed) {
                animationInterval = setInterval(() => {
                    let currentIndex = yearSlider.empty() ? 0 : +yearSlider.property('value');
                    currentIndex++;

                    if (currentIndex >= years.length) {
                        currentIndex = 0;
                    }

                    if (!yearSlider.empty()) yearSlider.property('value', currentIndex);
                    update(currentIndex);
                }, speed);
            }

            // Play button
            if (!playBtn.empty()) {
                playBtn.on('click', function () {
                    if (isPlaying) {
                        clearInterval(animationInterval);
                        animationInterval = null;
                        isPlaying = false;
                        playBtn.html('<i class="bi bi-play-fill"></i> Play');
                        playBtn.classed('btn-primary', true).classed('btn-danger', false);
                    } else {
                        isPlaying = true;
                        const speed = speedSlider.empty() ? 1000 : +speedSlider.property('value');
                        playBtn.html('<i class="bi bi-stop-fill"></i> Stop');
                        playBtn.classed('btn-primary', false).classed('btn-danger', true);
                        startAnimation(speed);
                    }
                });
            }
        })
        .catch(function (error) {
            console.error('Error loading GeoJSON:', error);
            g.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .attr('font-size', 16)
                .attr('fill', 'var(--text-muted)')
                .text('Errore nel caricamento della mappa');
        });
}
