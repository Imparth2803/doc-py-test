import { ApiDocument } from '../types/api';
import { Document } from '../types';
import { buildPreviewUrl } from './storagePathUtils';

export const mapApiDocumentToDocument = (
  doc: ApiDocument
): Document => {
  const previewUrl = buildPreviewUrl(doc.storagePath) || '';

    console.log(
    "MAPPING",
    doc.originalName,
    doc.storagePath
    );

    console.log(
    "PREVIEW URL GENERATED",
    previewUrl
    );

  return {
    id: doc._id,
    name: doc.documentName || doc.originalName,
    originalName: doc.originalName,

    date: doc.createdAt
      ? doc.createdAt.split('T')[0]
      : new Date().toISOString().split('T')[0],

    folder: 'Uploads',

    tags: doc.tags || [],

    entities: doc.entities || [],

    docType:
      doc.mimeType?.split('/')[1] ||
      'Document',

    metadata: doc.metadata || {},

    extractedText: doc.extractedText || '',

    mimeType: doc.mimeType,

    status: doc.status,

    previewUrl,

    _id: doc._id,

    pinnedFields: doc.pinnedFields || [],
    
    tables: doc.tables
  };
};