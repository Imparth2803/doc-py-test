export const extractPhoneNumbers = (text: string): string[] => {
  // Matches 9876543210, +91 9876543210, +44 7911122233
  const regex = /(?:(?:\+|00)\d{1,3}\s?)?(?:\d{10}|\d{4}\s\d{6}|\d{3}\s\d{3}\s\d{4})/g;
  const matches = text.match(regex);
  return matches ? matches.map(m => m.trim()) : [];
};
