document.addEventListener('DOMContentLoaded', () => {
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

        try {
            const formData = new FormData(newPropertyForm);
            
            // Get current user
            const currentUser = window.fbAuth.auth.currentUser;
            if (!currentUser) {
                throw new Error('Nincs bejelentkezett felhasználó!');
            }

            const propertyData = {
                location: formData.get('location'),
                tenant: formData.get('tenant'),
                size: Number(formData.get('size')),
                rent: Number(formData.get('rent')),
                isRented: formData.get('isRented') === 'true',
                createdAt: new Date().toISOString(),
                ownerId: currentUser.uid,
                updatedAt: new Date().toISOString()
            };

            // Handle image upload
            const imageFile = formData.get('propertyImage');
            if (imageFile && imageFile.size > 0) {
                try {
                    const storage = window.fbStorage.storage;
                    const storageRef = window.fbStorage.ref(storage, `properties/${currentUser.uid}/${Date.now()}_${imageFile.name}`);
                    await window.fbStorage.uploadBytes(storageRef, imageFile);
                    propertyData.imageUrl = await window.fbStorage.getDownloadURL(storageRef);
                } catch (uploadError) {
                    console.error('Image upload error:', uploadError);
                    propertyData.imageUrl = 'assets/default-property.jpg'; // Fallback image
                }
            } else {
                propertyData.imageUrl = 'assets/default-property.jpg'; // Default image if none provided
            }

            // Save to Firestore
            const { db, collection, addDoc } = window.fbDb;
            const propertiesRef = collection(db, 'properties');
            const docRef = await addDoc(propertiesRef, propertyData);

            // Add property card to UI
            addPropertyToUI(propertyData, docRef.id);
            
            // Close modal and show success message
            closePropertyModal();
            alert('Ingatlan sikeresen hozzáadva!');
            
            // Reload properties after adding new one
            await loadProperties();
        } catch (error) {
            console.error('Error adding property:', error);
            alert('Hiba történt az ingatlan mentése közben: ' + error.message);
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
                     onerror="this.src='assets/default-property.jpg'">
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
                <button class="btn-icon" title="Szerkesztés"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" title="Dokumentumok"><i class="fas fa-file-alt"></i></button>
                <button class="btn-icon" title="Több"><i class="fas fa-ellipsis-v"></i></button>
            </div>
        `;

        document.querySelector('.properties-grid').appendChild(propertyCard);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const propertiesGrid = document.querySelector('.properties-grid');
    const filterButtons = document.querySelectorAll('.filter-btn');
    let properties = [];

    // Initialize Firebase references
    const { db, collection, query, where, getDocs } = window.fbDb;

    // Load properties from Firebase
    async function loadProperties() {
        try {
            const currentUser = window.fbAuth.auth.currentUser;
            if (!currentUser) {
                console.error('No user logged in');
                return;
            }

            const propertiesRef = collection(db, 'properties');
            const q = query(propertiesRef, where('ownerId', '==', currentUser.uid));
            const querySnapshot = await getDocs(q);

            properties = [];
            querySnapshot.forEach((doc) => {
                properties.push({ id: doc.id, ...doc.data() });
            });

            console.log('Loaded properties:', properties); // Debug log
            updatePropertyCounts();
            displayProperties('all');
        } catch (error) {
            console.error('Error loading properties:', error);
        }
    }

    // Display filtered properties
    function displayProperties(filter) {
        propertiesGrid.innerHTML = ''; // Clear existing properties
        
        let filteredProperties = properties;
        if (filter === 'rented') {
            filteredProperties = properties.filter(p => p.isRented);
        } else if (filter === 'vacant') {
            filteredProperties = properties.filter(p => !p.isRented);
        }

        if (filteredProperties.length === 0) {
            propertiesGrid.innerHTML = '<p class="no-properties">Nincsenek ingatlanok ebben a kategóriában</p>';
            return;
        }

        filteredProperties.forEach(property => {
            const propertyCard = createPropertyCard(property);
            propertiesGrid.appendChild(propertyCard);
        });
    }

    // Create property card
    function createPropertyCard(property) {
        const card = document.createElement('div');
        card.className = 'property-card';
        card.dataset.id = property.id;

        card.innerHTML = `
            <div class="property-image">
                <img src="${property.imageUrl || 'assets/default-property.jpg'}" 
                     alt="${property.location}"
                     onerror="this.src='assets/default-property.jpg'">
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
                <button class="btn-icon" title="Dokumentumok">
                    <i class="fas fa-file-alt"></i>
                </button>
                <button class="btn-icon" title="Több">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;

        return card;
    }

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
            displayProperties(button.getAttribute('data-filter'));
        });
    });

    // Load properties when auth state changes
    window.fbAuth.auth.onAuthStateChanged((user) => {
        if (user) {
            loadProperties();
        }
    });

    // Reload properties after adding a new one
    const newPropertyForm = document.getElementById('newPropertyForm');
    newPropertyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            // ... existing form submission code ...
            
            // Reload properties after successful submission
            await loadProperties();
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    });
});
