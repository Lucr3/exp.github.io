import { loadHtml } from './utils/domLoader.js';
import { loadCSV } from './utils/dataLoader.js';
import { renderGraph } from './utils/domLoader.js';
import { renderSymbolMap } from './charts/SymbolMap.js';
import { renderAlluvional } from './charts/Alluvional.js';

if (typeof window !== 'undefined' && window.__chromium_devtools_metrics_reporter === undefined) {
    window.__chromium_devtools_metrics_reporter = () => { };
}
import { renderChoroplethMap } from './charts/ChoroplethMap.js';
import { renderBoxPlot } from './charts/BoxPlot.js';
import { renderDumbbellPlot } from './charts/DumbbellPlot.js';
import { renderStackedArea } from './charts/StackedArea.js';
import { renderGroupedBarChart } from './charts/GroupedBarChart.js';
import { renderStackedBarChart } from './charts/StackedBarChart.js';
import { renderSpiralChart } from './charts/SpiralChart.js';
import { renderHistogram } from './charts/Histogram.js';

async function init() {
    const datasets = {
        WarDeaths: await loadCSV("yemen_deaths_in_armed_conflicts.csv"),
        AggregatedData: await loadCSV("yemen_data_aggregated.csv"),
        Natural_Disasters: await loadCSV("Natural_Disasters.csv"),
        YemenPrices: await loadCSV("yemen_prices.csv"),
        YouthMortality: await loadCSV("youth-mortality-rate.csv"),
        BirthsDeaths: await loadCSV("births-and-deaths-projected-to-2100.csv"),
        Education: await loadCSV("primary-secondary-enrollment-completion-rates.csv"),
        GoogleTrends: await loadCSV("GoogleTrends.csv")
    };

    await Promise.all([
        loadHtml('navbar-container', 'html/components/navbar.html'),
        loadHtml('intro-container', 'html/components/intro.html'),
        loadHtml('chapter1-container', 'html/components/chapter1.html'),
        loadHtml('chapter2-container', 'html/components/chapter2.html'),
        loadHtml('chapter3-container', 'html/components/chapter3.html'),
        loadHtml('about-container', 'html/components/about.html'),
        loadHtml('footer-container', 'html/components/footer.html'),
        loadHtml('Alluvional-container', 'html/charts/Alluvional.html'),
        loadHtml('chapter4-container', 'html/components/chapter4.html'),
        loadHtml('chapter5-container', 'html/components/chapter5.html')
    ]);

    await Promise.all([
        loadHtml('SymbolMap-container', 'html/charts/SymbolMap.html'),
        loadHtml('ChoroplethMap-render', 'html/charts/ChoroplethMap.html'),
        loadHtml('BoxPlot-render', 'html/charts/BoxPlot.html'),
        loadHtml('DumbbellPlot-render', 'html/charts/DumbbellPlot.html'),
        loadHtml('StackedArea-render', 'html/charts/StackedArea.html'),
        loadHtml('GroupedBarChart-container', 'html/charts/GroupedBarChart.html'),
        loadHtml('StackedBarChart-container', 'html/charts/StackedBarChart.html'),
        loadHtml('SpiralChart-container', 'html/charts/SpiralChart.html'),
        loadHtml('Histogram-container', 'html/charts/Histogram.html')
    ]);

    document.getElementById('logo-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    });

    // Hamburger menu toggle
    const hamburger = document.getElementById('hamburger-menu');
    const navLinks = document.getElementById('nav-links');

    hamburger?.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
        hamburger.setAttribute('aria-expanded', hamburger.classList.contains('active'));
    });

    // Close menu when clicking a nav link
    navLinks?.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger?.classList.remove('active');
            navLinks.classList.remove('active');
            hamburger?.setAttribute('aria-expanded', 'false');
        });
    });

    renderGraph('SymbolMap-render', renderSymbolMap, datasets);
    renderGraph('Alluvional-render', renderAlluvional, datasets);
    renderGraph('ChoroplethMap-render', renderChoroplethMap, datasets);
    renderGraph('BoxPlot-render', renderBoxPlot, datasets);
    renderGraph('DumbbellPlot-render', renderDumbbellPlot, datasets);
    renderGraph('StackedArea-render', renderStackedArea, datasets);
    renderGraph('GroupedBarChart-container', renderGroupedBarChart, datasets);
    renderGraph('StackedBarChart-container', renderStackedBarChart, datasets);
    renderGraph('SpiralChart-container', renderSpiralChart, datasets);
    renderGraph('Histogram-container', renderHistogram, datasets);

    // Handle anchor navigation after content is loaded
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        setTimeout(() => {
            const element = document.getElementById(targetId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    }
}

document.addEventListener('DOMContentLoaded', init);