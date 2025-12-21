// js/main.js
import { loadHtml } from './utils/domLoader.js';
import { loadCSV } from './utils/dataLoader.js'; 
//esempio: import { renderCivilianDeathsChart } from './charts/Chart1.js';

async function initApp() {
    console.log("Inizializzazione");

    // 1. dati
  
    // 2. HTML (Componenti + Blocchi Grafici)
    await Promise.all([
        loadHtml('navbar-container', 'html/components/navbar.html'),
        loadHtml('intro-container', 'html/components/intro.html'),
        loadHtml('about-container', 'html/components/about.html'),
        loadHtml('footer-container', 'html/components/footer.html')
    ]);

    // Pulsante logo: scroll-to-top
    const logoBtn = document.getElementById('logo-button');
    if (logoBtn) {
        logoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 3. Gestione Eventi Globali (es. Tema Scuro/Chiaro)
    const themeBtn = document.getElementById('theme-toggle');
    if(themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
        });
    }

    // 4. Renderizza i Grafici

    // Carica e renderizza il grafico degli eventi di violenza (chart1)
    try {
        const chartModule = await import('./charts/chart1.js');
        if (chartModule && typeof chartModule.renderViolenceTimeline === 'function') {
            chartModule.renderViolenceTimeline('inject-chart-1');
        }
    } catch (err) {
        console.warn('Errore caricamento chart1:', err);
    }

    console.log("App Pronta.");
}

document.addEventListener('DOMContentLoaded', initApp);