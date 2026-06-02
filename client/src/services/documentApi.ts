import { ApiDocument } from '../types/api';

const API_BASE = 'http://localhost:8000/api/documents';

type DocumentsResponse = {
  success: boolean;
  documents: ApiDocument[];
};

type DocumentResponse = {
  success: boolean;
  document: ApiDocument;
};

export const getDocuments = async (): Promise<ApiDocument[]> => {
  const response = await fetch(API_BASE);

  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }

  const data: DocumentsResponse = await response.json();

  return data.documents || [];
};

export const getDocument = async (
  documentId: string
): Promise<ApiDocument> => {
  const response = await fetch(
    `${API_BASE}/${documentId}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch document');
  }

  const data: DocumentResponse =
    await response.json();

  return data.document;
};

export const uploadDocument = async (
  file: File
): Promise<ApiDocument> => {
  const formData = new FormData();

  formData.append('file', file);

  const response = await fetch(
    `${API_BASE}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const data = await response.json();

  return data.document;
};

export const updateDocument = async (
  documentId: string,
  updates: Partial<ApiDocument>
): Promise<ApiDocument> => {
  const response = await fetch(`${API_BASE}/${documentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Update failed');
  }

  const data = await response.json();

  return data.document;
};

export const processDocument = async (
  documentId: string
): Promise<ApiDocument> => {
  const response = await fetch(
    `${API_BASE}/${documentId}/process`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    throw new Error('Processing failed');
  }

  const data: DocumentResponse =
    await response.json();

  return data.document;
};

export const deleteDocument = async (
  documentId: string
): Promise<void> => {
  const response = await fetch(
    `${API_BASE}/${documentId}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
};