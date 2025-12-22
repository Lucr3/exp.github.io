export async function renderHeatmap(container, datasets) {
    if (!container || !datasets || !datasets.WarDeaths) return;

    // Dati già parsati da D3
    const data = datasets.WarDeaths;

    // Raggruppa per decadi
    const decades = {};
    data.forEach(d => {
        const decade = Math.floor(d.Year / 10) * 10;
        if (!decades[decade]) decades[decade] = [];
        decades[decade].push({
            year: d.Year,
            deaths: d['Deaths in ongoing conflicts (best estimate) - Conflict type: all']
        });
    });

    // Crea matrice decadi × anni
    const heatmapData = [];
    Object.keys(decades).sort((a, b) => a - b).forEach(decade => {
        decades[decade].forEach(d => {
            heatmapData.push({
                decade: `${decade}s`,
                year: d.year,
                deaths: d.deaths
            });
        });
    });

    // Dimensioni
    const margin = { top: 20, right: 20, bottom: 20, left: 50 };
    const width = 900 - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    // SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scale
    const decades_list = [...new Set(heatmapData.map(d => d.decade))];
    const years_list = [...new Set(heatmapData.map(d => d.year))].sort((a, b) => a - b);

    const xScale = d3.scaleBand()
        .domain(years_list)
        .range([0, width])
        .padding(0.05);

    const yScale = d3.scaleBand()
        .domain(decades_list)
        .range([0, height])
        .padding(0.05);

    const colorScale = d3.scaleLinear()
        .domain([0, d3.max(heatmapData, d => d.deaths)])
        .range(['#ffffcc', '#e6194b']);

    // Rettangoli heatmap
    svg.selectAll('rect')
        .data(heatmapData)
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.year))
        .attr('y', d => yScale(d.decade))
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .attr('fill', d => colorScale(d.deaths))
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5);

    // Labels anni (ogni 5 anni)
    svg.selectAll('.year-label')
        .data(years_list.filter((d, i) => i % 5 === 0))
        .enter()
        .append('text')
        .attr('x', d => xScale(d) + xScale.bandwidth() / 2)
        .attr('y', height + 15)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('fill', 'currentColor')
        .text(d => d);

    // Labels decadi
    svg.selectAll('.decade-label')
        .data(decades_list)
        .enter()
        .append('text')
        .attr('x', -10)
        .attr('y', d => yScale(d) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('fill', 'currentColor')
        .text(d => d);
}