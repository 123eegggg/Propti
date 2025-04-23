document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase references
    const { db, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } = window.fbDb;
    const documentsRef = collection(db, 'documents');

    // Initialize user display and logout functionality
    const { auth } = window.fbAuth;
    const userDisplayNameElement = document.getElementById('userDisplayName');
    const logoutBtn = document.getElementById('logoutBtn');

    // Single auth state handler that manages both user display and document loading
    auth.onAuthStateChanged(async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    userDisplayNameElement.textContent = userDoc.data().fullName || user.email;
                } else {
                    userDisplayNameElement.textContent = user.email;
                }
                await loadDocuments(); // Load documents after confirming user
            } catch (error) {
                console.error('Error in auth state change:', error);
                userDisplayNameElement.textContent = user.email;
            }
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

    // Define edit document function first, before it's used in event handlers
    window.editDocument = async (documentId) => {
        // Removed duplicate declaration of editModal
        const editForm = document.getElementById('editDocumentForm');
        
        try {
            const docRef = doc(db, 'documents', documentId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Load properties for select
                await loadPropertiesForSelect('editPropertySelect');
                
                // Set form values
                document.getElementById('editDocumentId').value = documentId;
                document.getElementById('editDocumentTitle').value = data.title;
                document.getElementById('editDocumentType').value = data.type;
                document.getElementById('editPropertySelect').value = data.propertyId || '';
                document.getElementById('editIsSigned').value = (data.isSigned === true).toString();

                // Update file preview if exists
                const currentFileText = document.querySelector('#editFilePreview .current-file');
                if (data.downloadURL) {
                    currentFileText.style.display = 'block';
                    currentFileText.querySelector('span').textContent = 'PDF dokumentum feltöltve';
                } else {
                    currentFileText.style.display = 'none';
                }
                
                // Show modal
                editModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            console.error('Error loading document for edit:', error);
            alert('Hiba történt a dokumentum betöltésekor');
        }
    };

    // Get DOM elements
    const uploadBtn = document.querySelector('.upload-btn');
    const modal = document.getElementById('newDocumentModal');
    const closeModal = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelDocument');
    const documentForm = document.getElementById('newDocumentForm');
    const documentsGrid = document.querySelector('.documents-grid');

    // Edit modal elements
    // Removed duplicate declaration of editModal
    // Removed duplicate declaration of cancelEditBtn

    // Add edit modal close handlers
    editCloseBtn?.addEventListener('click', closeEditModal);
    cancelEditBtn?.addEventListener('click', closeEditModal);

    // Close on outside click for edit modal
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });

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

    // Add file preview functionality
    const fileInput = document.getElementById('documentFile');
    const filePreview = document.getElementById('filePreview');
    const editFileInput = document.getElementById('editDocumentFile');
    const editFilePreview = document.getElementById('editFilePreview');

    function updateFilePreview(input, preview) {
        const file = input.files[0];
        if (file) {
            const previewText = preview.querySelector('p');
            const icon = preview.querySelector('i');
            icon.className = 'fas fa-file-pdf';
            previewText.textContent = file.name;
        }
    }

    fileInput.addEventListener('change', () => updateFilePreview(fileInput, filePreview));
    editFileInput.addEventListener('change', () => updateFilePreview(editFileInput, editFilePreview));

    // Update document upload form submission
    document.getElementById('newDocumentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            const propertyId = form.querySelector('#propertySelect').value;
            let propertyLocation = '';
            
            // Get property location if propertyId is selected
            if (propertyId) {
                const propertyRef = doc(db, 'properties', propertyId);
                const propertySnap = await getDoc(propertyRef);
                if (propertySnap.exists()) {
                    propertyLocation = propertySnap.data().location;
                }
            }

            let documentData = {
                title: form.querySelector('#documentTitle').value,
                type: form.querySelector('#documentType').value,
                propertyId: propertyId,
                propertyLocation: propertyLocation,
                isSigned: form.querySelector('#isSigned').value === 'true',
                createdAt: new Date().toISOString(),
                ownerId: window.fbAuth.auth.currentUser.uid,
                updatedAt: new Date().toISOString()
            };

            // Only upload file if one is selected
            if (form.querySelector('#documentFile').files.length > 0) {
                window.cloudinaryWidget.open();

                // Wait for upload success
                const uploadResult = await new Promise((resolve, reject) => {
                    document.addEventListener('cloudinaryUploadSuccess', (event) => {
                        resolve(event.detail);
                    }, { once: true });
                    
                    // Add timeout for upload
                    setTimeout(() => reject(new Error('Feltöltési időtúllépés')), 60000);
                });

                // Add file information
                documentData = {
                    ...documentData,
                    fileName: uploadResult.original_filename,
                    fileSize: uploadResult.bytes,
                    mimeType: uploadResult.resource_type + '/' + uploadResult.format,
                    cloudinaryId: uploadResult.public_id,
                    downloadURL: uploadResult.secure_url,
                    resourceType: uploadResult.resource_type
                };
            }

            // Add to Firestore
            const docRef = await window.fbDb.addDoc(
                window.fbDb.collection(window.fbDb.db, 'documents'),
                documentData
            );

            // Close modal and refresh
            document.getElementById('newDocumentModal').style.display = 'none';
            form.reset();
            await loadDocuments();
            alert('Dokumentum sikeresen feltöltve!');
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Hiba történt a dokumentum feltöltése közben: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Mentés';
        }
    });

    // Add view organization handler
    document.getElementById('viewOrganizer').addEventListener('change', async (e) => {
        const viewType = e.target.value;
        const activeFilter = document.querySelector('.filter-btn.active').textContent.split(' ')[0].toLowerCase();
        await loadDocuments(activeFilter, viewType);
    });

    // Load documents with optional filter and view type
    async function loadDocuments(filterType = 'all', viewType = 'all') {
        try {
            console.log('Loading documents...');
            const user = window.fbAuth.auth.currentUser;
            if (!user) {
                console.log('No user logged in');
                return;
            }
            console.log('Current user:', user.uid);

            const q = query(documentsRef, where('ownerId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            const documents = [];
            console.log('Query snapshot size:', querySnapshot.size);

            // First, get all properties to map their IDs to locations
            const propertiesRef = collection(window.fbDb.db, 'properties');
            const propertiesQuery = query(propertiesRef, where('ownerId', '==', user.uid));
            const propertiesSnapshot = await getDocs(propertiesQuery);
            const propertyMap = new Map();
            propertiesSnapshot.forEach((propertyDoc) => {
                propertyMap.set(propertyDoc.id, propertyDoc.data().location);
            });

            // Now load documents with property locations
            for (const docSnapshot of querySnapshot.docs) {
                const docData = docSnapshot.data();
                // Add property location if document has a propertyId
                if (docData.propertyId) {
                    docData.propertyLocation = propertyMap.get(docData.propertyId) || 'Ismeretlen ingatlan';
                }
                documents.push({ ...docData, id: docSnapshot.id });
                console.log('Document loaded:', { id: docSnapshot.id, ...docData });
            }

            // Update filter buttons count
            const counts = {
                all: documents.length,
                contract: documents.filter(doc => doc.type === 'contract').length,
                invoice: documents.filter(doc => doc.type === 'invoice').length,
                other: documents.filter(doc => doc.type === 'other').length
            };
            console.log('Document counts:', counts);

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

            // Display documents based on view type
            const documentsGrid = document.querySelector('.documents-grid');
            documentsGrid.innerHTML = '';

            if (filteredDocs.length === 0) {
                console.log('No documents found');
                documentsGrid.innerHTML = '<p class="no-documents">Nincsenek még dokumentumok</p>';
                return;
            }

            // Show all documents in a grid
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
                ${doc.downloadURL ? `
                    <button class="btn-icon view-pdf" onclick="showPDF('${doc.downloadURL}')" title="Megtekintés">
                        <i class="fas fa-eye"></i>
                    </button>
                ` : ''}
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

    // Make showPDF function globally available
    async function showPDF(pdfUrl) {
        try {
            // Ensure we're using HTTPS URL
            const secureUrl = pdfUrl.replace('http://', 'https://');
            
            const loadingTask = pdfjsLib.getDocument({
                url: secureUrl,
                withCredentials: false // Don't send cookies
            });
            
            const pdf = await loadingTask.promise;
            window.pdfDoc = pdf;
            window.pageNum = 1;
            
            const canvas = document.getElementById('pdfCanvas');
            const ctx = canvas.getContext('2d');
            
            async function renderPage(num) {
                const page = await pdf.getPage(num);
                const viewport = page.getViewport({ scale: 1.5 });
                
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;
                
                document.getElementById('pageNum').textContent = num;
            }
            
            await renderPage(1);
            document.getElementById('pageCount').textContent = pdf.numPages;
            document.getElementById('pdfViewerModal').style.display = 'block';
            
            // Setup navigation buttons
            document.getElementById('prevPage').onclick = () => {
                if (window.pageNum <= 1) return;
                window.pageNum--;
                renderPage(window.pageNum);
            };
            
            document.getElementById('nextPage').onclick = () => {
                if (window.pageNum >= pdf.numPages) return;
                window.pageNum++;
                renderPage(window.pageNum);
            };
            
        } catch (error) {
            console.error('Error showing PDF:', error);
            alert('Hiba történt a PDF megjelenítése közben: ' + error.message);
        }
    }
    window.showPDF = showPDF;

    // --- EDIT DOCUMENT FUNCTIONALITY ---
    // Only define window.editDocument ONCE and ensure it's correct
    window.editDocument = async (documentId) => {
        const editModal = document.getElementById('editDocumentModal');
        const editForm = document.getElementById('editDocumentForm');
        // Show the modal as a popup
        editModal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        try {
            const docRef = doc(db, 'documents', documentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                await loadPropertiesForSelect('editPropertySelect');
                document.getElementById('editDocumentId').value = documentId;
                document.getElementById('editDocumentTitle').value = data.title;
                document.getElementById('editDocumentType').value = data.type;
                document.getElementById('editPropertySelect').value = data.propertyId || '';
                document.getElementById('editIsSigned').value = (data.isSigned === true).toString();
                // Update file preview if exists
                const currentFileText = document.querySelector('#editFilePreview .current-file');
                if (data.downloadURL) {
                    currentFileText.style.display = 'block';
                    currentFileText.querySelector('span').textContent = 'PDF dokumentum feltöltve';
                } else {
                    currentFileText.style.display = 'none';
                }
                // Add delete button handler inside modal
                const deleteBtn = document.getElementById('editDeleteDocumentBtn');
                if (deleteBtn) {
                    deleteBtn.onclick = async () => {
                        if (confirm('Biztosan törölni szeretné ezt a dokumentumot?')) {
                            await window.deleteDocument(documentId);
                            editModal.style.display = 'none';
                            document.body.style.overflow = 'auto';
                        }
                    };
                }
            }
        } catch (error) {
            console.error('Error loading document for edit:', error);
            alert('Hiba történt a dokumentum betöltésekor');
            editModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    };

    // --- DELETE DOCUMENT FUNCTIONALITY ---
    // Ensure window.deleteDocument is defined and globally available
    window.deleteDocument = async (documentId) => {
        if (!confirm('Biztosan törölni szeretné ezt a dokumentumot?')) return;
        try {
            const docRef = window.fbDb.doc(window.fbDb.db, 'documents', documentId);
            const docSnap = await window.fbDb.getDoc(docRef);
            const documentData = docSnap.data();
            if (documentData.cloudinaryId) {
                // Delete from Cloudinary using the upload preset
                const formData = new FormData();
                formData.append('public_id', documentData.cloudinaryId);
                formData.append('upload_preset', cloudinaryConfig.uploadPreset);
                try {
                    const destroyResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/destroy`, {
                        method: 'POST',
                        body: formData,
                        mode: 'cors',
                        credentials: 'omit'
                    });
                    if (!destroyResponse.ok) {
                        console.warn('Failed to delete from Cloudinary:', await destroyResponse.json());
                    }
                } catch (error) {
                    console.warn('Error deleting from Cloudinary:', error);
                }
            }
            await window.fbDb.deleteDoc(docRef);
            await loadDocuments();
            alert('Dokumentum sikeresen törölve!');
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Hiba történt a dokumentum törlésekor');
        }
    };

    // Edit form submission handler
    document.getElementById('editDocumentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            const propertyId = form.querySelector('#editPropertySelect').value;
            let propertyLocation = '';
            
            // Get property location if propertyId is selected
            if (propertyId) {
                const propertyRef = doc(db, 'properties', propertyId);
                const propertySnap = await getDoc(propertyRef);
                if (propertySnap.exists()) {
                    propertyLocation = propertySnap.data().location;
                }
            }

            let documentData = {
                title: form.querySelector('#editDocumentTitle').value,
                type: form.querySelector('#editDocumentType').value,
                propertyId: propertyId,
                propertyLocation: propertyLocation,
                isSigned: form.querySelector('#editIsSigned').value === 'true',
                updatedAt: new Date().toISOString()
            };

            // If new file is selected, upload it
            const fileInput = form.querySelector('#editDocumentFile');
            if (fileInput.files.length > 0) {
                window.cloudinaryWidget.open();

                // Wait for upload success
                const uploadResult = await new Promise((resolve, reject) => {
                    document.addEventListener('cloudinaryUploadSuccess', (event) => {
                        resolve(event.detail);
                    }, { once: true });
                    
                    // Add timeout for upload
                    setTimeout(() => reject(new Error('Feltöltési időtúllépés')), 60000);
                });

                // Add file information
                documentData = {
                    ...documentData,
                    fileName: uploadResult.original_filename,
                    fileSize: uploadResult.bytes,
                    mimeType: uploadResult.resource_type + '/' + uploadResult.format,
                    cloudinaryId: uploadResult.public_id,
                    downloadURL: uploadResult.secure_url,
                    resourceType: uploadResult.resource_type
                };
            }

            // Update document in Firestore
            await window.fbDb.updateDoc(
                window.fbDb.doc(window.fbDb.db, 'documents', documentId),
                documentData
            );

            // Close modal and refresh
            document.getElementById('editDocumentModal').style.display = 'none';
            await loadDocuments();
            alert('Dokumentum sikeresen módosítva!');

        } catch (error) {
            console.error('Error updating document:', error);
            alert('Hiba történt a dokumentum módosítása közben: ' + error.message);
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
            const docSnap = await window.fbDb.getDoc(docRef);
            const documentData = docSnap.data();

            if (documentData.cloudinaryId) {
                // Delete from Cloudinary using the upload preset
                const formData = new FormData();
                formData.append('public_id', documentData.cloudinaryId);
                formData.append('upload_preset', cloudinaryConfig.uploadPreset);
                
                try {
                    const destroyResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/destroy`, {
                        method: 'POST',
                        body: formData,
                        mode: 'cors',
                        credentials: 'omit'
                    });

                    if (!destroyResponse.ok) {
                        console.warn('Failed to delete from Cloudinary:', await destroyResponse.json());
                    }
                } catch (error) {
                    console.warn('Error deleting from Cloudinary:', error);
                    // Continue with Firestore deletion even if Cloudinary deletion fails
                }
            }

            await window.fbDb.deleteDoc(docRef);
            await loadDocuments();
            alert('Dokumentum sikeresen törölve!');
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Hiba történt a dokumentum törlésekor');
        }
    };

    // Update filter button handlers
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Map Hungarian text to document types
            const filterMap = {
                'összes': 'all',
                'szerződések': 'contract',
                'számlák': 'invoice',
                'egyéb': 'other'
            };
            
            const filterType = filterMap[btn.textContent.split(' ')[0].toLowerCase()] || 'all';
            loadDocuments(filterType);
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

    // PDF.js functionality
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    const scale = 1.5;
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');

    // Initialize PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf/build/pdf.worker.mjs';

    async function renderPage(num) {
        pageRendering = true;
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        try {
            await page.render(renderContext).promise;
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        } catch (error) {
            console.error('Error rendering PDF page:', error);
            pageRendering = false;
        }

        document.getElementById('pageNum').textContent = num;
    }

    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    // PDF viewer controls
    document.getElementById('prevPage').addEventListener('click', () => {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    });

    // Close PDF viewer
    document.querySelector('#pdfViewerModal .close-modal').addEventListener('click', () => {
        document.getElementById('pdfViewerModal').style.display = 'none';
        document.body.style.overflow = 'auto';
        pdfDoc = null;
        pageNum = 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Close PDF viewer when clicking outside
    document.getElementById('pdfViewerModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('pdfViewerModal')) {
            document.getElementById('pdfViewerModal').style.display = 'none';
            document.body.style.overflow = 'auto';
            pdfDoc = null;
            pageNum = 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });

    // Edit modal elements
    const editModal = document.getElementById('editDocumentModal');
    const editCloseBtn = editModal.querySelector('.close-modal');
    const cancelEditBtn = document.getElementById('cancelEditDocument');

    // Close edit modal functions
    const closeEditModal = () => {
        editModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('editDocumentForm').reset();
    };

    // Add edit modal close handlers
    editCloseBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
});
