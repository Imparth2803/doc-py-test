import { ApiDocument } from '../types/api';
import { Document } from '../types';

export const mapApiDocumentToDocument = (
  doc: ApiDocument
): Document => ({
    id: doc._id,
    name: doc.originalName,
    date: doc.createdAt
        ? doc.createdAt.split('T')[0]
        : new Date().toISOString().split('T')[0],

    folder: 'Uploads',

    tags: doc.tags || [],

    entities: doc.entities || [],

    docType: doc.mimeType?.split('/')[1] ||
        'Document',

    metadata: doc.metadata || {},

    mimeType: doc.mimeType,

    previewUrl: '',
    _id: ''
});