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
    const { db, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } = window.fbDb;
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

    // Handle document upload form submission
    document.getElementById('newDocumentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            window.cloudinaryWidget.open();

            // Wait for upload success
            const uploadResult = await new Promise((resolve, reject) => {
                document.addEventListener('cloudinaryUploadSuccess', (event) => {
                    resolve(event.detail);
                }, { once: true });
                
                // Add timeout for upload
                setTimeout(() => reject(new Error('Feltöltési időtúllépés')), 60000);
            });

            // Create document in Firestore
            const documentData = {
                title: form.querySelector('#documentTitle').value,
                type: form.querySelector('#documentType').value,
                propertyId: form.querySelector('#propertySelect').value,
                isSigned: form.querySelector('#isSigned').value === 'true',
                createdAt: new Date().toISOString(),
                fileName: uploadResult.original_filename,
                fileSize: uploadResult.bytes,
                mimeType: uploadResult.resource_type + '/' + uploadResult.format,
                cloudinaryId: uploadResult.public_id,
                downloadURL: uploadResult.secure_url,
                resourceType: uploadResult.resource_type,
                ownerId: window.fbAuth.auth.currentUser.uid
            };

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

            // Display documents based on view type
            const documentsGrid = document.querySelector('.documents-grid');
            documentsGrid.innerHTML = '';

            if (filteredDocs.length === 0) {
                documentsGrid.innerHTML = '<p class="no-documents">Nincsenek még dokumentumok</p>';
                return;
            }

            if (viewType === 'byProperty') {
                // Group documents by property
                const propertyGroups = {};
                filteredDocs.forEach(doc => {
                    const propertyName = doc.propertyLocation || 'Nincs ingatlan';
                    if (!propertyGroups[propertyName]) {
                        propertyGroups[propertyName] = [];
                    }
                    propertyGroups[propertyName].push(doc);
                });

                // Create property list view
                const propertyList = document.createElement('div');
                propertyList.className = 'property-list';

                Object.entries(propertyGroups).forEach(([propertyName, propertyDocs]) => {
                    const propertyItem = document.createElement('div');
                    propertyItem.className = 'property-item';
                    propertyItem.innerHTML = `
                        <h3>${propertyName}</h3>
                        <div class="document-count">${propertyDocs.length} dokumentum</div>
                    `;

                    // Create hidden documents container
                    const docsContainer = document.createElement('div');
                    docsContainer.className = 'property-documents';
                    docsContainer.id = `property-${propertyName.replace(/[^a-z0-9]/gi, '-')}`;
                    
                    propertyDocs.forEach(doc => {
                        docsContainer.appendChild(createDocumentCard(doc, doc.id));
                    });
                    
                    documentsGrid.appendChild(docsContainer);

                    // Add click handler for property item
                    propertyItem.addEventListener('click', () => {
                        // Hide property list
                        propertyList.style.display = 'none';
                        
                        // Create and add back button
                        const backButton = document.createElement('button');
                        backButton.className = 'back-button';
                        backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Vissza';
                        backButton.addEventListener('click', () => {
                            docsContainer.classList.remove('active');
                            propertyList.style.display = 'grid';
                            backButton.remove();
                        });
                        
                        documentsGrid.insertBefore(backButton, docsContainer);
                        
                        // Show documents for this property
                        docsContainer.classList.add('active');
                    });

                    propertyList.appendChild(propertyItem);
                });

                documentsGrid.insertBefore(propertyList, documentsGrid.firstChild);
            } else {
                // Show all documents in a grid
                filteredDocs.forEach(doc => {
                    documentsGrid.appendChild(createDocumentCard(doc, doc.id));
                });
            }

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

    // Make showPDF available globally
    window.showPDF = showPDF;

    // Add edit document functionality
    window.editDocument = async (documentId) => {
        const editModal = document.getElementById('editDocumentModal');
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
                document.getElementById('editIsSigned').value = (data.isSigned === true).toString(); // Fixed this line

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

    // Edit form submission handler
    document.getElementById('editDocumentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            const documentId = form.querySelector('#editDocumentId').value;
            let documentData = {
                title: form.querySelector('#editDocumentTitle').value,
                type: form.querySelector('#editDocumentType').value,
                propertyId: form.querySelector('#editPropertySelect').value,
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

                // Add new file information
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

    // Initialize user display and logout functionality
    const { auth } = window.fbAuth;
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
});
