document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase services
    const { auth } = window.fbAuth;
    const { db, collection, query, where, getDocs, doc, getDoc, updateDoc } = window.fbDb;
    const { storage, ref, uploadBytes, getDownloadURL } = window.fbStorage;

    // Initialize user display and logout functionality
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
            loadProperties();
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

    const newPropertyBtn = document.getElementById('newPropertyBtn');
    const newPropertyModal = document.getElementById('newPropertyModal');
    const closeModal = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelProperty');
    const newPropertyForm = document.getElementById('newPropertyForm');
    const imageInput = document.getElementById('propertyImage');
    const imagePreview = document.getElementById('imagePreview');

    // Open modal
    newPropertyBtn.addEventListener('click', () => {
        newPropertyModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    });

    // Close modal functions
    const closePropertyModal = () => {
        newPropertyModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Enable scrolling
        newPropertyForm.reset();
        imagePreview.innerHTML = '<i class="fas fa-upload"></i><span>Húzza ide a képet vagy kattintson a feltöltéshez</span>';
    };

    closeModal.addEventListener('click', closePropertyModal);
    cancelBtn.addEventListener('click', closePropertyModal);

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === newPropertyModal) {
            closePropertyModal();
        }
    });

    // Image preview
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.innerHTML = `<img src="${e.target.result}" alt="Property Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Form submission
    newPropertyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Show loading state
        const submitBtn = newPropertyForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            const formData = new FormData(newPropertyForm);
            
            // Get current user
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('Nincs bejelentkezett felhasználó!');
            }

            // Handle image upload first
            let imageUrl = 'propti-logo.png'; // Default image
            const imageFile = imageInput.files[0];

            if (imageFile) {
                try {
                    // Check file size (5MB limit)
                    if (imageFile.size > 5 * 1024 * 1024) {
                        throw new Error('A kép mérete túl nagy. Maximum 5MB lehet.');
                    }

                    // Check file type
                    if (!imageFile.type.startsWith('image/')) {
                        throw new Error('Csak képfájlok engedélyezettek.');
                    }

                    // Create unique filename
                    const timestamp = Date.now();
                    const fileName = `${timestamp}_${imageFile.name}`;
                    
                    // Create storage reference with correct path
                    const storageRef = ref(
                        storage, 
                        `storage/properties/${currentUser.uid}/${fileName}`
                    );
                    
                    // Upload file
                    await uploadBytes(storageRef, imageFile);
                    
                    // Get download URL
                    imageUrl = await getDownloadURL(storageRef);
                } catch (uploadError) {
                    console.error('Image upload error:', uploadError);
                    alert('Képfeltöltési hiba: ' + uploadError.message);
                }
            }

            // Prepare property data
            const propertyData = {
                location: formData.get('location'),
                tenant: formData.get('tenant'),
                size: Number(formData.get('size')),
                rent: Number(formData.get('rent')),
                isRented: formData.get('isRented') === 'true',
                imageUrl: imageUrl,
                createdAt: new Date().toISOString(),
                ownerId: currentUser.uid,
                updatedAt: new Date().toISOString()
            };

            // Save to Firestore
            const propertiesRef = collection(db, 'properties');
            await addDoc(propertiesRef, propertyData);

            // Close modal and show success message
            closePropertyModal();
            alert('Ingatlan sikeresen hozzáadva!');
            
            // Reload properties to show new addition
            await loadProperties();

        } catch (error) {
            console.error('Error adding property:', error);
            alert(error.message);
        } finally {
            // Reset loading state
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Mentés';
        }
    });

    // Helper function to add property card to UI
    function addPropertyToUI(propertyData, propertyId) {
        const propertyCard = document.createElement('div');
        propertyCard.className = 'property-card';
        propertyCard.dataset.id = propertyId;

        propertyCard.innerHTML = `
            <div class="property-image">
                <img src="${propertyData.imageUrl}" alt="${propertyData.location}" 
                     onerror="this.src='propti-logo.png'">
                <span class="status-badge ${propertyData.isRented ? 'rented' : 'vacant'}">
                    ${propertyData.isRented ? 'Kiadva' : 'Üres'}
                </span>
            </div>
            <div class="property-info">
                <h3>${propertyData.location}</h3>
                <div class="property-details">
                    <span><i class="fas fa-ruler-combined"></i> ${propertyData.size} m²</span>
                </div>
                <div class="property-metrics">
                    <div class="metric">
                        <span class="label">Bérleti díj</span>
                        <span class="value">${propertyData.rent.toLocaleString()} Ft</span>
                    </div>
                    <div class="metric">
                        <span class="label">Bérlő</span>
                        <span class="value">${propertyData.tenant || 'Nincs bérlő'}</span>
                    </div>
                </div>
            </div>
            <div class="property-actions">
                <button class="btn-icon" title="Szerkesztés" onclick="editProperty('${propertyId}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" title="Dokumentumok" onclick="showPropertyDocuments('${propertyId}')">
                    <i class="fas fa-file-alt"></i>
                </button>
                <button class="btn-icon" title="Törlés" onclick="deleteProperty('${propertyId}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        document.querySelector('.properties-grid').appendChild(propertyCard);
    }

    const propertiesGrid = document.querySelector('.properties-grid');
    const filterButtons = document.querySelectorAll('.filter-btn');
    let properties = [];

    // Load properties from Firebase
    async function loadProperties() {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.error('No user logged in');
                return;
            }

            const propertiesRef = collection(db, 'properties');
            const q = query(propertiesRef, where('ownerId', '==', currentUser.uid));
            const querySnapshot = await getDocs(q);
            const propertiesGrid = document.querySelector('.properties-grid');
            propertiesGrid.innerHTML = ''; // Clear existing content

            properties = [];
            querySnapshot.forEach((doc) => {
                const property = { id: doc.id, ...doc.data() };
                properties.push(property);
                const propertyCard = createPropertyCard(property);
                propertiesGrid.appendChild(propertyCard);
            });

            if (properties.length === 0) {
                propertiesGrid.innerHTML = '<p class="no-properties">Nincsenek még ingatlanok</p>';
            }

            updatePropertyCounts();
        } catch (error) {
            console.error('Error loading properties:', error);
            alert('Hiba történt az ingatlanok betöltése közben');
        }
    }

    // Display filtered properties
    function displayProperties(filter, searchTerm = '') {
        propertiesGrid.innerHTML = ''; // Clear existing properties
        
        let filteredProperties = properties;
        if (filter === 'rented') {
            filteredProperties = properties.filter(p => p.isRented);
        } else if (filter === 'vacant') {
            filteredProperties = properties.filter(p => !p.isRented);
        }

        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            filteredProperties = filteredProperties.filter(p =>
                p.location.toLowerCase().includes(lowerSearchTerm) ||
                (p.tenant && p.tenant.toLowerCase().includes(lowerSearchTerm))
            );
        }

        if (filteredProperties.length === 0) {
            propertiesGrid.innerHTML = '<p class="no-properties">Nincsenek ingatlanok ebben a kategóriában</p>';
            return;
        }

        filteredProperties.forEach(property => {
            const propertyCard = createPropertyCard(property);
            propertiesGrid.appendChild(propertyCard);
        });
        updatePropertyCounts();
    }

    // Create property card
    function createPropertyCard(property) {
        const card = document.createElement('div');
        card.className = 'property-card';
        card.dataset.id = property.id;

        card.innerHTML = `
            <div class="property-image">
                <img src="${property.imageUrl || 'propti-logo.png'}" 
                     alt="${property.location}"
                     onerror="this.src='propti-logo.png'">
                <span class="status-badge ${property.isRented ? 'rented' : 'vacant'}">
                    ${property.isRented ? 'Kiadva' : 'Üres'}
                </span>
            </div>
            <div class="property-info">
                <h3>${property.location}</h3>
                <div class="property-details">
                    <span><i class="fas fa-ruler-combined"></i> ${property.size} m²</span>
                </div>
                <div class="property-metrics">
                    <div class="metric">
                        <span class="label">Bérleti díj</span>
                        <span class="value">${property.rent.toLocaleString()} Ft</span>
                    </div>
                    <div class="metric">
                        <span class="label">Bérlő</span>
                        <span class="value">${property.tenant || 'Nincs bérlő'}</span>
                    </div>
                </div>
            </div>
            <div class="property-actions">
                <button class="btn-icon" title="Szerkesztés" onclick="editProperty('${property.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" title="Dokumentumok" onclick="showPropertyDocuments('${property.id}')">
                    <i class="fas fa-file-alt"></i>
                </button>
                <button class="btn-icon" title="Törlés" onclick="deleteProperty('${property.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        return card;
    }

    // Function to handle edit property
    window.editProperty = async function(propertyId) {
        const editPropertyModal = document.getElementById('editPropertyModal');
        const editPropertyForm = document.getElementById('editPropertyForm');
        const editImagePreview = document.getElementById('editImagePreview');

        // Fetch property data
        const propertyRef = doc(db, 'properties', propertyId);
        const propertySnapshot = await getDoc(propertyRef);

        if (propertySnapshot.exists()) {
            const propertyData = propertySnapshot.data();

            // Populate edit form
            document.getElementById('editPropertyId').value = propertyId;
            document.getElementById('editLocation').value = propertyData.location;
            document.getElementById('editTenant').value = propertyData.tenant || '';
            document.getElementById('editSize').value = propertyData.size;
            document.getElementById('editRent').value = propertyData.rent;
            document.getElementById('editIsRented').value = propertyData.isRented.toString();

            // Display image preview
            editImagePreview.innerHTML = propertyData.imageUrl ?
                `<img src="${propertyData.imageUrl}" alt="Property Preview">` :
                `<i class="fas fa-upload"></i><span>Húzza ide a képet vagy kattintson a feltöltéshez</span>`;

            // Show edit modal
            editPropertyModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        } else {
            console.error('Property not found');
            alert('Ingatlan nem található!');
        }
    };

    const editPropertyModal = document.getElementById('editPropertyModal');
    const editPropertyForm = document.getElementById('editPropertyForm');
    const closeEditModal = document.getElementById('closeEditModal');
    const cancelEditProperty = document.getElementById('cancelEditProperty');
    const editImagePreview = document.getElementById('editImagePreview');

    // Close modal functions
    const closeEditPropertyModal = () => {
        editPropertyModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        editPropertyForm.reset();
        editImagePreview.innerHTML = '<i class="fas fa-upload"></i><span>Húzza ide a képet vagy kattintson a feltöltéshez</span>';
    };

    closeEditModal.addEventListener('click', closeEditPropertyModal);
    cancelEditProperty.addEventListener('click', closeEditPropertyModal);

    // Close edit modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === editPropertyModal) {
            closeEditPropertyModal();
        }
    });

    // Add image preview for edit modal
    document.getElementById('editPropertyImage').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                editImagePreview.innerHTML = `<img src="${e.target.result}" alt="Property Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Edit form submission
    editPropertyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Show loading state
        const submitBtn = editPropertyForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            const formData = new FormData(editPropertyForm);
            const propertyId = document.getElementById('editPropertyId').value;

            // Handle image upload
            let imageUrl = 'propti-logo.png'; // Default image
            const imageFile = document.getElementById('editPropertyImage').files[0];

            if (imageFile) {
                try {
                    // Check file size (5MB limit)
                    if (imageFile.size > 5 * 1024 * 1024) {
                        throw new Error('A kép mérete túl nagy. Maximum 5MB lehet.');
                    }

                    // Check file type
                    if (!imageFile.type.startsWith('image/')) {
                        throw new Error('Csak képfájlok engedélyezettek.');
                    }

                    // Create unique filename
                    const timestamp = Date.now();
                    const fileName = `${timestamp}_${imageFile.name}`;

                    // Create storage reference with correct path
                    const storageRef = ref(
                        storage,
                        `storage/properties/${auth.currentUser.uid}/${fileName}`
                    );

                    // Upload file
                    await uploadBytes(storageRef, imageFile);

                    // Get download URL
                    imageUrl = await getDownloadURL(storageRef);
                } catch (uploadError) {
                    console.error('Image upload error:', uploadError);
                    alert('Képfeltöltési hiba: ' + uploadError.message);
                }
            }

            // Prepare updated property data
            const updatedPropertyData = {
                location: formData.get('location'),
                tenant: formData.get('tenant'),
                size: Number(formData.get('size')),
                rent: Number(formData.get('rent')),
                isRented: formData.get('isRented') === 'true',
                imageUrl: imageUrl,
                updatedAt: new Date().toISOString()
            };

            // Update in Firestore
            const propertyRef = doc(db, 'properties', propertyId);
            await updateDoc(propertyRef, updatedPropertyData);

            // Close modal and show success message
            closeEditPropertyModal();
            alert('Ingatlan sikeresen frissítve!');

            // Reload properties
            await loadProperties();

        } catch (error) {
            console.error('Error updating property:', error);
            alert('Hiba történt az ingatlan frissítése közben: ' + error.message);
        } finally {
            // Reset loading state
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Mentés';
        }
    });

    // Update property counts in filter buttons
    function updatePropertyCounts() {
        const counts = {
            all: properties.length,
            rented: properties.filter(p => p.isRented).length,
            vacant: properties.filter(p => !p.isRented).length
        };

        filterButtons.forEach(btn => {
            const type = btn.getAttribute('data-filter');
            if (type && counts[type] !== undefined) {
                btn.textContent = `${btn.getAttribute('data-label')} (${counts[type]})`;
            }
        });
    }

    // Filter button click handlers
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const searchTerm = document.querySelector('.search-bar input').value.trim();
            displayProperties(button.getAttribute('data-filter'), searchTerm);
        });
    });

    // Add search functionality
    const searchInput = document.querySelector('.search-bar input');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        const activeFilter = document.querySelector('.properties-filters .filter-btn.active');
        const filter = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
        displayProperties(filter, searchTerm);
    });

    // Load properties when auth state changes
    auth.onAuthStateChanged((user) => {
        if (user) {
            loadProperties();
        }
    });

    // Document viewer modal elements
    const documentViewerModal = document.getElementById('documentViewerModal');
    const closeDocumentModal = document.getElementById('closeDocumentModal');
    const documentsGrid = document.querySelector('#documentViewerModal .documents-grid');

    // Close document modal handlers
    closeDocumentModal.addEventListener('click', () => {
        documentViewerModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Close on outside click
    documentViewerModal.addEventListener('click', (e) => {
        if (e.target === documentViewerModal) {
            documentViewerModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // Function to create document card
    function createDocumentCard(doc) {
        const card = document.createElement('div');
        card.className = 'document-card';
        
        const typeIcons = {
            contract: 'file-contract',
            invoice: 'file-invoice',
            other: 'file-alt'
        };

        const typeLabels = {
            contract: 'Szerződés',
            invoice: 'Számla',
            other: 'Egyéb'
        };

        card.innerHTML = `
            <div class="document-icon">
                <i class="fas fa-${typeIcons[doc.type] || 'file-alt'}"></i>
            </div>
            <div class="document-info">
                <h3>${doc.title}</h3>
                <p class="document-meta">${new Date(doc.createdAt).toLocaleDateString('hu-HU')}</p>
                <div>
                    <span class="document-tag" data-type="${doc.type}">${typeLabels[doc.type] || 'Egyéb'}</span>
                </div>
            </div>
            <div class="document-actions">
                ${doc.downloadURL ? `
                    <button class="btn-icon" onclick="window.open('${doc.downloadURL}', '_blank')" title="Megtekintés">
                        <i class="fas fa-eye"></i>
                    </button>
                ` : ''}
            </div>
        `;
        return card;
    }

    // Function to show property documents
    async function showPropertyDocuments(propertyId) {
        try {
            const { db, collection, query, where, getDocs } = window.fbDb;
            const documentsRef = collection(db, 'documents');
            const q = query(
                documentsRef, 
                where('propertyId', '==', propertyId),
                where('ownerId', '==', auth.currentUser.uid)
            );
            
            const querySnapshot = await getDocs(q);
            documentsGrid.innerHTML = '';

            if (querySnapshot.empty) {
                documentsGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1; color: var(--gray);">Nincsenek dokumentumok ehhez az ingatlanhoz</p>';
                return;
            }

            const propertyRef = window.fbDb.doc(db, 'properties', propertyId);
            const propertySnap = await window.fbDb.getDoc(propertyRef);
            const propertyData = propertySnap.data();

            // Update modal title to include property name
            const modalTitle = document.querySelector('#documentViewerModal .modal-header h2');
            modalTitle.textContent = `Dokumentumok - ${propertyData.location}`;

            querySnapshot.forEach((doc) => {
                const documentData = { id: doc.id, ...doc.data() };
                documentsGrid.appendChild(createDocumentCard(documentData));
            });

            documentViewerModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Error loading documents:', error);
            alert('Hiba történt a dokumentumok betöltése közben');
        }
    }

    // Make showPropertyDocuments available globally
    window.showPropertyDocuments = showPropertyDocuments;

    // Add delete property function after showPropertyDocuments
    async function deleteProperty(propertyId) {
        if (!confirm('Biztosan törölni szeretné ezt az ingatlant?')) return;

        try {
            const propertyRef = window.fbDb.doc(db, 'properties', propertyId);
            const propertySnap = await window.fbDb.getDoc(propertyRef);
            
            if (!propertySnap.exists()) {
                throw new Error('Az ingatlan nem található!');
            }

            // Check if property has documents
            const documentsRef = collection(db, 'documents');
            const q = query(documentsRef, where('propertyId', '==', propertyId));
            const docsSnap = await getDocs(q);
            
            if (!docsSnap.empty) {
                throw new Error('Az ingatlan nem törölhető, mert dokumentumok vannak hozzárendelve!');
            }

            // Check if property has a tenant
            const propertyData = propertySnap.data();
            if (propertyData.isRented) {
                throw new Error('Az ingatlan nem törölhető, mert jelenleg ki van adva!');
            }

            // Delete property
            await window.fbDb.deleteDoc(propertyRef);
            
            // Reload properties to update the UI
            await loadProperties();
            alert('Ingatlan sikeresen törölve!');
        } catch (error) {
            console.error('Error deleting property:', error);
            alert(error.message);
        }
    }

    // Make deleteProperty available globally
    window.deleteProperty = deleteProperty;
});
