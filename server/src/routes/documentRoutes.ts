import express from 'express';

import { upload } from '../middleware/uploadMiddleware';

import {
  uploadDocument,
  getDocuments,
  getDocumentById,
  getJobStatus,
  processDocument,
  updateDocument,
  rotateDocument
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

export default router;