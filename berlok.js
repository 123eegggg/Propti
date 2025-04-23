document.addEventListener('DOMContentLoaded', () => {
    const { auth } = window.fbAuth;
    const { db, doc, getDoc } = window.fbDb;
    const userDisplayNameElement = document.getElementById('userDisplayName');
    const logoutBtn = document.getElementById('logoutBtn');

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
            // Initialize other berlok.js functionality here
            await loadTenants();
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
            let q = query(tenantsRef, where('ownerId', '==', currentUser.uid));
            const querySnapshot = await getDocs(q);

            // Clear existing tenants
            tenantsGrid.innerHTML = '';

            if (querySnapshot.empty) {
                tenantsGrid.innerHTML = '<p class="no-tenants">Nincsenek még bérlők hozzáadva</p>';
                return;
            }

            let tenants = [];
            querySnapshot.forEach((doc) => {
                tenants.push({ id: doc.id, ...doc.data() });
            });

            tenants.forEach(tenant => {
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
    newTenantBtn.addEventListener('click', async () => {
        await loadProperties();
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
            const propertyId = formData.get('propertyName');
            
            // Get property details
            const { db, doc, getDoc } = window.fbDb;
            const propertyRef = doc(db, 'properties', propertyId);
            const propertySnap = await getDoc(propertyRef);
            const propertyData = propertySnap.data();

            const tenantData = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                propertyId: propertyId, // Store property ID
                propertyName: propertyData.location, // Store property location
                moveInDate: formData.get('moveInDate'),
                contractTime: formData.get('contractTime'),
                createdAt: new Date().toISOString(),
                ownerId: window.fbAuth.auth.currentUser.uid
            };

            // Save to Firestore
            const { collection, addDoc } = window.fbDb;
            const tenantsRef = collection(db, 'tenants');
            await addDoc(tenantsRef, tenantData);

            // Update property's tenant and isRented status
            await updateDoc(propertyRef, {
                tenant: formData.get('name'),
                isRented: true,
                updatedAt: new Date().toISOString()
            });

            closeModalHandler();
            await loadTenants();
            alert('Bérlő sikeresen hozzáadva!');
        } catch (error) {
            console.error('Error adding tenant:', error);
            alert('Hiba történt a bérlő mentése közben: ' + error.message);
        }
    });

    // Function to handle edit button click
    async function handleEditClick(tenant) {
        await loadProperties();
        
        // Get the currently assigned property
        const currentPropertyId = tenant.propertyId;
        const dropdown = document.getElementById('editPropertyName');

        // Ensure the current property is visible in dropdown even if rented
        const options = Array.from(dropdown.options);
        const currentPropertyOption = options.find(option => option.value === currentPropertyId);
        
        // Set the selected property
        if (currentPropertyOption) {
            currentPropertyOption.selected = true;
        }

        // Populate rest of the form
        document.getElementById('editTenantId').value = tenant.id;
        document.getElementById('editName').value = tenant.name;
        document.getElementById('editEmail').value = tenant.email || '';
        document.getElementById('editPhone').value = tenant.phone || '';
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
            const newPropertyId = formData.get('propertyName');
            
            // Get property details
            const { db, doc, getDoc, updateDoc } = window.fbDb;  // Add updateDoc here
            const propertyRef = doc(db, 'properties', newPropertyId);
            const propertySnap = await getDoc(propertyRef);
            const propertyData = propertySnap.data();

            // Check if there was a previous property
            const tenantRef = doc(db, 'tenants', tenantId);
            const tenantSnap = await getDoc(tenantRef);
            const oldPropertyId = tenantSnap.data().propertyId;

            // If property changed, update old property to vacant
            if (oldPropertyId && oldPropertyId !== newPropertyId) {
                const oldPropertyRef = doc(db, 'properties', oldPropertyId);
                await updateDoc(oldPropertyRef, {
                    tenant: '',
                    isRented: false,
                    updatedAt: new Date().toISOString()
                });
            }

            const updatedData = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                propertyId: newPropertyId,
                propertyName: propertyData.location,
                moveInDate: formData.get('moveInDate'),
                contractTime: formData.get('contractTime'),
                updatedAt: new Date().toISOString()
            };

            // Update tenant
            await updateDoc(tenantRef, updatedData);

            // Update new property
            await updateDoc(propertyRef, {
                tenant: formData.get('name'),
                isRented: true,
                updatedAt: new Date().toISOString()
            });

            closeEditModal();
            await loadTenants();
            alert('Bérlő adatai sikeresen frissítve!');
        } catch (error) {
            console.error('Error updating tenant:', error);
            alert('Hiba történt a bérlő adatainak frissítése közben: ' + error.message);
        }
    });

    // Add new function to load properties
    async function loadProperties() {
        try {
            const currentUser = window.fbAuth.auth.currentUser;
            if (!currentUser) return;

            const { db, collection, query, where, getDocs } = window.fbDb;
            const propertiesRef = collection(db, 'properties');
            // Only filter by owner, show all properties
            const q = query(propertiesRef, where('ownerId', '==', currentUser.uid));
            const querySnapshot = await getDocs(q);

            const properties = [];
            querySnapshot.forEach((doc) => {
                properties.push({ id: doc.id, ...doc.data() });
            });

            // Populate both property dropdowns
            const dropdowns = ['propertyName', 'editPropertyName'];
            dropdowns.forEach(dropdownId => {
                const dropdown = document.getElementById(dropdownId);
                if (dropdown) {
                    dropdown.innerHTML = '<option value="">Válasszon ingatlant...</option>';
                    properties.forEach(property => {
                        // Add rental status and current tenant info in the dropdown
                        const rentedStatus = property.isRented ? 
                            `(Kiadva - ${property.tenant || 'Névtelen bérlő'})` : 
                            '(Üres)';
                        dropdown.innerHTML += `
                            <option value="${property.id}" ${property.isRented ? 'class="rented-property"' : ''}>
                                ${property.location} ${rentedStatus}
                            </option>
                        `;
                    });
                }
            });

            return properties;
        } catch (error) {
            console.error('Error loading properties:', error);
            return [];
        }
    }

    // Initialize Firebase with additional methods
    window.fbDb = {
        ...window.fbDb,
        doc: window.fbDb.db.doc || window.fbDb.doc,
        getDoc: window.fbDb.db.getDoc || window.fbDb.getDoc,
        updateDoc: window.fbDb.db.updateDoc || window.fbDb.updateDoc
    };
});
