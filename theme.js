import { translatePage } from './translations.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize language state
    const htmlElement = document.documentElement;
    const langToggle = document.getElementById('lang-toggle');
    const langFlag = document.getElementById('lang-flag');
    
    // Theme toggle setup
    const themeToggle = document.getElementById('theme-toggle');
    const moonIcon = themeToggle.querySelector('i');
    const savedTheme = localStorage.getItem('theme');
    
    // Apply saved theme if exists
    if (savedTheme) {
        htmlElement.setAttribute('data-theme', savedTheme);
        updateIcon(savedTheme);
    }

    // Theme toggle click handler
    themeToggle.addEventListener('click', () => {
        const currentTheme = htmlElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        htmlElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateIcon(newTheme);
    });

    // Language toggle click handler
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            console.log('Language toggle clicked');
            const currentLang = document.documentElement.lang || 'hu';
            const newLang = currentLang === 'en' ? 'hu' : 'en';
            console.log('Switching to:', newLang);
            updateLanguage(newLang);
            window.translatePage(newLang);
        });
    }

    // Apply initial language
    const savedLang = localStorage.getItem('language') || 'hu';
    updateLanguage(savedLang);
    window.translatePage(savedLang);

    function updateIcon(theme) {
        moonIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    function updateLanguage(lang) {
        const flagCode = lang === 'en' ? 'hu' : 'gb';
        langFlag.src = `https://flagcdn.com/w80/${flagCode}.png`;
        langFlag.alt = lang === 'en' ? 'Magyar' : 'English';
        document.documentElement.lang = lang;
        localStorage.setItem('language', lang);
    }
});
