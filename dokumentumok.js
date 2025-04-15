document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const uploadBtn = document.querySelector('.upload-btn');
    const modal = document.getElementById('newDocumentModal');
    const closeModal = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelDocument');
    const documentForm = document.getElementById('newDocumentForm');
    const documentsGrid = document.querySelector('.documents-grid');

    // Open modal
    uploadBtn.addEventListener('click', async () => {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        await loadPropertiesForSelect(); // Load properties when opening modal
    });

    // Close modal functions
    const closeDocumentModal = () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        documentForm.reset();
    };

    closeModal.addEventListener('click', closeDocumentModal);
    cancelBtn.addEventListener('click', closeDocumentModal);

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDocumentModal();
        }
    });

    // Initialize Firebase references
    const { db, collection, addDoc, query, where, getDocs } = window.fbDb;
    const storage = window.fbStorage.storage;
    const documentsRef = collection(db, 'documents');

    // Load documents immediately if user is authenticated
    const currentUser = window.fbAuth.auth.currentUser;
    if (currentUser) {
        try {
            await loadDocuments();
        } catch (error) {
            console.error('Error loading initial documents:', error);
        }
    }

    // Ensure documents are loaded when auth state changes
    window.fbAuth.auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                await loadDocuments();
            } catch (error) {
                console.error('Error loading documents after auth:', error);
            }
        } else {
            window.location.href = 'index.html'; // Redirect if not logged in
        }
    });

    // Add function to load properties into select
    async function loadPropertiesForSelect(selectId = 'propertySelect') {
        try {
            const user = window.fbAuth.auth.currentUser;
            if (!user) return;

            const propertiesRef = collection(window.fbDb.db, 'properties');
            const q = query(propertiesRef, where('ownerId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            
            const propertySelect = document.getElementById(selectId);
            propertySelect.innerHTML = '<option value="">Válasszon ingatlant...</option>';
            
            querySnapshot.forEach((doc) => {
                const property = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = property.location;
                propertySelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading properties:', error);
        }
    }

    // Form submission handler
    documentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = documentForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            const user = window.fbAuth.auth.currentUser;
            if (!user) throw new Error('No user logged in');

            const formData = new FormData(documentForm);
            const propertySelect = document.getElementById('propertySelect');
            const propertyLocation = propertySelect.options[propertySelect.selectedIndex].text;

            // Save document data to Firestore
            const documentData = {
                title: formData.get('title'),
                type: formData.get('type'),
                propertyId: formData.get('propertyId'),
                propertyLocation: propertyLocation,
                isSigned: formData.get('isSigned') === 'true',
                createdAt: new Date().toISOString(),
                ownerId: user.uid
            };

            await addDoc(documentsRef, documentData);
            closeDocumentModal();
            loadDocuments(); // Refresh the list
            alert('Dokumentum sikeresen mentve!');

        } catch (error) {
            console.error('Error:', error);
            alert('Hiba történt a mentés során: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Mentés';
        }
    });

    // Load documents with optional filter
    async function loadDocuments(filterType = 'all') {
        try {
            const user = window.fbAuth.auth.currentUser;
            if (!user) return;

            const q = query(documentsRef, where('ownerId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            const documents = [];

            querySnapshot.forEach((doc) => {
                documents.push({ ...doc.data(), id: doc.id });
            });

            // Update filter buttons count
            const counts = {
                all: documents.length,
                contract: documents.filter(doc => doc.type === 'contract').length,
                invoice: documents.filter(doc => doc.type === 'invoice').length,
                other: documents.filter(doc => doc.type === 'other').length
            };

            document.querySelectorAll('.filter-btn').forEach(btn => {
                const type = btn.textContent.split(' ')[0].toLowerCase();
                const count = type === 'összes' ? counts.all : 
                            type === 'szerződések' ? counts.contract :
                            type === 'számlák' ? counts.invoice : counts.other;
                btn.textContent = `${btn.textContent.split(' ')[0]} (${count})`;
            });

            // Filter documents
            const filteredDocs = filterType === 'all' ? 
                documents : 
                documents.filter(doc => doc.type === filterType);

            // Display documents
            const documentsGrid = document.querySelector('.documents-grid');
            documentsGrid.innerHTML = '';

            if (filteredDocs.length === 0) {
                documentsGrid.innerHTML = '<p class="no-documents">Nincsenek még dokumentumok</p>';
                return;
            }

            filteredDocs.forEach(doc => {
                documentsGrid.appendChild(createDocumentCard(doc, doc.id));
            });

        } catch (error) {
            console.error('Error loading documents:', error);
            document.querySelector('.documents-grid').innerHTML = 
                '<p class="error">Hiba történt a dokumentumok betöltése közben</p>';
        }
    }

    // Create document card
    function createDocumentCard(doc, docId) {
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
                <p class="document-meta">
                    ${new Date(doc.createdAt).toLocaleDateString('hu-HU')}
                </p>
                <p class="property-info">${doc.propertyLocation || 'Nincs ingatlan'}</p>
                <div>
                    <span class="document-tag">${typeLabels[doc.type] || 'Egyéb'}</span>
                    <span class="signed-status ${!doc.isSigned ? 'unsigned' : ''}">
                        ${doc.isSigned ? 'Aláírva' : 'Nincs aláírva'}
                    </span>
                </div>
            </div>
            <div class="document-actions">
                <button class="btn-icon" onclick="editDocument('${docId}')" title="Szerkesztés">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="deleteDocument('${docId}')" title="Törlés">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;

        return card;
    }

    // Add edit document functionality
    window.editDocument = async (documentId) => {
        const editModal = document.getElementById('editDocumentModal');
        const editForm = document.getElementById('editDocumentForm');
        
        try {
            const docRef = window.fbDb.doc(window.fbDb.db, 'documents', documentId);
            const docSnap = await window.fbDb.getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Load properties for select
                await loadPropertiesForSelect('editPropertySelect');
                
                // Set form values
                document.getElementById('editDocumentId').value = documentId;
                document.getElementById('editDocumentTitle').value = data.title;
                document.getElementById('editDocumentType').value = data.type;
                document.getElementById('editPropertySelect').value = data.propertyId || '';
                document.getElementById('editIsSigned').value = (data.isSigned === true).toString(); // Fixed this line
                
                // Show modal
                editModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            console.error('Error loading document for edit:', error);
            alert('Hiba történt a dokumentum betöltésekor');
        }
    };

    // Edit form submission handler
    document.getElementById('editDocumentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            const user = window.fbAuth.auth.currentUser;
            if (!user) throw new Error('No user logged in');

            const formData = new FormData(e.target);
            const documentId = formData.get('documentId');
            const propertySelect = document.getElementById('editPropertySelect');
            const propertyLocation = propertySelect.options[propertySelect.selectedIndex].text;

            const documentData = {
                title: formData.get('title'),
                type: formData.get('type'),
                propertyId: formData.get('propertyId'),
                propertyLocation: propertyLocation,
                isSigned: formData.get('isSigned') === 'true',
                updatedAt: new Date().toISOString()
            };

            const docRef = window.fbDb.doc(window.fbDb.db, 'documents', documentId);
            await window.fbDb.updateDoc(docRef, documentData);
            
            document.getElementById('editDocumentModal').style.display = 'none';
            document.body.style.overflow = 'auto';
            await loadDocuments();
            alert('Dokumentum sikeresen módosítva!');

        } catch (error) {
            console.error('Error:', error);
            alert('Hiba történt a mentés során: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Mentés';
        }
    });

    // Edit modal close handlers
    document.getElementById('cancelEditDocument').addEventListener('click', () => {
        document.getElementById('editDocumentModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    document.getElementById('editDocumentModal').querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('editDocumentModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Delete document function
    window.deleteDocument = async (documentId) => {
        if (!confirm('Biztosan törölni szeretné ezt a dokumentumot?')) return;

        try {
            const docRef = window.fbDb.doc(window.fbDb.db, 'documents', documentId);
            await window.fbDb.deleteDoc(docRef);
            await loadDocuments();
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Hiba történt a dokumentum törlésekor');
        }
    };

    // Load documents when auth state changes
    window.fbAuth.auth.onAuthStateChanged((user) => {
        if (user) {
            loadDocuments();
        }
    });

    // Update filter button handlers
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filterType = btn.textContent.split(' ')[0].toLowerCase();
            const type = filterType === 'összes' ? 'all' : 
                        filterType === 'szerződések' ? 'contract' :
                        filterType === 'számlák' ? 'invoice' : 'other';
            loadDocuments(type);
        });
    });

    // Add search functionality
    const searchInput = document.querySelector('.search-bar input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.document-card');
            cards.forEach(card => {
                const title = card.querySelector('h3').textContent.toLowerCase();
                const type = card.querySelector('.document-tag').textContent.toLowerCase();
                const property = card.querySelector('.property-info').textContent.toLowerCase();
                const signStatus = card.querySelector('.signed-status').textContent.toLowerCase();
                
                card.style.display = 
                    title.includes(searchTerm) || 
                    type.includes(searchTerm) || 
                    property.includes(searchTerm) ||
                    signStatus.includes(searchTerm) ? 'flex' : 'none';
            });
        }, 300);
    });
});
