document.addEventListener('DOMContentLoaded', () => {
    const tenantsGrid = document.querySelector('.tenants-grid');
    const newTenantBtn = document.getElementById('newTenantBtn');
    const tenantModal = document.getElementById('newTenantModal');
    const closeModal = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelTenant');
    const newTenantForm = document.getElementById('newTenantForm');

    // Edit tenant modal elements
    const editTenantModal = document.getElementById('editTenantModal');
    const editForm = document.getElementById('editTenantForm');
    const editCloseModal = editTenantModal.querySelector('.close-modal');
    const cancelEditBtn = document.getElementById('cancelEdit');

    // Load tenants from Firebase
    async function loadTenants() {
        try {
            const currentUser = window.fbAuth.auth.currentUser;
            if (!currentUser) {
                console.error('No user logged in');
                return;
            }

            const { db, collection, query, where, getDocs } = window.fbDb;
            const tenantsRef = collection(db, 'tenants');
            const q = query(tenantsRef, where('ownerId', '==', currentUser.uid));
            const querySnapshot = await getDocs(q);

            // Clear existing tenants
            tenantsGrid.innerHTML = '';

            if (querySnapshot.empty) {
                tenantsGrid.innerHTML = '<p class="no-tenants">Nincsenek még bérlők hozzáadva</p>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const tenant = { id: doc.id, ...doc.data() };
                const tenantCard = createTenantCard(tenant);
                tenantsGrid.appendChild(tenantCard);
            });
        } catch (error) {
            console.error('Error loading tenants:', error);
        }
    }

    // Create tenant card
    function createTenantCard(tenant) {
        const card = document.createElement('div');
        card.className = 'tenant-card';
        card.dataset.id = tenant.id;

        card.innerHTML = `
            <div class="tenant-header">
                <img src="assets/avatar-placeholder.jpg" alt="Bérlő fotó">
                <div class="tenant-info">
                    <h3>${tenant.name}</h3>
                    <p>${tenant.propertyName || 'Nincs hozzárendelt ingatlan'}</p>
                    <span class="status active">Aktív</span>
                </div>
            </div>
            <div class="tenant-details">
                <div class="detail-item">
                    <span class="label">Email:</span>
                    <span>${tenant.email || 'Nincs megadva'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Telefon:</span>
                    <span>${tenant.phone || 'Nincs megadva'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Beköltözés:</span>
                    <span>${formatDate(tenant.moveInDate) || 'Nincs megadva'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Szerződés:</span>
                    <span>${tenant.contractTime || 'Nincs megadva'}</span>
                </div>
            </div>
            <div class="tenant-actions">
                <button class="btn-icon edit-tenant" title="Szerkesztés">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" title="Dokumentumok">
                    <i class="fas fa-file-alt"></i>
                </button>
                <button class="btn-icon" title="Több">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;

        // Add edit button click handler
        card.querySelector('.edit-tenant').addEventListener('click', () => handleEditClick(tenant));

        return card;
    }

    // Helper function to format dates
    function formatDate(date) {
        if (!date) return null;
        return new Date(date).toLocaleDateString('hu-HU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    // Modal handlers
    newTenantBtn.addEventListener('click', () => {
        tenantModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    });

    const closeModalHandler = () => {
        tenantModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        newTenantForm.reset();
    };

    closeModal.addEventListener('click', closeModalHandler);
    cancelBtn.addEventListener('click', closeModalHandler);

    // Form submission
    newTenantForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            const formData = new FormData(newTenantForm);
            const tenantData = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                propertyName: formData.get('propertyName'),
                moveInDate: formData.get('moveInDate'),
                contractTime: formData.get('contractTime'),
                createdAt: new Date().toISOString(),
                ownerId: window.fbAuth.auth.currentUser.uid
            };

            // Save to Firestore
            const { db, collection, addDoc } = window.fbDb;
            const tenantsRef = collection(db, 'tenants');
            await addDoc(tenantsRef, tenantData);

            closeModalHandler();
            await loadTenants();
            alert('Bérlő sikeresen hozzáadva!');
        } catch (error) {
            console.error('Error adding tenant:', error);
            alert('Hiba történt a bérlő mentése közben: ' + error.message);
        }
    });

    // Function to handle edit button click
    function handleEditClick(tenant) {
        // Populate edit form with tenant data
        document.getElementById('editTenantId').value = tenant.id;
        document.getElementById('editName').value = tenant.name;
        document.getElementById('editEmail').value = tenant.email || '';
        document.getElementById('editPhone').value = tenant.phone || '';
        document.getElementById('editPropertyName').value = tenant.propertyName || '';
        document.getElementById('editMoveInDate').value = tenant.moveInDate || '';
        document.getElementById('editContractTime').value = tenant.contractTime || '';

        // Show edit modal
        editTenantModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    // Close edit modal handlers
    const closeEditModal = () => {
        editTenantModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        editForm.reset();
    };

    editCloseModal.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);

    // Edit form submission
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            const formData = new FormData(editForm);
            const tenantId = formData.get('tenantId');
            const updatedData = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                propertyName: formData.get('propertyName'),
                moveInDate: formData.get('moveInDate'),
                contractTime: formData.get('contractTime'),
                updatedAt: new Date().toISOString()
            };

            const { db, doc, updateDoc } = window.fbDb;
            const tenantRef = doc(db, 'tenants', tenantId);
            await updateDoc(tenantRef, updatedData);

            closeEditModal();
            await loadTenants(); // Reload tenants to show updated data
            alert('Bérlő adatai sikeresen frissítve!');
        } catch (error) {
            console.error('Error updating tenant:', error);
            alert('Hiba történt a bérlő adatainak frissítése közben: ' + error.message);
        }
    });

    // Load tenants when auth state changes
    window.fbAuth.auth.onAuthStateChanged((user) => {
        if (user) {
            loadTenants();
        }
    });

    // Initialize Firebase with updateDoc
    window.fbDb = { 
        ...window.fbDb, 
        doc: window.fbDb.db.doc || window.fbDb.doc,
        updateDoc: window.fbDb.db.updateDoc || window.fbDb.updateDoc 
    };
});
