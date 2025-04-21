import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
    const { db, collection, addDoc, query, where, orderBy, getDocs, doc, getDoc } = window.fbDb;
    const auth = window.fbAuth;
    const PAYMENTS_COLLECTION = 'payments';
    const userDisplayNameElement = document.getElementById('userDisplayName');
    const logoutBtn = document.getElementById('logoutBtn');

    const modal = document.getElementById('transactionModal');
    const form = document.getElementById('transactionForm');
    const tbody = document.querySelector('.transactions-table tbody');

    const typeFilter = document.getElementById('typeFilter');
    const propertyFilter = document.getElementById('propertyFilter');
    const tenantFilter = document.getElementById('tenantFilter');
    const dateFilter = document.getElementById('dateFilter');

    const propertySearch = document.getElementById('propertySearch');
    const tenantSearch = document.getElementById('tenantSearch');

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Function to apply filters
    async function applyFilters() {
        const filters = {
            propertySearch: propertySearch.value.toLowerCase(),
            tenantSearch: tenantSearch.value.toLowerCase(),
            transactionType: typeFilter.value !== 'all' ? typeFilter.value : null,
            dateRange: dateFilter.value !== 'all' ? dateFilter.value : null
        };
        await loadTransactions(auth.currentUser.uid, filters);
    }

    // Add event listeners with debouncing for search inputs
    propertySearch.addEventListener('input', debounce(applyFilters, 300));
    tenantSearch.addEventListener('input', debounce(applyFilters, 300));

    // Add event listeners for dropdown filters
    typeFilter.addEventListener('change', applyFilters);
    dateFilter.addEventListener('change', applyFilters);

    // Update user display name
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    userDisplayNameElement.textContent = userDoc.data().fullName || user.email;
                } else {
                    userDisplayNameElement.textContent = user.email;
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                userDisplayNameElement.textContent = user.email;
            }
            // Initialize other penzugyek.js functionality here
            await loadTransactions(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    // Add logout functionality
    logoutBtn.addEventListener('click', () => {
        auth.signOut()
            .then(() => window.location.href = 'index.html')
            .catch(error => console.error('Error signing out:', error));
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;

        if (!user) {
            alert('Nincs bejelentkezett felhasználó!');
            return;
        }

        try {
            const formData = new FormData(form);
            const paymentData = {
                date: formData.get('date'),
                type: formData.get('type'),
                property: formData.get('property'),
                tenant: formData.get('tenant') || null,
                amount: parseInt(formData.get('amount')),
                status: formData.get('status'),
                description: formData.get('description') || '',
                ownerId: user.uid,
                createdAt: new Date().toISOString()
            };

            // Save to Firestore payments collection
            const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), paymentData);
            console.log('Payment saved with ID:', docRef.id);

            // Add to table
            addTransactionToTable(paymentData);

            // Close modal and reset form
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            form.reset();
            document.getElementById('date').valueAsDate = new Date();

            alert('Tranzakció sikeresen mentve!');

        } catch (error) {
            console.error('Error saving payment:', error);
            alert('Hiba történt a mentés során: ' + error.message);
        }
    });

    // Update loadTransactions function to handle search filters
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

            // Initialize statistics variables
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

                // Apply search filters
                if (filters.propertySearch && !data.property.toLowerCase().includes(filters.propertySearch)) {
                    includePayment = false;
                }

                if (filters.tenantSearch) {
                    const tenantName = (tenantsMap.get(data.tenant) || '').toLowerCase();
                    if (!tenantName.includes(filters.tenantSearch)) {
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

                if (includePayment) {
                    filteredDocs.push({ id: doc.id, data });

                    // Update monthly statistics
                    if (paymentDate.getMonth() === currentMonth && 
                        paymentDate.getFullYear() === currentYear) {
                        if (isExpenseType(data.type)) {
                            monthlyExpense += Math.abs(data.amount);
                        } else {
                            monthlyIncome += data.amount;
                        }
                    }

                    // Calculate last month's expenses for percentage change
                    if (paymentDate.getMonth() === lastMonth && 
                        paymentDate.getFullYear() === lastMonthYear && 
                        isExpenseType(data.type)) {
                        lastMonthExpense += Math.abs(data.amount);
                    }

                    // Update pending payments
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
            filteredDocs.forEach(({ id, data }) => {
                const tr = document.createElement('tr');
                const isExpense = isExpenseType(data.type);
                
                tr.innerHTML = `
                    <td>${new Date(data.date).toLocaleDateString('hu-HU')}</td>
                    <td>${getTransactionTypeName(data.type)}</td>
                    <td>${data.property}</td>
                    <td>${tenantsMap.get(data.tenant) || '-'}</td>
                    <td class="amount ${isExpense ? 'negative' : 'positive'}">
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

            // Update statistics display with trend percentage
            updateStatistics(monthlyIncome, monthlyExpense, pendingPayments, expenseChangePercent);

        } catch (error) {
            console.error('Error loading transactions:', error);
            alert('Hiba történt az adatok betöltésekor');
        }
    }

    // Helper function to check if a transaction type is an expense
    function isExpenseType(type) {
        const expenseTypes = ['tax', 'maintenance', 'utility', 'insurance'];
        return expenseTypes.includes(type);
    }

    function addTransactionToTable(id, data, tenantsMap) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(data.date)}</td>
            <td>${getTransactionTypeName(data.type)}</td>
            <td>${data.property}</td>
            <td>${tenantsMap.get(data.tenant) || '-'}</td>
            <td class="amount ${data.amount >= 0 ? 'positive' : 'negative'}">
                ${data.amount.toLocaleString()} Ft
            </td>
            <td><span class="status ${data.status}">${data.status === 'paid' ? 'Teljesítve' : 'Függőben'}</span></td>
        `;
        tbody.insertBefore(tr, tbody.firstChild);
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('hu-HU');
    }

    function getTransactionTypeName(type) {
        const types = {
            rent: 'Bérleti díj',
            maintenance: 'Karbantartás',
            utility: 'Rezsi',
            tax: 'Adó',
            insurance: 'Biztosítás',
            other: 'Egyéb'
        };
        return types[type] || type;
    }

    // Update statistics display function to include trend percentage
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

        // Update trend color based on whether expenses increased or decreased
        const trendElement = document.querySelector('.stat-card:nth-child(2) .trend');
        if (expenseChangePercent > 0) {
            trendElement.classList.add('negative');
            trendElement.classList.remove('positive');
        } else {
            trendElement.classList.add('positive');
            trendElement.classList.remove('negative');
        }
    }

    // Initialize filter dropdowns with properties and tenants
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Load properties for filter
                const propertiesRef = collection(db, 'properties');
                const propertiesQuery = query(propertiesRef, where('ownerId', '==', user.uid));
                const propertiesSnapshot = await getDocs(propertiesQuery);
                
                propertiesSnapshot.forEach(doc => {
                    const property = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = property.location;
                    propertyFilter.appendChild(option);
                });

                // Load tenants for filter
                const tenantsRef = collection(db, 'tenants');
                const tenantsQuery = query(tenantsRef, where('ownerId', '==', user.uid));
                const tenantsSnapshot = await getDocs(tenantsQuery);
                
                tenantsSnapshot.forEach(doc => {
                    const tenant = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = tenant.name;
                    tenantFilter.appendChild(option);
                });

                // Initial load with no filters
                await loadTransactions(user.uid);
            } catch (error) {
                console.error('Error initializing filters:', error);
            }
        }
    });
});
