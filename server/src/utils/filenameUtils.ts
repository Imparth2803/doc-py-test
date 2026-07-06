export const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip'
};

export function getExtensionFromMime(mimeType?: string): string {
  if (!mimeType) return 'pdf';
  const cleanMime = mimeType.toLowerCase().trim();
  if (MIME_TO_EXTENSION[cleanMime]) {
    return MIME_TO_EXTENSION[cleanMime];
  }
  
  const parts = cleanMime.split('/');
  if (parts.length === 2 && parts[1] !== 'octet-stream') {
    return parts[1];
  }
  return 'pdf';
}

export function buildDownloadFilename(
  documentName: string,
  originalName: string,
  mimeType?: string
): string {
  const displayTitle = (documentName || originalName || 'Document').trim();
  
  // 1. Read original extension
  const extMatch = originalName ? originalName.match(/\.[^/.]+$/) : null;
  let ext = extMatch ? extMatch[0].substring(1) : '';
  
  // 2. If unavailable, infer from mimeType
  if (!ext) {
    ext = getExtensionFromMime(mimeType);
  }
  
  // 3. Check if documentName already ends with .ext
  if (ext && !displayTitle.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    const cleanName = displayTitle.replace(/\.[^/.]+$/, "");
    return `${cleanName}.${ext}`;
  }
  
  return displayTitle;
}
