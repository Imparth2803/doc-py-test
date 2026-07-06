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
  documentId: string,
  language: string = 'en'
): Promise<ApiDocument> => {
  const response = await fetch(
    `${API_BASE}/${documentId}/process`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Processing failed to start');
  }

  const data = await response.json();
  return data.document;
};

export const decryptDocument = async (
  documentId: string,
  password: string
): Promise<ApiDocument> => {
  const response = await fetch(`${API_BASE}/${documentId}/decrypt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Decryption failed');
  }

  const data = await response.json();
  return data.document;
};

export const rotateDocument = async (
  documentId: string,
  rotation: number
): Promise<{ success: boolean; rotation: number }> => {
  const response = await fetch(`${API_BASE}/${documentId}/rotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rotation }),
  });

  if (!response.ok) {
    throw new Error('Rotation failed');
  }

  return response.json();
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

export const emailDocument = async (
  documentId: string,
  to: string
): Promise<{ success: boolean }> => {
  const response = await fetch(`${API_BASE}/${documentId}/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send document email');
  }

  return response.json();
};

export const getDocumentTables = async (documentId: string): Promise<any> => {
  const response = await fetch(`${API_BASE}/${documentId}/tables`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch document tables');
  }
  return response.json();
};

export const getDocumentTableSheet = async (documentId: string, sheetName: string): Promise<any> => {
  const response = await fetch(`${API_BASE}/${documentId}/tables/${encodeURIComponent(sheetName)}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch table sheet data');
  }
  return response.json();
};

export const getDownloadTablesUrl = (documentId: string): string => {
  return `${API_BASE}/${documentId}/tables/download`;
};