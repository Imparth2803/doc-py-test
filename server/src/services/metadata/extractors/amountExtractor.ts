export const extractAmounts = (text: string): string[] => {
  // Matches ₹15,000, Rs. 1000, INR 50000, $150, £300, etc.
  const regex = /(?:₹|Rs\.?\s*|INR\s*|\$|£|€)\s*\d+(?:,\d+)*(?:\.\d+)?/gi;
  const matches = text.match(regex);
  return matches ? matches.map(m => m.trim()) : [];
};
