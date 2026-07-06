/**
 * Parses and normalizes various date string formats consistently.
 * Gracefully returns null if date is invalid or empty.
 */
export function parseNormalizedDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  const dateStr = String(dateVal).trim();
  if (!dateStr) return null;

  // Try direct standard parsing
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d;
  }

  // Handle custom patterns: split by '/' or '-'
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      // Check if format is YYYY-MM-DD
      if (parts[0].length === 4) {
        d = new Date(p0, p1 - 1, p2);
      } else {
        // Assume DD-MM-YYYY or MM-DD-YYYY (fallback to standard DD-MM-YYYY)
        d = new Date(p2, p1 - 1, p0);
      }
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }

  return null;
}
