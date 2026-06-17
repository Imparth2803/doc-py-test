import { ExtractedMetadata } from './types';
import {
  extractDates,
  extractAmounts,
  extractEmails,
  extractPhoneNumbers,
  extractIds,
  extractUrls
} from './extractors';

const cleanAndDeduplicate = (arr: string[]): string[] => {
  if (!arr) return [];
  const cleaned = arr
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return Array.from(new Set(cleaned));
};

export const extractMetadata = (text: string): ExtractedMetadata => {
  const defaultMetadata: ExtractedMetadata = {
    dates: [],
    amounts: [],
    emails: [],
    phoneNumbers: [],
    ids: [],
    urls: []
  };

  if (!text) {
    return defaultMetadata;
  }

  try {
    const rawDates = extractDates(text);
    const rawAmounts = extractAmounts(text);
    const rawEmails = extractEmails(text);
    const rawPhoneNumbers = extractPhoneNumbers(text);
    const rawIds = extractIds(text);
    const rawUrls = extractUrls(text);

    const result: ExtractedMetadata = {
      dates: cleanAndDeduplicate(rawDates),
      amounts: cleanAndDeduplicate(rawAmounts),
      emails: cleanAndDeduplicate(rawEmails),
      phoneNumbers: cleanAndDeduplicate(rawPhoneNumbers),
      ids: cleanAndDeduplicate(rawIds),
      urls: cleanAndDeduplicate(rawUrls)
    };

    console.log('[Metadata Extraction]', {
      dates: result.dates.length,
      amounts: result.amounts.length,
      emails: result.emails.length,
      phoneNumbers: result.phoneNumbers.length,
      ids: result.ids.length,
      urls: result.urls.length
    });

    return result;
  } catch (error) {
    console.error('[Metadata Extraction] Non-blocking failure:', error);
    return defaultMetadata;
  }
};
