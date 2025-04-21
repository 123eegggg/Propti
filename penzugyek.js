import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

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

    // Load existing transactions
    async function loadTransactions(userId) {
        try {
            const q = query(
                collection(db, PAYMENTS_COLLECTION),
                where('ownerId', '==', userId),
                orderBy('date', 'desc')
            );

            const querySnapshot = await getDocs(q);
            tbody.innerHTML = '';

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                addTransactionToTable(data);
            });

        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    function addTransactionToTable(data) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(data.date)}</td>
            <td>${getTransactionTypeName(data.type)}</td>
            <td>${data.property}</td>
            <td>${data.tenant || '-'}</td>
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
});
