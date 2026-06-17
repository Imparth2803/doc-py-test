export const extractIds = (text: string): string[] => {
  const ids: string[] = [];
  
  // PAN: 5 letters, 4 digits, 1 letter
  const panRegex = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
  
  // Aadhaar: 12 digits, optional space after every 4
  const aadhaarRegex = /\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/g;
  
  // Passport: 1 letter, 7 digits
  const passportRegex = /\b[A-Z][1-9]\d{6}\b/g;

  const panMatches = text.match(panRegex);
  if (panMatches) ids.push(...panMatches);

  const aadhaarMatches = text.match(aadhaarRegex);
  if (aadhaarMatches) ids.push(...aadhaarMatches);

  const passportMatches = text.match(passportRegex);
  if (passportMatches) ids.push(...passportMatches);

  return ids;
};
