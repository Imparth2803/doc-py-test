import { GLiNEREntity, GLiNEREntities, GLiNERSanitizationDiagnostics } from './types';

const CONFIDENCE_THRESHOLDS = {
  PERSON: 0.60,
  ORGANIZATION: 0.60,
};

const ORGANIZATION_HINTS = [
  "bank",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "company",
  "inc",
  "llp",
  "trust",
  "foundation",
  "university",
  "college",
  "school",
  "hospital",
  "insurance",
  "government",
  "ministry",
  "department",
  "authority",
  "commission",
  "services",
  "technologies",
  "industries",
  "group"
];

const PERSON_BLACKLIST = [
  "customer",
  "account",
  "account holder",
  "statement",
  "invoice",
  "transaction",
  "reference",
  "branch",
  "manager",
  "address",
  "mobile",
  "phone",
  "email",
  "gst",
  "pan",
  "aadhaar",
  "number",
  "date"
];

/**
 * Validates if an entity is a likely organization.
 */
const isValidOrganization = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  
  // Rule A: Contains hint
  if (ORGANIZATION_HINTS.some(hint => lowerText.includes(hint))) {
    return true;
  }
  
  // Rule B: All uppercase acronym
  if (/^[A-Z]{2,10}$/.test(text)) {
    return true;
  }
  
  // Rule C: At least two words
  const words = text.split(/\s+/);
  if (words.length >= 2) {
    return true;
  }
  
  return false;
};

/**
 * Validates if an entity is a likely person.
 */
const isValidPerson = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  
  // Blacklist exact match
  if (PERSON_BLACKLIST.includes(lowerText)) {
    return false;
  }
  
  // Rule C: Length constraint
  if (text.length < 3 || text.length > 100) {
    return false;
  }
  
  // Rule A: Contains at least two words
  const words = text.split(/\s+/);
  if (words.length < 2) {
    return false;
  }
  
  // Rule B: Words must be mostly alphabetic
  const isMostlyAlphabetic = words.every(word => {
    const alphaCount = (word.match(/[a-zA-Z]/g) || []).length;
    return alphaCount / word.length >= 0.5;
  });
  
  if (!isMostlyAlphabetic) {
    return false;
  }
  
  return true;
};

/**
 * Sanitizes and filters raw GLiNER entities.
 */
export const sanitizeEntities = (
  rawEntities: GLiNEREntity[]
): { entities: GLiNEREntities; diagnostics: GLiNERSanitizationDiagnostics } => {
  const diagnostics: GLiNERSanitizationDiagnostics = {
    rawCount: rawEntities.length,
    filteredNumbers: 0,
    filteredIDs: 0,
    filteredDates: 0,
    filteredLowConfidence: 0,
    filteredGarbage: 0,
    filteredOrganizationValidation: 0,
    filteredPersonValidation: 0,
    finalCount: 0,
  };

  const filteredMap = new Map<string, GLiNEREntity>();

  rawEntities.forEach(entity => {
    // Trim whitespace but preserve original casing for output
    const originalText = entity.text.trim().replace(/\s+/g, ' ');
    const label = entity.label.toUpperCase();
    const confidence = entity.confidence;

    // 1. Confidence Threshold
    const threshold = label === 'PERSON' ? CONFIDENCE_THRESHOLDS.PERSON : CONFIDENCE_THRESHOLDS.ORGANIZATION;
    if (confidence < threshold) {
      diagnostics.filteredLowConfidence++;
      return;
    }

    // 2. Reject Numbers
    if (/^\d+$/.test(originalText)) {
      diagnostics.filteredNumbers++;
      return;
    }

    // 3. Reject OCR Garbage / Short strings
    if (originalText.length < 2 || /^[^a-zA-Z0-9]+$/.test(originalText) || /(.)\1{3,}/.test(originalText)) {
      diagnostics.filteredGarbage++;
      return;
    }

    // 4. Reject Metadata-like values (Dates, IDs, Amounts)
    // Dates
    if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(originalText)) {
      diagnostics.filteredDates++;
      return;
    }

    // IDs (Invoice, PAN, Aadhaar-like)
    const isID = 
      /^[A-Z]{3,}[0-9-]{3,}$/.test(originalText.toUpperCase()) || // INV-2025
      /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(originalText.toUpperCase()) || // PAN
      /^\d{4}\s\d{4}\s\d{4}$/.test(originalText) || // Aadhaar
      /^[A-Z0-9]{8,}$/.test(originalText.toUpperCase()) && /\d/.test(originalText) && /[a-zA-Z]/i.test(originalText); // Generic Alphanumeric ID

    if (isID) {
      diagnostics.filteredIDs++;
      return;
    }

    // Amounts
    if (/^[₹$£€]\d+/.test(originalText) || /^\d+\s?(USD|INR|GBP|EUR)/i.test(originalText)) {
        diagnostics.filteredGarbage++; // Count as garbage/metadata
        return;
    }

    // 5. Semantic Validation
    if (label === 'ORGANIZATION' && !isValidOrganization(originalText)) {
      diagnostics.filteredOrganizationValidation++;
      return;
    }

    if (label === 'PERSON' && !isValidPerson(originalText)) {
      diagnostics.filteredPersonValidation++;
      return;
    }

    // 6. Deduplication (use lowercased key, keep original text)
    const dedupeKey = `${label}:${originalText.toLowerCase()}`;

    if (!filteredMap.has(dedupeKey) || filteredMap.get(dedupeKey)!.confidence < confidence) {
      filteredMap.set(dedupeKey, {
        text: originalText, // Preserve original text
        label: label,
        confidence: confidence,
        start: entity.start,
        end: entity.end,
      });
    }
  });

  const finalEntities: GLiNEREntities = {
    persons: [],
    organizations: [],
  };

  filteredMap.forEach(entity => {
    if (entity.label === 'PERSON') {
      finalEntities.persons.push(entity.text);
    } else if (entity.label === 'ORGANIZATION') {
      finalEntities.organizations.push(entity.text);
    }
  });

  // Sort for consistency
  finalEntities.persons.sort();
  finalEntities.organizations.sort();

  diagnostics.finalCount = finalEntities.persons.length + finalEntities.organizations.length;

  return {
    entities: finalEntities,
    diagnostics,
  };
};

export const printSanitizationReport = (diagnostics: GLiNERSanitizationDiagnostics) => {
  console.log('==================================');
  console.log('GLiNER Sanitization Report');
  console.log('==================================');
  console.log(`Raw Entities: ${diagnostics.rawCount}`);
  console.log(`Filtered Numbers: ${diagnostics.filteredNumbers}`);
  console.log(`Filtered IDs: ${diagnostics.filteredIDs}`);
  console.log(`Filtered Dates: ${diagnostics.filteredDates}`);
  console.log(`Filtered Garbage: ${diagnostics.filteredGarbage}`);
  console.log(`Filtered Low Confidence: ${diagnostics.filteredLowConfidence}`);
  console.log(`Filtered Org Validation: ${diagnostics.filteredOrganizationValidation}`);
  console.log(`Filtered Person Validation: ${diagnostics.filteredPersonValidation}`);
  console.log(`Final Entities: ${diagnostics.finalCount}`);
  console.log('==================================');
};
