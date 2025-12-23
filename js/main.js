// js/main.js
import { loadHtml } from './utils/domLoader.js';
import { loadCSV } from './utils/dataLoader.js'; 
import { renderGraph } from './utils/domLoader.js';
import { renderSymbolMap } from './charts/SymbolMap.js';

async function init() {

    // 1. dati
    let datasets = {
        WarDeaths: await loadCSV("yemen_deaths_in_armed_conflicts.csv"),
        AggregatedData: await loadCSV("yemen_data_aggregated.csv")


    }
    
  
    // 2. HTML 
    await Promise.all([
        loadHtml('navbar-container', 'html/components/navbar.html'),
        loadHtml('intro-container', 'html/components/intro.html'),
        loadHtml('chapter1-container', 'html/components/chapter1.html'),
        loadHtml('about-container', 'html/components/about.html'),
        loadHtml('footer-container', 'html/components/footer.html')
    ]);

    // Carica il grafico dentro chapter1
    await loadHtml('SymbolMap-container', 'html/charts/SymbolMap.html');

    // Pulsante logo: scroll-to-top
    const logoBtn = document.getElementById('logo-button');
    if (logoBtn) {
        logoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 3. Tema Scuro/Chiaro
    const themeBtn = document.getElementById('theme-toggle');
    if(themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
        });
    }

    // 4. Renderizza i Grafici
    renderGraph('SymbolMap-render', renderSymbolMap, datasets);



}

document.addEventListener('DOMContentLoaded', init);