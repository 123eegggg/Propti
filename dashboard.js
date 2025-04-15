// Navigation active state
document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        document.querySelector('.sidebar-nav a.active').classList.remove('active');
        e.target.classList.add('active');
    });
});

// Logout functionality
document.querySelector('.logout-btn').addEventListener('click', () => {
    window.location.href = 'index.html';
});
