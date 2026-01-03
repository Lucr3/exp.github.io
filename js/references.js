import { loadHtml } from './utils/domLoader.js';

async function init() {
    await Promise.all([
        loadHtml('navbar-container', 'html/components/navbar.html'),
        loadHtml('references-container', 'html/components/references.html'),
        loadHtml('footer-container', 'html/components/footer.html')
    ]);

    // Setup navbar logo button to go back to index
    const logoButton = document.getElementById('logo-button');
    if (logoButton) {
        logoButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Setup navbar links to redirect to index with anchors
    const navLinks = document.getElementById('nav-links');
    if (navLinks) {
        const links = navLinks.querySelectorAll('a');
        links.forEach(link => {
            const href = link.getAttribute('href');
            // If it's an anchor link (not the Datasets link which goes to references.html)
            if (href && href.startsWith('#')) {
                // Map anchor to corresponding container ID
                const anchorMap = {
                    '#intro': '#intro-container',
                    '#chapter1-container': '#chapter1-container',
                    '#chapter2-container': '#chapter2-container',
                    '#chapter3-container': '#chapter3-container',
                    '#chapter4-container': '#chapter4-container',
                    '#chapter5-container': '#chapter5-container',
                    '#about': '#about-container'
                };
                const mappedAnchor = anchorMap[href] || href;
                link.setAttribute('href', 'index.html' + mappedAnchor);
            }
        });
    }

    // Setup theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    htmlElement.setAttribute('data-theme', savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Setup hamburger menu
    const hamburger = document.getElementById('hamburger-menu');
    const navLinksElement = document.getElementById('nav-links');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinksElement.classList.toggle('active');
            hamburger.setAttribute('aria-expanded', navLinksElement.classList.contains('active'));
        });

        // Close menu when a link is clicked
        const allLinks = navLinksElement.querySelectorAll('a');
        allLinks.forEach(link => {
            link.addEventListener('click', () => {
                navLinksElement.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });
    }
}

init();