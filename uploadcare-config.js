// UploadCare configuration
const uploadcareConfig = {
    publicKey: '3ab83f53d7004ed0b77f',  // Public key is safe to use in client-side code
    settings: {
        tabs: ['file', 'camera', 'url'],
        previewStep: true,
        clearable: true,
        multiple: false,
        maxSize: 10 * 1024 * 1024, // 10MB limit
        validation: {
            allowedFileTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ],
            maxFileSize: 10 * 1024 * 1024 // 10MB in bytes
        }
    }
};

export default uploadcareConfig;