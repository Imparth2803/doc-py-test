import express from 'express';

import { upload } from '../middleware/uploadMiddleware';

import {
  uploadDocument,
  getDocuments,
  getDocumentById,
  getJobStatus,
  processDocument,
  updateDocument,
  rotateDocument,
  decryptManualDocument,
  togglePinField,
  emailDocument,
  getDocumentTables,
  getDocumentTableSheet,
  downloadDocumentTables
} from '../controllers/documentController';

console.log('\nDOCUMENT ROUTES LOADED');

const router = express.Router();

// Upload route
router.post(
  '/upload',
  (req, res, next) => {
    console.log('\n==============================');
    console.log('UPLOAD ROUTE TRIGGERED');
    console.log('==============================');

    next();
  },

  upload.single('file'),

  uploadDocument
);

router.post('/:id/process', processDocument);
router.post('/:id/decrypt', decryptManualDocument);
router.post('/:id/email', emailDocument);

// Toggle pin field
router.patch('/:id/toggle-pin', togglePinField);

// Rotate document
router.post('/:id/rotate', rotateDocument);

// Update document
router.patch('/:id', updateDocument);

// Get all documents
router.get('/', getDocuments);

// Get single document
router.get('/:id', getDocumentById);

// Get processing job
router.get('/job/:id', getJobStatus);

// Table extraction routes
router.get('/:id/tables/download', downloadDocumentTables);
router.get('/:id/tables', getDocumentTables);
router.get('/:id/tables/:sheet', getDocumentTableSheet);

export default router;