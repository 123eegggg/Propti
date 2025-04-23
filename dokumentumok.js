// Initialize global variables at the very top
window.pdfDoc = null;
window.pageNum = 1;
window.pageRendering = false;
window.pageNumPending = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // Get DOM elements with null checks
    const elements = {
        uploadBtn: document.querySelector('.upload-btn'),
        modal: document.getElementById('newDocumentModal'),
        closeModal: document.querySelector('.close-modal'),
        cancelBtn: document.getElementById('cancelDocument'),
        documentForm: document.getElementById('newDocumentForm'),
        documentsGrid: document.querySelector('.documents-grid'),
        fileInput: document.getElementById('documentFile'),
        filePreview: document.getElementById('filePreview'),
        editFileInput: document.getElementById('editDocumentFile'),
        editFilePreview: document.getElementById('editFilePreview'),
        pdfViewerModal: document.getElementById('pdfViewerModal'),
        pdfCanvas: document.getElementById('pdfCanvas'),
        prevPageBtn: document.getElementById('prevPage'),
        nextPageBtn: document.getElementById('nextPage'),
        pageNum: document.getElementById('pageNum'),
        pageCount: document.getElementById('pageCount')
    };

    // Initialize Firebase references
    const { db, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } = window.fbDb;
    const documentsRef = collection(db, 'documents');

    // Initialize user display and logout functionality
    const { auth } = window.fbAuth;
    const userDisplayNameElement = document.getElementById('userDisplayName');
    const logoutBtn = document.getElementById('logoutBtn');

    // Load documents immediately if user is authenticated
    const currentUser = window.fbAuth.auth.currentUser;
    if (currentUser) {
        try {
            await loadDocuments();
        } catch (error) {
            console.error('Error loading initial documents:', error);
        }
    }

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
                elements.editModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            console.error('Error loading document for edit:', error);
            alert('Hiba történt a dokumentum betöltésekor');
        }
    };

    // Add event listeners only if elements exist
    if (elements.fileInput && elements.filePreview) {
        elements.fileInput.addEventListener('change', () => updateFilePreview(elements.fileInput, elements.filePreview));
    }

    if (elements.editFileInput && elements.editFilePreview) {
        elements.editFileInput.addEventListener('change', () => updateFilePreview(elements.editFileInput, elements.editFilePreview));
    }

    // Add file preview functionality
    function updateFilePreview(input, preview) {
        if (!input || !preview) return;
        const file = input.files[0];
        if (file) {
            const previewText = preview.querySelector('p');
            const icon = preview.querySelector('i');
            if (icon) icon.className = 'fas fa-file-pdf';
            if (previewText) previewText.textContent = file.name;
        }
    }

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
    elements.editCloseBtn?.addEventListener('click', closeEditModal);
    elements.cancelEditBtn?.addEventListener('click', closeEditModal);

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

    // New function to handle S3 file upload
    async function uploadFileToS3(file) {
        try {
            // Get presigned URL from our backend
            const presignedUrlResponse = await fetch('http://localhost:3000/getPresignedUrl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type
                })
            });
            
            const { url, key } = await presignedUrlResponse.json();

            // Upload file to S3 using presigned URL
            await fetch(url, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type
                }
            });

            // Get a temporary URL for immediate access
            const fileUrlResponse = await fetch(`http://localhost:3000/getFileUrl/${key}`);
            const { url: downloadURL } = await fileUrlResponse.json();

            return {
                key,
                downloadURL
            };
        } catch (error) {
            console.error('Error uploading to S3:', error);
            throw error;
        }
    }

    // New function to delete file from S3
    async function deleteFileFromS3(key) {
        try {
            await fetch(`http://localhost:3000/deleteFile/${key}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Error deleting from S3:', error);
            throw error;
        }
    }

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

            // Handle file upload to S3
            const fileInput = form.querySelector('#documentFile');
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const uploadResult = await uploadFileToS3(file);
                
                documentData = {
                    ...documentData,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    s3Key: uploadResult.key,
                    downloadURL: uploadResult.downloadURL
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
    async function loadDocuments(filterType = 'all') {
        try {
            const user = window.fbAuth.auth.currentUser;
            if (!user) {
                console.log('No user logged in');
                return;
            }

            const documentsGrid = document.querySelector('.documents-grid');
            documentsGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Dokumentumok betöltése...</div>';

            const q = query(documentsRef, where('ownerId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            
            let documents = [];
            querySnapshot.forEach((doc) => {
                documents.push({ ...doc.data(), id: doc.id });
            });

            // Apply type filter
            let filteredDocs = documents;
            if (filterType !== 'all') {
                filteredDocs = documents.filter(doc => doc.type === filterType);
            }

            // Update counts
            const counts = {
                all: documents.length,
                contract: documents.filter(doc => doc.type === 'contract').length,
                invoice: documents.filter(doc => doc.type === 'invoice').length,
                other: documents.filter(doc => doc.type === 'other').length
            };

            // Update filter buttons with counts
            document.querySelectorAll('.filter-btn').forEach(btn => {
                const type = btn.getAttribute('data-filter');
                const label = btn.textContent.split(' ')[0];
                btn.textContent = `${label} (${counts[type]})`;
            });

            // Display results
            documentsGrid.innerHTML = '';
            if (filteredDocs.length === 0) {
                documentsGrid.innerHTML = '<p class="no-documents">Nincsenek találatok</p>';
                return;
            }

            // Sort documents by creation date and display them
            filteredDocs
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .forEach(doc => {
                    documentsGrid.appendChild(createDocumentCard(doc, doc.id));
                });

        } catch (error) {
            console.error('Error loading documents:', error);
            const documentsGrid = document.querySelector('.documents-grid');
            documentsGrid.innerHTML = '<p class="error">Hiba történt a dokumentumok betöltése közben</p>';
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
                    <a href="${doc.downloadURL}" class="btn-icon download-pdf" download="${doc.title || 'document'}.pdf" title="Letöltés">
                        <i class="fas fa-download"></i>
                    </a>
                ` : ''}
                <button class="btn-icon" onclick="editDocument('${docId}')" title="Szerkesztés">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete-btn" onclick="deleteDocument('${docId}')" title="Törlés">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;

        return card;
    }

    // Make showPDF function globally available
    async function showPDF(pdfUrl) {
        try {
            const loadingTask = pdfjsLib.getDocument({
                url: pdfUrl,
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
        try {
            if (!confirm('Biztosan törölni szeretné ezt a dokumentumot?')) return;
            
            const docRef = doc(db, 'documents', documentId);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                throw new Error('Document not found');
            }

            const documentData = docSnap.data();

            // First try to delete from S3 if there's an attached file
            if (documentData.s3Key) {
                try {
                    await deleteFileFromS3(documentData.s3Key);
                } catch (s3Error) {
                    console.error('Error deleting file from S3:', s3Error);
                    // Continue with Firestore deletion even if S3 deletion fails
                }
            }

            // Then delete from Firestore
            await deleteDoc(docRef);
            
            // Refresh the documents list
            await loadDocuments();
            
            alert('Dokumentum sikeresen törölve!');
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Hiba történt a dokumentum törlésekor: ' + error.message);
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
                const file = fileInput.files[0];
                const uploadResult = await uploadFileToS3(file);

                documentData = {
                    ...documentData,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    s3Key: uploadResult.key,
                    downloadURL: uploadResult.downloadURL
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

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('editDocumentModal')) {
            closeEditModal();
        }
    });

    function closeEditModal() {
        document.getElementById('editDocumentModal').style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('editDocumentForm').reset();
    }

    // Add edit modal close handler for cancel button
    document.getElementById('cancelEditDocument').addEventListener('click', closeEditModal);

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('editDocumentModal')) {
            closeEditModal();
        }
    });

    // Add filter functionality
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            // Get filter type and load documents
            const filterType = btn.getAttribute('data-filter');
            loadDocuments(filterType);
        });
    });

    // Update loadDocuments function to handle filtering
    async function loadDocuments(filterType = 'all') {
        try {
            const user = window.fbAuth.auth.currentUser;
            if (!user) {
                console.log('No user logged in');
                return;
            }

            const documentsGrid = document.querySelector('.documents-grid');
            documentsGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Dokumentumok betöltése...</div>';

            const q = query(documentsRef, where('ownerId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            
            let documents = [];
            querySnapshot.forEach((doc) => {
                documents.push({ ...doc.data(), id: doc.id });
            });

            // Apply filter
            let filteredDocs = documents;
            if (filterType !== 'all') {
                filteredDocs = documents.filter(doc => doc.type === filterType);
            }

            // Update counts
            const counts = {
                all: documents.length,
                contract: documents.filter(doc => doc.type === 'contract').length,
                invoice: documents.filter(doc => doc.type === 'invoice').length,
                other: documents.filter(doc => doc.type === 'other').length
            };

            // Update filter buttons with counts
            document.querySelectorAll('.filter-btn').forEach(btn => {
                const type = btn.getAttribute('data-filter');
                const label = btn.textContent.split(' ')[0];
                btn.textContent = `${label} (${counts[type]})`;
            });

            // Display results
            documentsGrid.innerHTML = '';
            if (filteredDocs.length === 0) {
                documentsGrid.innerHTML = '<p class="no-documents">Nincsenek találatok</p>';
                return;
            }

            // Sort documents by creation date and display them
            filteredDocs
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .forEach(doc => {
                    documentsGrid.appendChild(createDocumentCard(doc, doc.id));
                });

        } catch (error) {
            console.error('Error loading documents:', error);
            const documentsGrid = document.querySelector('.documents-grid');
            documentsGrid.innerHTML = '<p class="error">Hiba történt a dokumentumok betöltése közben</p>';
        }
    }
});

// Update the showPDF function to handle S3 URLs properly
window.showPDF = async function(pdfUrl) {
    try {
        const pdfViewerModal = document.getElementById('pdfViewerModal');
        const canvas = document.getElementById('pdfCanvas');
        const pageNum = document.getElementById('pageNum');
        const pageCount = document.getElementById('pageCount');
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');

        if (!pdfViewerModal || !canvas || !pageNum || !pageCount || !prevButton || !nextButton) {
            console.error('Required PDF viewer elements not found');
            return;
        }

        // Get a fresh temporary URL for the PDF from our S3 backend
        const s3Key = pdfUrl.split('/').pop(); // Extract the key from the URL
        const response = await fetch(`http://localhost:3000/getFileUrl/${s3Key}`);
        const { url: freshUrl } = await response.json();

        // Load the PDF using the fresh URL
        const loadingTask = pdfjsLib.getDocument({
            url: freshUrl,
            withCredentials: false,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true
        });
        
        const pdf = await loadingTask.promise;
        window.pdfDoc = pdf;
        window.pageNum = 1;
        
        const ctx = canvas.getContext('2d');
        
        async function renderPage(num) {
            const page = await pdf.getPage(num);
            const viewport = page.getViewport({ scale: 1.5 });
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            try {
                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;
                
                pageNum.textContent = num;
            } catch (error) {
                console.error('Error rendering page:', error);
                throw error;
            }
        }
        
        await renderPage(1);
        pageCount.textContent = pdf.numPages;
        pdfViewerModal.style.display = 'block';
        
        // Setup navigation buttons
        prevButton.onclick = () => {
            if (window.pageNum <= 1) return;
            window.pageNum--;
            renderPage(window.pageNum);
        };
        
        nextButton.onclick = () => {
            if (window.pageNum >= pdf.numPages) return;
            window.pageNum++;
            renderPage(window.pageNum);
        };

        // Add close button handler
        const closeButton = pdfViewerModal.querySelector('.close-modal');
        if (closeButton) {
            closeButton.onclick = () => {
                pdfViewerModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                // Clean up
                window.pdfDoc = null;
                window.pageNum = 1;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            };
        }
        
    } catch (error) {
        console.error('Error showing PDF:', error);
        alert('Hiba történt a PDF megjelenítése közben: ' + error.message);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const uploadBtn = document.querySelector('.upload-btn');
    const modal = document.getElementById('newDocumentModal');
    const closeModal = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelDocument');
    const documentForm = document.getElementById('newDocumentForm');
    const documentsGrid = document.querySelector('.documents-grid');
    const fileInput = document.getElementById('documentFile');
    const filePreview = document.getElementById('filePreview');
    const editFileInput = document.getElementById('editDocumentFile');
    const editFilePreview = document.getElementById('editFilePreview');

    // Ensure elements exist before adding event listeners
    if (fileInput && filePreview) {
        fileInput.addEventListener('change', () => updateFilePreview(fileInput, filePreview));
    }
    
    if (editFileInput && editFilePreview) {
        editFileInput.addEventListener('change', () => updateFilePreview(editFileInput, editFilePreview));
    }

    // Update file preview function
    function updateFilePreview(input, preview) {
        if (!input || !preview) return;
        const file = input.files[0];
        if (file) {
            const previewText = preview.querySelector('p');
            const icon = preview.querySelector('i');
            if (icon) icon.className = 'fas fa-file-pdf';
            if (previewText) previewText.textContent = file.name;
        }
    }

    // ...existing code...
});

document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const viewOrganizerElement = document.getElementById('viewOrganizer');
    const pdfViewerModal = document.getElementById('pdfViewerModal');
    const prevPageButton = document.getElementById('prevPage');
    const nextPageButton = document.getElementById('nextPage');
    const pageNumElement = document.getElementById('pageNum');
    const pageCountElement = document.getElementById('pageCount');
    const pdfCanvas = document.getElementById('pdfCanvas');

    // Only add event listeners if elements exist
    if (viewOrganizerElement) {
        viewOrganizerElement.addEventListener('change', async (e) => {
            const viewType = e.target.value;
            const activeFilterBtn = document.querySelector('.filter-btn.active');
            if (activeFilterBtn) {
                const activeFilter = activeFilterBtn.textContent.split(' ')[0].toLowerCase();
                await loadDocuments(activeFilter, viewType);
            }
        });
    }

    // PDF viewer controls
    if (prevPageButton && pageNum) {
        prevPageButton.addEventListener('click', () => {
            if (pageNum <= 1) return;
            pageNum--;
            queueRenderPage(pageNum);
        });
    }

    if (nextPageButton && pageNum && pdfDoc) {
        nextPageButton.addEventListener('click', () => {
            if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
            pageNum++;
            queueRenderPage(pageNum);
        });
    }

    // Close PDF viewer handlers
    if (pdfViewerModal) {
        const closeModalBtn = pdfViewerModal.querySelector('.close-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                pdfViewerModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                if (pdfCanvas) {
                    const ctx = pdfCanvas.getContext('2d');
                    if (ctx) {
                        ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
                    }
                }
                window.pdfDoc = null;
                window.pageNum = 1;
            });
        }

        // Close on outside click
        pdfViewerModal.addEventListener('click', (e) => {
            if (e.target === pdfViewerModal) {
                pdfViewerModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                if (pdfCanvas) {
                    const ctx = pdfCanvas.getContext('2d');
                    if (ctx) {
                        ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
                    }
                }
                window.pdfDoc = null;
                window.pageNum = 1;
            }
        });
    }

    // ... rest of your code ...
});

document.addEventListener('DOMContentLoaded', () => {
    // Initialize PDF.js globals
    window.pdfDoc = null;
    window.pageNum = 1;
    window.pageRendering = false;
    window.pageNumPending = null;

    // Get PDF viewer elements
    const pdfViewerModal = document.getElementById('pdfViewerModal');
    const prevPageButton = document.getElementById('prevPage');
    const nextPageButton = document.getElementById('nextPage');
    const pageNumElement = document.getElementById('pageNum');
    const pageCountElement = document.getElementById('pageCount');
    const pdfCanvas = document.getElementById('pdfCanvas');

    if (!pdfViewerModal || !pdfCanvas) {
        console.warn('PDF viewer elements not found');
        return;
    }

    const ctx = pdfCanvas.getContext('2d');
    const scale = 1.5;

    // Handle PDF navigation
    if (prevPageButton) {
        prevPageButton.addEventListener('click', () => {
            if (window.pageNum <= 1) return;
            window.pageNum--;
            queueRenderPage(window.pageNum);
        });
    }

    if (nextPageButton) {
        nextPageButton.addEventListener('click', () => {
            if (!window.pdfDoc || window.pageNum >= window.pdfDoc.numPages) return;
            window.pageNum++;
            queueRenderPage(window.pageNum);
        });
    }

    // Handle modal closing
    const closeModalBtn = pdfViewerModal.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closePdfViewer);
    }

    // Close on outside click
    pdfViewerModal.addEventListener('click', (e) => {
        if (e.target === pdfViewerModal) {
            closePdfViewer();
        }
    });

    function closePdfViewer() {
        pdfViewerModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        if (ctx) {
            ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        }
        window.pdfDoc = null;
        window.pageNum = 1;
    }

    // Render page function
    async function renderPage(num) {
        if (!window.pdfDoc) return;

        window.pageRendering = true;
        const page = await window.pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale });

        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;

        try {
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            window.pageRendering = false;
            if (window.pageNumPending !== null) {
                renderPage(window.pageNumPending);
                window.pageNumPending = null;
            }
            
            if (pageNumElement) {
                pageNumElement.textContent = num;
            }
        } catch (error) {
            console.error('Error rendering PDF page:', error);
            window.pageRendering = false;
        }
    }

    // Queue rendering function
    function queueRenderPage(num) {
        if (window.pageRendering) {
            window.pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    // Global showPDF function
    window.showPDF = async function(pdfUrl) {
        try {
            // Get a fresh temporary URL for the PDF from our S3 backend
            const s3Key = pdfUrl.split('/').pop(); // Extract the key from the URL
            const response = await fetch(`http://localhost:3000/getFileUrl/${s3Key}`);
            const { url: freshUrl } = await response.json();

            // Load the PDF
            const loadingTask = pdfjsLib.getDocument({
                url: freshUrl,
                withCredentials: false
            });

            window.pdfDoc = await loadingTask.promise;
            window.pageNum = 1;

            await renderPage(1);
            if (pageCountElement) {
                pageCountElement.textContent = window.pdfDoc.numPages;
            }
            pdfViewerModal.style.display = 'block';
            document.body.style.overflow = 'hidden';

        } catch (error) {
            console.error('Error showing PDF:', error);
            alert('Hiba történt a PDF megjelenítése közben: ' + error.message);
        }
    };

    // ... rest of your existing code ...
});