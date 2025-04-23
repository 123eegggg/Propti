require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// Configure CORS with allowed origins
const allowedOrigins = [
    'https://soft-sawine-34511b.netlify.app',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS not allowed'), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'x-amz-acl',
        'x-amz-content-sha256',
        'x-amz-date',
        'x-amz-security-token',
        'x-amz-user-agent',
        'x-amz-target',
        'x-amz-credential',
        'x-amz-signature',
        'authorization'
    ],
    exposedHeaders: [
        'ETag',
        'x-amz-server-side-encryption',
        'x-amz-request-id',
        'x-amz-id-2'
    ],
    credentials: true
}));

app.use(express.json());

// Configure AWS with owner info
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3({
    signatureVersion: 'v4',
    params: {
        // Add your canonical ID as the owner
        ExpectedBucketOwner: '075e12a6ed52318d65a3abdad47c5c461272bf8cf8e3f1c0c2ed74bafebaad0f'
    }
});

// Generate a presigned URL for upload
app.post('/getPresignedUrl', async (req, res) => {
    try {
        const fileName = req.body.fileName;
        const fileType = req.body.fileType;
        const key = `documents/${crypto.randomUUID()}-${fileName}`;

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            ContentType: fileType,
            Expires: 300, // URL expires in 5 minutes
            ACL: 'private',
            ExpectedBucketOwner: '075e12a6ed52318d65a3abdad47c5c461272bf8cf8e3f1c0c2ed74bafebaad0f'
        };

        const presignedUrl = await s3.getSignedUrlPromise('putObject', params);
        res.json({
            url: presignedUrl,
            key: key
        });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
});

// Get a temporary URL for viewing/downloading a file
app.get('/getFileUrl/:key', async (req, res) => {
    try {
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.params.key,
            Expires: 3600, // URL expires in 1 hour
            ExpectedBucketOwner: '075e12a6ed52318d65a3abdad47c5c461272bf8cf8e3f1c0c2ed74bafebaad0f'
        };

        const url = await s3.getSignedUrlPromise('getObject', params);
        res.json({ url });
    } catch (error) {
        console.error('Error generating file URL:', error);
        res.status(500).json({ error: 'Failed to generate file URL' });
    }
});

// Delete a file from S3
app.delete('/deleteFile/:key', async (req, res) => {
    try {
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.params.key,
            ExpectedBucketOwner: '075e12a6ed52318d65a3abdad47c5c461272bf8cf8e3f1c0c2ed74bafebaad0f'
        };

        await s3.deleteObject(params).promise();
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});