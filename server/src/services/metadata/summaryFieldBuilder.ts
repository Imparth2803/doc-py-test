import { DocumentCategory } from '../classification/classificationTypes';
import { ExtractedMetadata } from '../metadata/types';
import { GLiNEREntities } from '../entities/types';

export interface SummaryFieldResult {
  fields: Record<string, string>;
  diagnostics: Record<string, string>;
}

// -----------------------------------------------------------------------------
// Core Extractors
// -----------------------------------------------------------------------------

const findPanNumber = (ids: string[]): string | undefined => {
  return ids.find(id => /^[A-Z]{5}\d{4}[A-Z]$/.test(id.toUpperCase()));
};

const findAadhaarNumber = (ids: string[]): string | undefined => {
  return ids.find(id => /^\d{4}\s\d{4}\s\d{4}$/.test(id) || /^\d{12}$/.test(id));
};

const findPassportNumber = (ids: string[]): string | undefined => {
  return ids.find(id => /^[A-Z][1-9]\d{6}$/.test(id.toUpperCase()));
};

const findBestDate = (dates: string[]): string | undefined => {
  if (!dates || dates.length === 0) return undefined;
  // Fallback to first date if no table data available
  return dates[0];
};

const findLargestAmount = (amounts: string[]): string | undefined => {
  if (!amounts || amounts.length === 0) return undefined;
  
  const parsedAmounts = amounts.map(amount => {
    // Remove non-numeric characters except decimals
    const numericStr = amount.replace(/[^0-9.]/g, '');
    const value = parseFloat(numericStr);
    return { original: amount, value: isNaN(value) ? 0 : value };
  });

  parsedAmounts.sort((a, b) => b.value - a.value);
  return parsedAmounts[0].original;
};

const findOrganization = (orgs: string[]): string | undefined => {
  if (!orgs || orgs.length === 0) return undefined;
  return orgs[0];
};

const findPerson = (persons: string[]): string | undefined => {
  if (!persons || persons.length === 0) return undefined;
  return persons[0];
};

const findBank = (entities: GLiNEREntities): string | undefined => {
  const orgs = entities.organizations || [];
  const bankMatch = orgs.find(org => {
    const upper = org.toUpperCase();
    return upper.includes('BANK') || upper.includes('SAHAKARI') || upper.includes('LTD');
  });
  if (bankMatch) return bankMatch;
  if (orgs.length > 0) return orgs[0];
  return undefined;
};

const findAccountHolder = (persons: string[]): string | undefined => {
  if (!persons || persons.length === 0) return undefined;
  return persons.join(', ');
};

const findFieldFromTables = (tables: any[], searchKeys: string[]): string | undefined => {
  if (!tables || tables.length === 0) return undefined;
  // TODO: Implement actual Excel parsing if required, or rely on OCR tabular text.
  // For Phase 5C.3, we skip heavy file I/O Excel parsing and rely on Regex/GLiNER 
  // since the tables are stored as file paths on disk, not JSON in memory.
  return undefined; 
};

// -----------------------------------------------------------------------------
// Category Builders
// -----------------------------------------------------------------------------

export const buildSummaryFields = (
  category: DocumentCategory | string,
  metadata: ExtractedMetadata,
  entities: GLiNEREntities,
  tables?: any[]
): SummaryFieldResult => {
  
  const fields: Record<string, string> = {};
  const diagnostics: Record<string, string> = {};

  const addField = (key: string, value: string | undefined, source: string) => {
    if (value) {
      fields[key] = value;
      diagnostics[key] = source;
    }
  };

  switch (category) {
    case DocumentCategory.PAN_CARD:
      addField('PAN Number', findPanNumber(metadata.ids), 'regex');
      addField('Holder Name', findPerson(entities.persons), 'gliner');
      break;

    case DocumentCategory.AADHAAR_CARD:
      addField('Aadhaar Number', findAadhaarNumber(metadata.ids), 'regex');
      addField('Holder Name', findPerson(entities.persons), 'gliner');
      break;

    case DocumentCategory.PASSPORT:
      addField('Passport Number', findPassportNumber(metadata.ids), 'regex');
      addField('Holder Name', findPerson(entities.persons), 'gliner');
      // Passport expiry is hard to differentiate from DOB via raw regex without context
      break;

    case DocumentCategory.BANK_STATEMENT:
      addField('Bank', findBank(entities), 'gliner');
      addField('Account Holder', findAccountHolder(entities.persons), 'gliner');
      addField('Statement Date', findBestDate(metadata.dates), 'regex');
      break;

    case DocumentCategory.INVOICE:
      addField('Vendor', findOrganization(entities.organizations), 'gliner');
      addField('Invoice Number', metadata.ids[0], 'regex'); // Fallback to first ID
      addField('Invoice Date', findBestDate(metadata.dates), 'regex');
      addField('Total Amount', findLargestAmount(metadata.amounts), 'regex');
      break;

    case DocumentCategory.SALARY_SLIP:
      addField('Employer', findOrganization(entities.organizations), 'gliner');
      addField('Employee', findPerson(entities.persons), 'gliner');
      addField('Net Salary', findLargestAmount(metadata.amounts), 'regex');
      addField('Date', findBestDate(metadata.dates), 'regex');
      break;

    case DocumentCategory.ELECTRICITY_BILL:
    case DocumentCategory.WATER_BILL:
      addField('Provider', findOrganization(entities.organizations), 'gliner');
      addField('Consumer Number', metadata.ids[0], 'regex');
      addField('Due Date', findBestDate(metadata.dates), 'regex');
      addField('Total Amount', findLargestAmount(metadata.amounts), 'regex');
      break;

    case DocumentCategory.INSURANCE_POLICY:
      addField('Insurer', findOrganization(entities.organizations), 'gliner');
      addField('Policy Number', metadata.ids[0], 'regex');
      addField('Policy Date', findBestDate(metadata.dates), 'regex');
      break;

    case DocumentCategory.MEDICAL_RECORD:
      addField('Hospital', findOrganization(entities.organizations), 'gliner');
      addField('Patient', findPerson(entities.persons), 'gliner');
      addField('Date', findBestDate(metadata.dates), 'regex');
      break;

    default:
      // Generic fallback for OTHER
      addField('Organization', findOrganization(entities.organizations), 'gliner');
      addField('Date', findBestDate(metadata.dates), 'regex');
      addField('Amount', findLargestAmount(metadata.amounts), 'regex');
      break;
  }

  // Ensure maximum 10 fields to prevent bloating
  const limitedFields: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(fields)) {
    if (count >= 10) break;
    limitedFields[k] = v;
    count++;
  }

  return {
    fields: limitedFields,
    diagnostics
  };
};
