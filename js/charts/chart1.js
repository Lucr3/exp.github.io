// js/charts/chart1.js
// Render a line chart with total political violence events in Yemen per year.
// It reads the Excel file `number_of_political_violence_events_by_country-year_as-of-12Dec2025.xlsx` from /datasets

export async function renderViolenceTimeline(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // prepare container
    container.innerHTML = '';
    container.style.position = container.style.position || 'relative';

    function showMessage(msg) {
        container.innerHTML = `<div class="loading">${msg}</div>`;
    }

    showMessage('Caricamento dati...');

    try {
        const res = await fetch('./datasets/number_of_political_violence_events_by_country-year_as-of-12Dec2025.xlsx');
        if (!res.ok) throw new Error('Impossibile scaricare il file Excel: ' + res.statusText);
        const ab = await res.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

        if (!raw || raw.length === 0) {
            showMessage('File Excel vuoto o non leggibile.');
            return;
        }

        const sample = raw[0];
        const keys = Object.keys(sample);
        const countryKey = keys.find(k => /country/i.test(k)) || keys.find(k => /location/i.test(k));
        const yearKey = keys.find(k => /year/i.test(k));

        if (!countryKey || !yearKey) {
            showMessage('Colonne "country" o "year" non trovate nel file.');
            console.warn('Keys found:', keys);
            return;
        }

        // Identify numeric columns (possible counts by category)
        const numericKeys = keys.filter(k => k !== countryKey && k !== yearKey && raw.some(r => typeof r[k] === 'number'));

        // Filter rows for Yemen
        const yRows = raw.filter(r => String(r[countryKey]).toLowerCase().includes('yemen'));
        if (yRows.length === 0) {
            showMessage('Nessuna riga per "Yemen" trovata nel foglio.');
            return;
        }

        // Aggregate total events per year and keep breakdown/details
        const totalsByYear = {}; // year -> { total: number, breakdown: {cat:count}, rows: [row,...] }

        if (numericKeys.length > 0) {
            // Sum all numeric columns per row to get total, then aggregate by year and by numeric column
            yRows.forEach(r => {
                const y = +r[yearKey];
                if (!totalsByYear[y]) totalsByYear[y] = { total: 0, breakdown: {}, rows: [] };
                const totalRow = numericKeys.reduce((acc, k) => {
                    const v = Number(r[k]) || 0;
                    totalsByYear[y].breakdown[k] = (totalsByYear[y].breakdown[k] || 0) + v;
                    return acc + v;
                }, 0);
                totalsByYear[y].total += totalRow;
                totalsByYear[y].rows.push(r);
            });
        } else {
            // Try to detect a count/value column or an event-type column
            const countKey = keys.find(k => /count|value|n_events|events/i.test(k));
            const eventTypeKey = keys.find(k => /event/i.test(k) || /type/i.test(k));
            if (countKey) {
                yRows.forEach(r => {
                    const y = +r[yearKey];
                    if (!totalsByYear[y]) totalsByYear[y] = { total: 0, breakdown: {}, rows: [] };
                    const v = Number(r[countKey]) || 0;
                    totalsByYear[y].total += v;
                    totalsByYear[y].rows.push(r);
                });
            } else if (eventTypeKey) {
                // aggregate by event type
                yRows.forEach(r => {
                    const y = +r[yearKey];
                    const cat = String(r[eventTypeKey] || 'Other');
                    if (!totalsByYear[y]) totalsByYear[y] = { total: 0, breakdown: {}, rows: [] };
                    totalsByYear[y].breakdown[cat] = (totalsByYear[y].breakdown[cat] || 0) + 1;
                    totalsByYear[y].total += 1;
                    totalsByYear[y].rows.push(r);
                });
            } else {
                // fallback: count rows as events (if dataset is event-level)
                yRows.forEach(r => {
                    const y = +r[yearKey];
                    if (!totalsByYear[y]) totalsByYear[y] = { total: 0, breakdown: {}, rows: [] };
                    totalsByYear[y].total += 1;
                    totalsByYear[y].rows.push(r);
                });
            }
        }

        // fill years range (ensure continuous years)
        const years = Object.keys(totalsByYear).map(y => +y);
        const minY = Math.min(...years);
        const maxY = Math.max(...years);
        const fullYears = [];
        for (let y = minY; y <= maxY; y++) fullYears.push(y);

        // Ensure `total` is a number (we stored totalsByYear[y] as an object with .total)
        const data = fullYears.map(y => ({ year: y, total: (totalsByYear[y] && Number(totalsByYear[y].total)) || 0 }));

        // debug: show aggregated totals in console
        console.debug('Aggregated totalsByYear:', totalsByYear);
        console.debug('Chart data:', data);

        if (data.length === 0) {
            showMessage('Nessun dato aggregato per costruire il grafico.');
            return;
        }

        // Clear container content and prepare svg holder
        container.innerHTML = '';

        let svg, svgG, margin, w, h;

        function drawChart() {
            // remove previous svg
            d3.select(container).selectAll('svg').remove();

            margin = { top: 20, right: 20, bottom: 50, left: 60 };
            const containerWidth = Math.min(1100, container.clientWidth || window.innerWidth - 40);
            w = containerWidth - margin.left - margin.right;
            h = 420 - margin.top - margin.bottom;

            svg = d3.select(container).append('svg')
                .attr('width', w + margin.left + margin.right)
                .attr('height', h + margin.top + margin.bottom)
                .attr('viewBox', `0 0 ${w + margin.left + margin.right} ${h + margin.top + margin.bottom}`)
                .attr('preserveAspectRatio', 'xMidYMid meet');

            svgG = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

            const x = d3.scaleLinear()
                .domain([d3.min(data, d => d.year), d3.max(data, d => d.year)])
                .range([0, w]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.total) || 0])
                .nice()
                .range([h, 0]);

            const xAxis = d3.axisBottom(x).ticks(Math.min(data.length, 12)).tickFormat(d3.format('d'));
            const yAxis = d3.axisLeft(y).ticks(6);

            svgG.append('g')
                .attr('transform', `translate(0,${h})`)
                .call(xAxis)
                .selectAll('text')
                .attr('transform', 'translate(0,4)');

            svgG.append('g').call(yAxis);

            const line = d3.line()
                .x(d => x(d.year))
                .y(d => y(d.total))
                .curve(d3.curveMonotoneX);

            const area = d3.area()
                .x(d => x(d.year))
                .y0(h)
                .y1(d => y(d.total))
                .curve(d3.curveMonotoneX);

            // area then line
            svgG.append('path')
                .datum(data)
                .attr('fill', 'rgba(25,155,252,0.12)')
                .attr('d', area);

            svgG.append('path')
                .datum(data)
                .attr('fill', 'none')
                .attr('stroke', 'var(--accent-color)')
                .attr('stroke-width', 2.5)
                .attr('d', line);

            // tooltip element
            let tip = d3.select(container).select('.tooltip');
            if (tip.empty()) {
                tip = d3.select(container).append('div')
                    .attr('class', 'tooltip')
                    .style('position', 'absolute')
                    .style('pointer-events', 'none');
            }

            // points with enter/update/exit
            const pts = svgG.selectAll('.point').data(data, d => d.year);

            pts.join(
                enter => enter.append('circle')
                    .attr('class', 'point')
                    .attr('cx', d => x(d.year))
                    .attr('cy', d => y(0))
                    .attr('r', 4)
                    .attr('fill', 'var(--accent-color)')
                    .on('mouseenter', (event, d) => {
                                const rect = container.getBoundingClientRect();
                                const left = event.clientX - rect.left + window.scrollX + 8;
                                const top = event.clientY - rect.top + window.scrollY + 8;
                                // build tooltip content: total + breakdown + sample rows
                                const info = totalsByYear[d.year] || { total: d.total, breakdown: {}, rows: [] };
                                let html = `<strong>${d.year}</strong><br/><strong>Totale eventi:</strong> ${info.total}<br/>`;
                                const breakdown = info.breakdown || {};
                                const keysB = Object.keys(breakdown);
                                if (keysB.length > 0) {
                                    html += `<small><em>Dettaglio per categoria:</em></small><br/><ul style="margin:4px 0 0 16px;padding:0;list-style:disc;">`;
                                    keysB.sort((a,b)=> (breakdown[b]||0)-(breakdown[a]||0)).forEach(k => {
                                        html += `<li>${k}: ${breakdown[k]}</li>`;
                                    });
                                    html += `</ul>`;
                                }
                                // show up to 5 sample rows with key info
                                if (info.rows && info.rows.length > 0) {
                                    html += `<small><em>Sample righe (max 5):</em></small><br/><ul style="margin:4px 0 0 16px;padding:0;list-style:disc;">`;
                                    info.rows.slice(0,5).forEach(r => {
                                        // show a compact representation of the row: join a few columns
                                        const repr = Object.entries(r).slice(0,5).map(([kk,v])=>`${kk}: ${v}`).join(' | ');
                                        html += `<li style="font-size:11px;">${repr}</li>`;
                                    });
                                    if (info.rows.length > 5) html += `<li style="font-size:11px;">... e altri ${info.rows.length-5} record</li>`;
                                    html += `</ul>`;
                                }

                                tip.html(html)
                                    .style('left', left + 'px')
                                    .style('top', top + 'px')
                                    .classed('visible', true);
                            })
                    .on('mouseleave', () => tip.classed('visible', false))
                    .call(sel => sel.transition().duration(600).attr('cy', d => y(d.total))),
                update => update.call(sel => sel.transition().duration(600).attr('cx', d => x(d.year)).attr('cy', d => y(d.total))),
                exit => exit.remove()
            );

            // title and labels
            svgG.append('text')
                .attr('x', 0)
                .attr('y', -6)
                .attr('font-size', 16)
                .attr('font-weight', 700)
                .text('Eventi di violenza politica in Yemen (totale per anno)');

            svgG.append('text')
                .attr('x', w / 2)
                .attr('y', h + margin.bottom - 8)
                .attr('text-anchor', 'middle')
                .attr('font-size', 12)
                .text('Anno');

            svgG.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('x', -h / 2)
                .attr('y', -44)
                .attr('text-anchor', 'middle')
                .attr('font-size', 12)
                .text('Numero di eventi');
        }

        // initial draw
        drawChart();

        // redraw on resize (debounced)
        let tId = null;
        const onResize = () => {
            if (tId) clearTimeout(tId);
            tId = setTimeout(() => { drawChart(); }, 200);
        };
        window.addEventListener('resize', onResize);

    } catch (err) {
        console.error(err);
        showMessage('Errore durante il caricamento o l\'elaborazione dei dati. Vedi console per dettagli.');
    }
}
