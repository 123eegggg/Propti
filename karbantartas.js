import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, addDoc, query, where, orderBy, getDocs, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
    const userDisplayNameElement = document.getElementById('userDisplayName');
    const logoutBtn = document.getElementById('logoutBtn');

    // Update user display name
    onAuthStateChanged(auth, async (user) => {
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

            await Promise.all([
                loadMaintenanceTasks(),
                loadMaintenancePayments(user.uid)
            ]);
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

    // Get modal elements
    const modalBackdrop = document.querySelector('.modal-backdrop');
    const newTaskBtn = document.querySelector('.btn-new-task');
    const closeModalBtn = document.querySelector('.close-modal');
    const cancelBtn = document.querySelector('.btn-cancel');
    const maintenanceForm = document.getElementById('maintenance-form');
    const editForm = document.getElementById('edit-form');

    function closeModal() {
        modalBackdrop.classList.remove('active');
        document.body.style.overflow = 'auto';
        maintenanceForm.reset();
        document.getElementById('imagePreviewContainer').innerHTML = '';
    }

    // Update the editTask function
    window.editTask = async (taskId) => {
        try {
            const taskDoc = doc(db, 'maintenance', taskId);
            const taskSnapshot = await getDoc(taskDoc);
            
            if (!taskSnapshot.exists()) {
                throw new Error('Task not found');
            }

            const taskData = taskSnapshot.data();
            
            // Set form values
            document.getElementById('editTaskId').value = taskId;
            document.getElementById('editTitle').value = taskData.title;
            document.getElementById('editPriority').value = taskData.priority;
            document.getElementById('editStatus').value = taskData.status;
            document.getElementById('editDescription').value = taskData.description;

            // Show edit modal
            document.getElementById('editModal').classList.add('active');
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Error loading task:', error);
            alert('Hiba történt a feladat betöltésekor');
        }
    };

    // Event listeners
    newTaskBtn.addEventListener('click', async () => {
        modalBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Reset form
        maintenanceForm.reset();
    });
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
        
        const submitBtn = maintenanceForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            const formData = {
                title: document.getElementById('title').value,
                priority: document.getElementById('priority').value,
                description: document.getElementById('description').value,
                status: document.getElementById('status').value || 'in_progress',
                paymentId: document.getElementById('payment').value || null,
                createdAt: new Date().toISOString(),
                ownerId: auth.currentUser.uid,
                images: [],
                documents: []
            };

            // Handle file uploads
            const files = document.getElementById('images').files;
            if (files.length > 0) {
                const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
                const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');

                // Upload images
                if (imageFiles.length > 0) {
                    const imageUrls = await Promise.all(
                        imageFiles.map(async (file) => {
                            const storageRef = ref(storage, `storage/${auth.currentUser.uid}/maintenance/${Date.now()}-${file.name}`);
                            const snapshot = await uploadBytes(storageRef, file);
                            return await getDownloadURL(snapshot.ref);
                        })
                    );
                    formData.images = imageUrls;
                }

                // Upload PDFs
                if (pdfFiles.length > 0) {
                    const pdfUrls = await Promise.all(
                        pdfFiles.map(async (file) => {
                            const storageRef = ref(storage, `storage/${auth.currentUser.uid}/documents/${Date.now()}-${file.name}`);
                            const snapshot = await uploadBytes(storageRef, file);
                            const url = await getDownloadURL(snapshot.ref);
                            return {
                                url: url,
                                name: file.name,
                                type: 'pdf'
                            };
                        })
                    );
                    formData.documents = pdfUrls;
                }
            }

            // Save to Firestore
            await addDoc(collection(db, 'maintenance'), formData);
            closeModal();
            await loadMaintenanceTasks();
            alert('Feladat sikeresen hozzáadva!');

        } catch (error) {
            console.error('Error saving maintenance task:', error);
            alert('Hiba történt a mentés során: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Mentés';
        }
    });

    // Update edit form submission
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            const formData = new FormData(editForm);
            const taskId = formData.get('taskId');

            const updatedData = {
                title: formData.get('title'),
                priority: formData.get('priority'),
                status: formData.get('status'),
                description: formData.get('description'),
                paymentId: formData.get('payment') || null,
                updatedAt: new Date().toISOString()
            };

            const taskRef = doc(db, 'maintenance', taskId);
            await updateDoc(taskRef, updatedData);

            closeEditModal();
            await loadMaintenanceTasks();
            alert('Feladat sikeresen frissítve!');
        } catch (error) {
            console.error('Error updating task:', error);
            alert('Hiba történt a frissítés során: ' + error.message);
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
        const statusText = {
            'in_progress': 'Folyamatban',
            'completed': 'Befejezett'
        };

        const statusClass = {
            'in_progress': 'in_progress',
            'completed': 'completed'
        };

        div.className = `maintenance-card ${task.priority === 'urgent' ? 'urgent' : ''} ${statusClass[task.status] || ''}`;
        div.innerHTML = `
            <div class="maintenance-header">
                <span class="priority-badge">${task.priority === 'urgent' ? 'Sürgős' : 'Normál'}</span>
                <span class="status">${statusText[task.status] || task.status}</span>
            </div>
            <h3>${task.title}</h3>
            <p class="description">${task.description}</p>
            ${task.images.length > 0 ? `
                <div class="task-images">
                    ${task.images.map(url => `
                        <img src="${url}" alt="Maintenance image" onclick="window.open('${url}', '_blank')">
                    `).join('')}
                </div>
            ` : ''}
            ${task.documents && task.documents.length > 0 ? `
                <div class="task-documents">
                    ${task.documents.map(doc => `
                        <a href="${doc.url}" target="_blank" class="document-link">
                            <i class="fas fa-file-pdf"></i>
                            ${doc.name}
                        </a>
                    `).join('')}
                </div>
            ` : ''}
            <div class="task-meta">
                <span><i class="fas fa-calendar"></i> ${new Date(task.createdAt).toLocaleDateString('hu-HU')}</span>
            </div>
        `;
        return div;
    }
});
