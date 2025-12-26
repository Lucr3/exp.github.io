import { loadHtml } from './utils/domLoader.js';
import { loadCSV } from './utils/dataLoader.js';
import { renderGraph } from './utils/domLoader.js';
import { renderSymbolMap } from './charts/SymbolMap.js';
import { renderAlluvional } from './charts/Alluvional.js';
import { renderChoroplethMap } from './charts/ChoroplethMap.js';
import { renderBoxPlot } from './charts/BoxPlot.js';

async function init() {
    const datasets = {
        WarDeaths: await loadCSV("yemen_deaths_in_armed_conflicts.csv"),
        AggregatedData: await loadCSV("yemen_data_aggregated.csv"),
        Natural_Disasters: await loadCSV("Natural_Disasters.csv"),
        YemenPrices: await loadCSV("yemen_prices.csv")
    };

    // Prima fase: carica le sezioni principali
    await Promise.all([
        loadHtml('navbar-container', 'html/components/navbar.html'),
        loadHtml('intro-container', 'html/components/intro.html'),
        loadHtml('chapter1-container', 'html/components/chapter1.html'),
        loadHtml('about-container', 'html/components/about.html'),
        loadHtml('footer-container', 'html/components/footer.html'),
        loadHtml('Alluvional-container', 'html/charts/Alluvional.html'),
        loadHtml('chapter2-container', 'html/components/chapter2.html')
    ]);

    // Seconda fase: carica i chart dentro le sezioni (i container ora esistono)
    await Promise.all([
        loadHtml('SymbolMap-container', 'html/charts/SymbolMap.html'),
        loadHtml('ChoroplethMap-render', 'html/charts/ChoroplethMap.html')
    ]);

    document.getElementById('logo-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    });

    renderGraph('SymbolMap-render', renderSymbolMap, datasets);
    renderGraph('Alluvional-render', renderAlluvional, datasets);
    renderGraph('ChoroplethMap-render', renderChoroplethMap, datasets);
    renderGraph('BoxPlot-render', renderBoxPlot, datasets);
}

document.addEventListener('DOMContentLoaded', init);