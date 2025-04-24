// UploadCare configuration
export default {
    publicKey: '3ab83f53d7004ed0b77f',
    tabs: 'file gdrive dropbox url',
    previewStep: true,
    validators: [
        function(fileInfo) {
            if (fileInfo.size > 10 * 1024 * 1024) {
                throw new Error('File size should not exceed 10MB');
            }
            if (fileInfo.mimeType && !fileInfo.mimeType.startsWith('application/pdf')) {
                throw new Error('Only PDF files are allowed');
            }
        }
    ],
    imageShrink: false,
    clearable: true,
    multiple: false
};
