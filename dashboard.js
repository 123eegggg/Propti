// Navigation active state
document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');
    });
});

// Logout functionality
const logoutBtn = document.querySelector('.logout-btn');
logoutBtn?.addEventListener('click', () => {
    const { auth } = window.fbAuth;
    auth.signOut()
        .then(() => window.location.href = 'index.html')
        .catch(error => console.error('Error signing out:', error));
});
