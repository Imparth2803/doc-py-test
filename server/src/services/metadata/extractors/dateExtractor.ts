export const extractDates = (text: string): string[] => {
  const dates: string[] = [];
  // Match formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const numRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g;
  // Match formats: 1 Jan 2026, 01 January 2026
  const textRegex = /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/gi;

  const numMatches = text.match(numRegex);
  if (numMatches) {
    dates.push(...numMatches);
  }

  const textMatches = text.match(textRegex);
  if (textMatches) {
    dates.push(...textMatches);
  }

  return dates;
};
