export const extractEmails = (text: string): string[] => {
  const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = text.match(regex);
  return matches ? matches : [];
};
