const DEFAULT_BASE_URL = 'http://localhost:8000';

export function getFilenameFromStoragePath(storagePath: string | undefined | null): string | undefined {
  if (!storagePath) return undefined;
  const segments = storagePath.split(/[\\/]/);
  return segments.pop() || undefined;
}

export function buildPreviewUrl(
  storagePath: string | undefined | null,
  baseUrl?: string,
  cacheBust?: string | number | Date,
  doc?: { _id?: string; name?: string; originalName?: string; documentName?: string }
): string | undefined {
  const filename = getFilenameFromStoragePath(storagePath);
  if (!filename) return undefined;
  const origin = baseUrl || DEFAULT_BASE_URL;
  let url = `${origin}/uploads/${encodeURIComponent(filename)}`;
  if (cacheBust) {
    const ts = cacheBust instanceof Date ? cacheBust.getTime() : new Date(cacheBust).getTime();
    url += `?v=${ts}`;
  }
  
  console.log('[PREVIEW URL]');
  console.log('Document ID:', doc?._id || 'N/A');
  console.log('storagePath:', storagePath);
  console.log('originalName:', doc?.originalName || 'N/A');
  console.log('documentName:', doc?.documentName || doc?.name || 'N/A');
  console.log('Generated Preview URL:', url);
  console.log('----------------------------------------\n');

  return url;
}
