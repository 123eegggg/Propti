// Import UploadCare configuration
import uploadcareConfig from './uploadcare-config.js';

// PDF.js configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Initialize UploadCare widget with shared configuration
const uploadWidget = uploadcare.Widget('[role=uploadcare-uploader]', uploadcareConfig);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Document loaded, initializing...');
    
    // Wait for Firebase to be initialized
    while (!window.fbAuth || !window.fbDb) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('Firebase initialized');

    // Initialize globals
    const { auth, onAuthStateChanged } = window.fbAuth;
    const { db, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } = window.fbDb;
    const documentsRef = collection(db, 'documents');
    
    const pdfState = {
        doc: null,
        pageNum: 1,
        pageRendering: false,
        pageNumPending: null,
        scale: 1.5
    };

    // Get DOM elements
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
        pageCount: document.getElementById('pageCount'),
        editModal: document.getElementById('editDocumentModal'),
        editForm: document.getElementById('editDocumentForm')
    };

    // Add authentication state observer
    onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? 'logged in' : 'logged out');
        if (user) {
            // User is signed in, load documents
            await loadDocuments();
        } else {
            // User is signed out, clear documents
            if (elements.documentsGrid) {
                elements.documentsGrid.innerHTML = '<p class="no-documents">A dokumentumok megtekintéséhez jelentkezzen be</p>';
            }
        }
    });

    // PDF viewer functionality
    async function showPDF(pdfUrl) {
        try {
            if (!elements.pdfViewerModal || !elements.pdfCanvas) {
                console.error('Required PDF viewer elements not found');
                return;
            }

            const ctx = elements.pdfCanvas.getContext('2d');
            
            // Load PDF directly from Cloudinary URL
            const loadingTask = pdfjsLib.getDocument({
                url: pdfUrl,
                withCredentials: false
            });
            
            pdfState.doc = await loadingTask.promise;
            pdfState.pageNum = 1;

            // PDF rendering function
            async function renderPage(num) {
                if (!pdfState.doc) return;
                
                try {
                    pdfState.pageRendering = true;
                    const page = await pdfState.doc.getPage(num);
                    
                    // Calculate scale to fit width while maintaining aspect ratio
                    const viewport = page.getViewport({ scale: 1.0 });
                    const container = elements.pdfCanvas.parentElement;
                    const scale = (container.clientWidth - 40) / viewport.width;
                    const finalViewport = page.getViewport({ scale });
                    
                    elements.pdfCanvas.height = finalViewport.height;
                    elements.pdfCanvas.width = finalViewport.width;
                    
                    await page.render({
                        canvasContext: ctx,
                        viewport: finalViewport
                    }).promise;
                    
                    pdfState.pageRendering = false;
                    if (pdfState.pageNumPending !== null) {
                        renderPage(pdfState.pageNumPending);
                        pdfState.pageNumPending = null;
                    }
                    
                    elements.pageNum.textContent = num;
                } catch (error) {
                    console.error('Error rendering page:', error);
                    pdfState.pageRendering = false;
                    throw error;
                }
            }

            // Initialize viewer
            await renderPage(1);
            elements.pageCount.textContent = pdfState.doc.numPages;
            elements.pdfViewerModal.style.display = 'block';
            document.body.style.overflow = 'hidden';

            // Navigation handlers with error handling
            async function onPrevPage() {
                if (pdfState.pageNum <= 1) return;
                pdfState.pageNum--;
                try {
                    await renderPage(pdfState.pageNum);
                } catch (error) {
                    pdfState.pageNum++; // Revert on error
                    alert('Hiba történt az oldal betöltése közben');
                }
            }

            async function onNextPage() {
                if (pdfState.pageNum >= pdfState.doc.numPages) return;
                pdfState.pageNum++;
                try {
                    await renderPage(pdfState.pageNum);
                } catch (error) {
                    pdfState.pageNum--; // Revert on error
                    alert('Hiba történt az oldal betöltése közben');
                }
            }

            // Add event listeners
            if (elements.prevPageBtn) {
                elements.prevPageBtn.onclick = onPrevPage;
            }
            if (elements.nextPageBtn) {
                elements.nextPageBtn.onclick = onNextPage;
            }

            // Improved close handler with proper cleanup
            function closePdfViewer() {
                elements.pdfViewerModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                
                // Clear the canvas
                ctx.clearRect(0, 0, elements.pdfCanvas.width, elements.pdfCanvas.height);
                
                // Clean up PDF document
                if (pdfState.doc) {
                    pdfState.doc.destroy();
                    pdfState.doc = null;
                }
                
                // Reset state
                pdfState.pageNum = 1;
                pdfState.pageRendering = false;
                pdfState.pageNumPending = null;
                
                // Remove event listeners
                if (elements.prevPageBtn) elements.prevPageBtn.onclick = null;
                if (elements.nextPageBtn) elements.nextPageBtn.onclick = null;
            }

            const closeBtn = elements.pdfViewerModal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.onclick = closePdfViewer;
            }

            elements.pdfViewerModal.onclick = (e) => {
                if (e.target === elements.pdfViewerModal) {
                    closePdfViewer();
                }
            };

        } catch (error) {
            console.error('Error showing PDF:', error);
            alert('Hiba történt a PDF megjelenítése közben: ' + error.message);
        }
    }

    // Make showPDF globally available
    window.showPDF = showPDF;

    // File upload functionality
    uploadWidget.onChange(function(file) {
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert('A fájl mérete nem lehet nagyobb 10MB-nál');
                uploadWidget.value(null);
                return;
            }
            if (file.mimeType && !file.mimeType.startsWith('application/pdf')) {
                alert('Csak PDF fájlok feltöltése engedélyezett');
                uploadWidget.value(null);
                return;
            }
            
            const preview = document.querySelector('#filePreview');
            if (preview) {
                preview.innerHTML = `
                    <i class="fas fa-file-pdf"></i>
                    <p>${file.name || 'PDF dokumentum'}</p>
                `;
            }
        }
    });

    // Add file preview event listeners
    if (elements.fileInput && elements.filePreview) {
        elements.fileInput.addEventListener('change', () => updateFilePreview(elements.fileInput, elements.filePreview));
    }
    if (elements.editFileInput && elements.editFilePreview) {
        elements.editFileInput.addEventListener('change', () => updateFilePreview(elements.editFileInput, elements.editFilePreview));
    }

    // Replace file input click with UploadCare widget
    elements.fileInput?.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Opening UploadCare widget');
        uploadWidget.openDialog();
    });

    // Property management
    async function loadPropertiesForSelect(selectId = 'propertySelect') {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const propertiesRef = collection(db, 'properties');
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

    // Document operations
    async function loadDocuments(filterType = 'all') {
        try {
            const user = auth.currentUser;
            if (!user) {
                console.log('No user logged in');
                return;
            }

            console.log('Loading documents for user:', user.uid);
            elements.documentsGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Dokumentumok betöltése...</div>';

            const q = query(documentsRef, where('ownerId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            
            let documents = [];
            querySnapshot.forEach((doc) => {
                documents.push({ ...doc.data(), id: doc.id });
            });

            console.log('Found documents:', documents.length);

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

            // Update filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => {
                const type = btn.getAttribute('data-filter');
                const label = btn.textContent.split(' ')[0];
                btn.textContent = `${label} (${counts[type]})`;
            });

            // Display results
            elements.documentsGrid.innerHTML = '';
            if (filteredDocs.length === 0) {
                elements.documentsGrid.innerHTML = '<p class="no-documents">Nincsenek dokumentumok</p>';
                return;
            }

            // Sort and display documents
            filteredDocs
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .forEach(doc => {
                    elements.documentsGrid.appendChild(createDocumentCard(doc));
                });
        } catch (error) {
            console.error('Error loading documents:', error);
            elements.documentsGrid.innerHTML = '<p class="error">Hiba történt a dokumentumok betöltése közben</p>';
        }
    }

    function createDocumentCard(doc) {
        console.log('Creating card for document:', doc);
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
                <h3>${doc.title || 'Untitled'}</h3>
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
                    <button class="btn-icon view-pdf" onclick="window.showPDF('${doc.downloadURL}')" title="Megtekintés">
                        <i class="fas fa-eye"></i>
                    </button>
                    <a href="${doc.downloadURL}" class="btn-icon download-pdf" download="${doc.title || 'document'}.pdf" title="Letöltés">
                        <i class="fas fa-download"></i>
                    </a>
                ` : ''}
                <button class="btn-icon edit-btn" onclick="editDocument('${doc.id}')" title="Szerkesztés">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete-btn" onclick="deleteDocument('${doc.id}')" title="Törlés">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;

        return card;
    }

    // Document form handlers
    elements.documentForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Form submission started');
        
        const user = auth.currentUser;
        if (!user) {
            alert('A dokumentum feltöltéséhez be kell jelentkeznie!');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';

        try {
            const formData = new FormData(e.target);
            const fileInfo = uploadWidget.value();
            
            if (!fileInfo) {
                alert('Kérem, töltsön fel egy PDF dokumentumot!');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Mentés';
                return;
            }

            const propertyId = formData.get('propertyId');
            let propertyLocation = '';
            
            if (propertyId) {
                const propertySnap = await getDoc(doc(db, 'properties', propertyId));
                if (propertySnap.exists()) {
                    propertyLocation = propertySnap.data().location;
                }
            }

            const documentData = {
                title: formData.get('title'),
                type: formData.get('type'),
                propertyId,
                propertyLocation,
                ownerId: user.uid,
                createdAt: new Date().toISOString(),
                downloadURL: fileInfo.cdnUrl,
                fileName: fileInfo.name || 'document.pdf',
                uploadcareUuid: fileInfo.uuid,
                isSigned: formData.get('isSigned') === 'true'
            };

            await addDoc(documentsRef, documentData);
            
            elements.modal.style.display = 'none';
            e.target.reset();
            uploadWidget.value(null);
            
            if (elements.filePreview) {
                elements.filePreview.innerHTML = `
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Kattintson vagy húzza ide a PDF fájlt</p>
                `;
            }
            
            alert('Dokumentum sikeresen feltöltve!');
            await loadDocuments();
            
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Hiba történt a dokumentum feltöltése közben: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Mentés';
        }
    });

    // Modal handlers
    elements.uploadBtn?.addEventListener('click', async () => {
        elements.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        await loadPropertiesForSelect();
    });

    function closeModal() {
        elements.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        elements.documentForm?.reset();
    }

    elements.closeModal?.addEventListener('click', closeModal);
    elements.cancelBtn?.addEventListener('click', closeModal);
    elements.modal?.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    // Filter functionality
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadDocuments(btn.getAttribute('data-filter'));
        });
    });

    // Load initial documents if user is logged in
    if (auth.currentUser) {
        await loadDocuments();
    }

    // Document editing
    window.editDocument = async (documentId) => {
        try {
            const docRef = doc(db, 'documents', documentId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                await loadPropertiesForSelect('editPropertySelect');
                
                elements.editForm.querySelector('#editDocumentId').value = documentId;
                elements.editForm.querySelector('#editDocumentTitle').value = data.title;
                elements.editForm.querySelector('#editDocumentType').value = data.type;
                elements.editForm.querySelector('#editPropertySelect').value = data.propertyId || '';
                elements.editForm.querySelector('#editIsSigned').value = (data.isSigned === true).toString();

                const currentFileText = elements.editFilePreview.querySelector('.current-file');
                if (data.downloadURL) {
                    currentFileText.style.display = 'block';
                    currentFileText.querySelector('span').textContent = 'PDF dokumentum feltöltve';
                } else {
                    currentFileText.style.display = 'none';
                }
                
                elements.editModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            console.error('Error loading document for edit:', error);
            alert('Hiba történt a dokumentum betöltésekor');
        }
    };

    // Document deletion
    window.deleteDocument = async (documentId) => {
        if (!confirm('Biztosan törölni szeretné ezt a dokumentumot?')) return;

        try {
            const docRef = doc(db, 'documents', documentId);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                throw new Error('Document not found');
            }

            // Note: UploadCare handles file deletion automatically
            await deleteDoc(docRef);
            await loadDocuments();
            alert('Dokumentum sikeresen törölve!');
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Hiba történt a dokumentum törlésekor: ' + error.message);
        }
    };

    // File preview functionality for both widgets
    uploadWidget.onChange(function(file) {
        if (file) {
            const preview = document.querySelector('#filePreview');
            if (preview) {
                preview.innerHTML = `
                    <i class="fas fa-file-pdf"></i>
                    <p>${file.name || 'PDF dokumentum'}</p>
                `;
            }
        }
    });
    
    // Reset widgets when modals are closed
    elements.modal?.addEventListener('hidden', () => {
        uploadWidget.value(null);
        const preview = document.querySelector('#filePreview');
        if (preview) {
            preview.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Kattintson vagy húzza ide a PDF fájlt (nem kötelező)</p>
            `;
        }
    });

    elements.editModal?.addEventListener('hidden', () => {
        uploadWidget.value(null);
        const preview = document.querySelector('#filePreview');
        if (preview) {
            preview.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Kattintson vagy húzza ide a PDF fájlt (nem kötelező)</p>
                <p class="current-file" style="display:none">Jelenlegi fájl: <span></span></p>
            `;
        }
    });

    // Form submission handlers
    elements.newDocumentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInfo = uploadWidget.value();
        
        try {
            const docData = {
                title: elements.documentTitle.value,
                type: elements.documentType.value,
                propertyId: elements.propertySelect.value,
                isSigned: elements.isSigned.value === 'true',
                uploadDate: new Date().toISOString(),
                userId: auth.currentUser.uid
            };

            if (fileInfo) {
                docData.uploadcareUuid = fileInfo.uuid;
                docData.fileName = fileInfo.name || 'document.pdf';
                docData.fileUrl = fileInfo.cdnUrl;
            }

            await addDoc(collection(db, 'documents'), docData);
            elements.modal.style.display = 'none';
            await loadDocuments();
            alert('Dokumentum sikeresen feltöltve!');
        } catch (error) {
            console.error('Error saving document:', error);
            alert('Hiba történt a dokumentum mentése közben: ' + error.message);
        }
    });

    elements.editDocumentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const documentId = elements.editDocumentId.value;
        const fileInfo = uploadWidget.value();
        
        try {
            const docRef = doc(db, 'documents', documentId);
            const docData = {
                title: elements.editDocumentTitle.value,
                type: elements.editDocumentType.value,
                propertyId: elements.editPropertySelect.value,
                isSigned: elements.editIsSigned.value === 'true',
                lastModified: new Date().toISOString()
            };

            if (fileInfo) {
                docData.uploadcareUuid = fileInfo.uuid;
                docData.fileName = fileInfo.name || 'document.pdf';
                docData.fileUrl = fileInfo.cdnUrl;
            }

            await updateDoc(docRef, docData);
            elements.editModal.style.display = 'none';
            await loadDocuments();
            alert('Dokumentum sikeresen módosítva!');
        } catch (error) {
            console.error('Error updating document:', error);
            alert('Hiba történt a dokumentum módosítása közben: ' + error.message);
        }
    });

    // Configure widgets
    [uploadWidget].forEach(widget => {
        widget.validators.push(function(fileInfo) {
            if (fileInfo.size > 10 * 1024 * 1024) {
                throw new Error('A fájl mérete nem lehet nagyobb 10MB-nál');
            }
            if (fileInfo.mimeType && !fileInfo.mimeType.startsWith('application/pdf')) {
                throw new Error('Csak PDF fájlok feltöltése engedélyezett');
            }
            return true;
        });
    });

    uploadWidget.onUploadStart(function(file) {
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Feltöltés...';
        }
    });

    uploadWidget.onUploadComplete(function(info) {
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Mentés';
        }
    });

    async function deleteDocument(documentId) {
        try {
            const docRef = doc(db, 'documents', documentId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                // Delete from Firestore first
                await deleteDoc(docRef);
                
                // Note: Uploadcare handles file cleanup automatically
                // No need to manually delete files
                
                await loadDocuments();
                alert('Dokumentum sikeresen törölve!');
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Hiba történt a dokumentum törlése közben: ' + error.message);
        }
    }
});
