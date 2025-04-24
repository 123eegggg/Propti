// UploadCare configuration
const uploadcareConfig = {
    publicKey: '3ab83f53d7004ed0b77f', // This is okay to be public
    // Private settings should be managed server-side
    settings: {
        effects: 'crop,rotate,enhance,sharp,grayscale',
        imageShrink: '2048x2048',
        tabs: 'file camera url facebook gdrive gphotos',
        previewStep: true,
        clearable: true,
        multiple: false,
        maxSize: 10 * 1024 * 1024, // 10MB limit
        validation: {
            allowedFileTypes: ['image/*', '.pdf', '.doc', '.docx'],
            maxFileSize: 10 * 1024 * 1024 // 10MB in bytes
        }
    }
};

export default uploadcareConfig;