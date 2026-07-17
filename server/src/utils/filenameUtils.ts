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

export function cleanAndValidateFilename(
  filename: string,
  originalName?: string,
  category?: string
): string {
  if (!filename) return category || 'Document';

  // 1. Remove file extension (case-insensitive)
  let name = filename.replace(/\.[^/.]+$/, "");

  // 2. Remove duplicate indicators like (1), (2), [1], etc.
  name = name.replace(/\(\d+\)/g, "").replace(/\[\d+\]/g, "");

  // 3. Replace underscores, hyphens (except year ranges), and other punctuation with spaces
  name = name.replace(/_/g, " ");

  // 4. Remove technical prefixes/suffixes (case-insensitive, e.g., IMG, SCAN, DOC, FILE, E_STATEMENT)
  const technicalPrefixes = [
    /^(IMG|SCAN|DOC|FILE|E_STATEMENT|ESTATEMENT|SAVINGS|E-STATEMENT|STATEMENT)[_ -]*/gi,
    /[_ -]+(IMG|SCAN|DOC|FILE|E_STATEMENT|ESTATEMENT|SAVINGS|E-STATEMENT|STATEMENT)$/gi
  ];
  for (const prefixRegex of technicalPrefixes) {
    name = name.replace(prefixRegex, "");
  }

  // 5. Remove meaningless numbers:
  // - Remove digits that are 5 or more characters long (e.g., customer IDs, long numeric date ranges like 20260501)
  name = name.replace(/\b\d{5,}\b/g, "");
  // - Remove timestamps/times like 183012 or 220605 (6 digits, but let's be careful about years, so 5+ covers this)
  name = name.replace(/\b\d{6}\b/g, "");

  // 6. Clean up excessive whitespace
  name = name.replace(/\s+/g, " ").trim();

  // 7. Check if filename is valid and has meaningful content
  const isJunk = !name || 
    /^(document|file|scan|image|whatsapp image)$/i.test(name) ||
    /^[0-9\s\-()]+$/.test(name); // contains only numbers and spacing

  if (isJunk) {
    return category ? category : 'Document';
  }

  // 8. Convert to Title Case
  name = name
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // 9. Enforce 80 characters limit and trim
  if (name.length > 80) {
    name = name.substring(0, 80).trim();
  }

  return name;
}

