import { ApiDocument } from '../types/api';
import { Document } from '../types';

export const mapApiDocumentToDocument = (
  doc: ApiDocument
): Document => {
  const filename =
    doc.storagePath
        ?.split(/[\\/]/)
        .pop();

  const previewUrl =
    filename
    ? `http://localhost:8000/uploads/${encodeURIComponent(filename)}`
    : '';

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

    mimeType: doc.mimeType,

    previewUrl,

    _id: doc._id
  };
};