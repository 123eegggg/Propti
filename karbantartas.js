import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, addDoc, query, where, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

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
const storage = getStorage(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    // Get modal elements
    const modalBackdrop = document.querySelector('.modal-backdrop');
    const newTaskBtn = document.querySelector('.btn-new-task');
    const closeModalBtn = document.querySelector('.close-modal');
    const cancelBtn = document.querySelector('.btn-cancel');
    const maintenanceForm = document.getElementById('maintenance-form');

    // Modal functions
    function openModal() {
        modalBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modalBackdrop.classList.remove('active');
        document.body.style.overflow = 'auto';
        maintenanceForm.reset();
        document.getElementById('imagePreviewContainer').innerHTML = '';
    }

    // Event listeners
    newTaskBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close modal when clicking outside
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
            closeModal();
        }
    });

    // Prevent click inside modal from closing it
    modalBackdrop.querySelector('.modal').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Form submission handler
    maintenanceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        try {
            const formData = {
                title: document.getElementById('title').value,
                location: document.getElementById('location').value,
                priority: document.getElementById('priority').value,
                description: document.getElementById('description').value,
                status: 'pending',
                createdAt: new Date().toISOString(),
                ownerId: user.uid,
                images: []
            };

            // Handle image uploads
            const files = document.getElementById('images').files;
            if (files.length > 0) {
                const imageUrls = await Promise.all(
                    Array.from(files).map(async (file) => {
                        const storageRef = ref(storage, `maintenance/${user.uid}/${Date.now()}-${file.name}`);
                        const snapshot = await uploadBytes(storageRef, file);
                        return await getDownloadURL(snapshot.ref);
                    })
                );
                formData.images = imageUrls;
            }

            // Save to Firestore
            await addDoc(collection(db, 'maintenance'), formData);
            closeModal();
            loadMaintenanceTasks();

        } catch (error) {
            console.error('Error saving maintenance task:', error);
            alert('Hiba történt a mentés során');
        }
    });

    // Load maintenance tasks
    async function loadMaintenanceTasks() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const q = query(
                collection(db, 'maintenance'),
                where('ownerId', '==', user.uid),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const maintenanceGrid = document.querySelector('.maintenance-grid');

            if (querySnapshot.empty) {
                maintenanceGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-clipboard-list"></i>
                        <h3>Nincsenek karbantartási feladatok</h3>
                        <p>Az új feladat hozzáadásához kattintson az "Új Feladat" gombra</p>
                    </div>
                `;
                return;
            }

            maintenanceGrid.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const task = doc.data();
                maintenanceGrid.appendChild(createTaskCard(task));
            });
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    function createTaskCard(task) {
        const div = document.createElement('div');
        div.className = `maintenance-card ${task.priority === 'urgent' ? 'urgent' : ''}`;
        div.innerHTML = `
            <div class="maintenance-header">
                <span class="priority-badge">${task.priority === 'urgent' ? 'Sürgős' : 'Normál'}</span>
                <span class="status">${task.status}</span>
            </div>
            <h3>${task.title}</h3>
            <p class="location"><i class="fas fa-map-marker-alt"></i> ${task.location}</p>
            <p class="description">${task.description}</p>
            ${task.images.length > 0 ? `
                <div class="task-images">
                    ${task.images.map(url => `
                        <img src="${url}" alt="Maintenance image" onclick="window.open('${url}', '_blank')">
                    `).join('')}
                </div>
            ` : ''}
            <div class="task-meta">
                <span><i class="fas fa-calendar"></i> ${new Date(task.createdAt).toLocaleDateString('hu-HU')}</span>
            </div>
        `;
        return div;
    }

    // Check authentication and load tasks
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadMaintenanceTasks();
        } else {
            window.location.href = 'index.html';
        }
    });
});
