import path from 'path';

export function isValidStoragePath(sp: unknown): sp is string {
  if (typeof sp !== 'string' || !sp) return false;
  return path.isAbsolute(sp);
}

export function getFilenameFromStoragePath(sp: string): string | undefined {
  if (!sp) return undefined;
  const segments = sp.split(/[\\/]/);
  const last = segments.pop();
  return last || undefined;
}

export function buildPreviewUrl(
  storagePath: string,
  baseUrl?: string,
  doc?: { _id?: string; originalName?: string; documentName?: string }
): string {
  const filename = getFilenameFromStoragePath(storagePath);
  if (!filename) return '';
  const origin = baseUrl || 'http://localhost:8000';
  const url = `${origin}/uploads/${encodeURIComponent(filename)}`;

  console.log('[PREVIEW URL]');
  console.log('Document ID:', doc?._id || 'N/A');
  console.log('storagePath:', storagePath);
  console.log('originalName:', doc?.originalName || 'N/A');
  console.log('documentName:', doc?.documentName || 'N/A');
  console.log('Generated Preview URL:', url);
  console.log('----------------------------------------\n');

  return url;
}

export function getAbsoluteStoragePath(relativeOrAbsolute: string): string {
  if (path.isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
  const uploadsDir = path.resolve(__dirname, '../../uploads');
  const filename = getFilenameFromStoragePath(relativeOrAbsolute);
  return filename ? path.join(uploadsDir, filename) : path.resolve(__dirname, '../../', relativeOrAbsolute);
}
