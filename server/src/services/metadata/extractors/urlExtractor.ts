export const extractUrls = (text: string): string[] => {
  const regex = /\b(?:https?:\/\/|www\.)[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
  const matches = text.match(regex);
  return matches ? matches : [];
};
