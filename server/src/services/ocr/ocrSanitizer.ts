export interface OCRSanitizationDiagnostics {
  originalLength: number;
  cleanedLength: number;
  removedGarbageLines: number;
  collapsedWhitespace: number;
}

export const sanitizeOCRText = (rawText: string): { cleanedText: string; diagnostics: OCRSanitizationDiagnostics } => {
  if (!rawText) {
    return {
      cleanedText: "",
      diagnostics: { originalLength: 0, cleanedLength: 0, removedGarbageLines: 0, collapsedWhitespace: 0 }
    };
  }

  const originalLength = rawText.length;
  let removedGarbageLines = 0;
  
  // 1. Process line by line to remove garbage
  const lines = rawText.split('\n');
  const validLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines temporarily to handle duplicate newlines later
    if (trimmed.length === 0) {
      validLines.push('');
      continue;
    }

    // Identify pure garbage/punctuation lines (e.g., "_____", "|||||", "@@@")
    // Keep lines that have at least one alphanumeric character
    if (/^[^a-zA-Z0-9]+$/.test(trimmed)) {
      removedGarbageLines++;
      continue;
    }

    validLines.push(trimmed);
  }

  // Rejoin text
  let cleanedText = validLines.join('\n');

  // 2. Collapse excessive newlines (max 2 consecutive newlines)
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');

  // 3. Collapse repeated spaces within lines (while preserving single spaces)
  // We count space reduction heuristically by length difference before/after
  const lengthBeforeSpaceCollapse = cleanedText.length;
  cleanedText = cleanedText.replace(/[ \t]{2,}/g, ' ');
  const collapsedWhitespace = lengthBeforeSpaceCollapse - cleanedText.length;

  // Final trim
  cleanedText = cleanedText.trim();

  return {
    cleanedText,
    diagnostics: {
      originalLength,
      cleanedLength: cleanedText.length,
      removedGarbageLines,
      collapsedWhitespace
    }
  };
};
