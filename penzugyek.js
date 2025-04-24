// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAJIY7HyiQ6I_opPyMCApNiKgpc9RQeTY4",
    authDomain: "propti-2a95d.firebaseapp.com",
    projectId: "propti-2a95d",
    storageBucket: "propti-2a95d.appspot.com",
    messagingSenderId: "223311863074",
    appId: "1:223311863074:web:2783282939934089d1197b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('userDisplayName');
    const logoutBtn = document.getElementById('logoutBtn');
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const dateFilter = document.getElementById('dateFilter');
    let searchTimeout;

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Add event listener for unified search
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.toLowerCase().trim();
            applyFilters(searchTerm);
        }, 300);
    });

    // Function to apply filters
    async function applyFilters(searchTerm = '') {
        if (!auth.currentUser) return;
        
        const filters = {
            searchTerm: searchTerm,
            transactionType: typeFilter.value !== 'all' ? typeFilter.value : null,
            dateRange: dateFilter.value !== 'all' ? dateFilter.value : null
        };
        await loadTransactions(auth.currentUser.uid, filters);
    }

    // Add event listeners for dropdown filters
    typeFilter.addEventListener('change', () => applyFilters(searchInput.value.toLowerCase().trim()));
    dateFilter.addEventListener('change', () => applyFilters(searchInput.value.toLowerCase().trim()));

    // Helper function to check if a transaction type is an expense
    function isExpenseType(type) {
        const expenseTypes = ['tax', 'maintenance', 'utility', 'insurance'];
        return expenseTypes.includes(type);
    }

    // Helper function to get transaction amount class
    function getAmountClass(type) {
        if (type === 'kaucio') return 'deposit';
        if (type === 'rent') return 'positive';
        if (isExpenseType(type)) return 'negative';
        return '';
    }

    // Update loadTransactions function to handle unified search
    async function loadTransactions(userId, filters = {}) {
        try {
            const paymentsRef = collection(db, 'payments');
            let q = query(paymentsRef, where('ownerId', '==', userId));
            const querySnapshot = await getDocs(q);
            const tbody = document.querySelector('.transactions-table tbody');
            tbody.innerHTML = '';

            // Get all tenants first
            const tenantsRef = collection(db, 'tenants');
            const tenantsQuery = query(tenantsRef, where('ownerId', '==', userId));
            const tenantsSnapshot = await getDocs(tenantsQuery);
            const tenantsMap = new Map();
            
            tenantsSnapshot.forEach(doc => {
                tenantsMap.set(doc.id, doc.data().name);
            });

            // Initialize statistics
            let monthlyIncome = 0;
            let monthlyExpense = 0;
            let pendingPayments = 0;
            let lastMonthExpense = 0;
            
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

            let filteredDocs = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const paymentDate = new Date(data.date);
                let includePayment = true;

                // Apply search filter
                if (filters.searchTerm) {
                    const propertyName = (data.property || '').toLowerCase();
                    const tenantName = (tenantsMap.get(data.tenant) || '').toLowerCase();
                    if (!propertyName.includes(filters.searchTerm) && 
                        !tenantName.includes(filters.searchTerm)) {
                        includePayment = false;
                    }
                }

                // Apply transaction type filter
                if (filters.transactionType) {
                    const isExpense = isExpenseType(data.type);
                    if (filters.transactionType === 'income' && isExpense) includePayment = false;
                    if (filters.transactionType === 'expense' && !isExpense) includePayment = false;
                }

                // Apply date filter
                if (filters.dateRange) {
                    const startDate = new Date();
                    switch (filters.dateRange) {
                        case '1week': startDate.setDate(startDate.getDate() - 7); break;
                        case '1month': startDate.setMonth(startDate.getMonth() - 1); break;
                        case '3months': startDate.setMonth(startDate.getMonth() - 3); break;
                        case '6months': startDate.setMonth(startDate.getMonth() - 6); break;
                        case '1year': startDate.setFullYear(startDate.getFullYear() - 1); break;
                    }
                    if (paymentDate < startDate) includePayment = false;
                }

                // Only count non-kaució payments in monthly totals
                if (includePayment && paymentDate.getMonth() === currentMonth && 
                    paymentDate.getFullYear() === currentYear && data.type !== 'kaucio') {
                    if (isExpenseType(data.type)) {
                        monthlyExpense += Math.abs(data.amount);
                    } else if (data.type === 'rent') {
                        monthlyIncome += data.amount;
                    }
                }

                if (includePayment) {
                    filteredDocs.push({ id: doc.id, data });

                    if (paymentDate.getMonth() === lastMonth && 
                        paymentDate.getFullYear() === lastMonthYear && 
                        isExpenseType(data.type)) {
                        lastMonthExpense += Math.abs(data.amount);
                    }

                    if (data.status === 'pending') {
                        pendingPayments += Math.abs(data.amount);
                    }
                }
            });

            // Calculate expense change percentage
            let expenseChangePercent = 0;
            if (lastMonthExpense > 0) {
                expenseChangePercent = ((monthlyExpense - lastMonthExpense) / lastMonthExpense) * 100;
            }

            // Sort filtered docs by date (newest first)
            filteredDocs.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));

            // Display filtered results
            if (filteredDocs.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="no-results">
                            <i class="fas fa-search"></i>
                            <p>Nincs találat a keresési feltételeknek megfelelően</p>
                        </td>
                    </tr>
                `;
            } else {
                filteredDocs.forEach(({ id, data }) => {
                    const tr = document.createElement('tr');
                    const amountClass = getAmountClass(data.type);
                    
                    tr.innerHTML = `
                        <td>${new Date(data.date).toLocaleDateString('hu-HU')}</td>
                        <td>${getTransactionTypeName(data.type)}</td>
                        <td>${data.property}</td>
                        <td>${tenantsMap.get(data.tenant) || '-'}</td>
                        <td class="amount ${amountClass}">
                            ${data.amount.toLocaleString()} Ft
                        </td>
                        <td>
                            <span class="status ${data.status}">
                                ${data.status === 'paid' ? 'Teljesítve' : 'Függőben'}
                            </span>
                        </td>
                        <td>
                            <button class="btn-edit" data-id="${id}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);

                    // Add edit handler
                    tr.querySelector('.btn-edit').onclick = () => editPayment(id, data);
                });
            }

            // Update statistics
            updateStatistics(monthlyIncome, monthlyExpense, pendingPayments, expenseChangePercent);

        } catch (error) {
            console.error('Error loading transactions:', error);
            alert('Hiba történt az adatok betöltésekor');
        }
    }

    function getTransactionTypeName(type) {
        const types = {
            rent: 'Bérleti díj',
            kaucio: 'Kaució',
            maintenance: 'Karbantartás',
            utility: 'Rezsi',
            tax: 'Adó',
            insurance: 'Biztosítás',
            other: 'Egyéb'
        };
        return types[type] || type;
    }

    function updateStatistics(income, expense, pending, expenseChangePercent) {
        document.querySelector('.stat-card:nth-child(1) .amount').textContent = 
            `${income.toLocaleString()} Ft`;
        document.querySelector('.stat-card:nth-child(2) .amount').textContent = 
            `${expense.toLocaleString()} Ft`;
        document.querySelector('.stat-card:nth-child(2) .trend').textContent = 
            `${expenseChangePercent.toFixed(1)}% az előző hónaphoz képest`;
        document.querySelector('.stat-card:nth-child(2) .trend').className = 
            `trend ${expenseChangePercent <= 0 ? 'positive' : 'negative'}`;
        document.querySelector('.stat-card:nth-child(3) .amount').textContent = 
            `${pending.toLocaleString()} Ft`;
    }

    // Authentication state observer
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
            if (!userDoc.empty) {
                userDisplayNameElement.textContent = userDoc.docs[0].data().fullName || user.email;
            } else {
                userDisplayNameElement.textContent = user.email;
            }
            await loadTransactions(user.uid);
        } catch (error) {
            console.error('Error loading user data:', error);
            userDisplayNameElement.textContent = user.email;
        }
    });

    // Add logout functionality
    logoutBtn.addEventListener('click', () => {
        auth.signOut()
            .then(() => window.location.href = 'index.html')
            .catch(error => console.error('Error signing out:', error));
    });
});
