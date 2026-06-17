import { DocumentCategory } from './classificationTypes';
import { ExtractedMetadata } from '../metadata/types';

export interface RuleDefinition {
  category: DocumentCategory;
  keywords: { phrase: string; score: number }[];
  requiredRegex?: (metadata: ExtractedMetadata) => boolean;
  regexBonus?: { check: (metadata: ExtractedMetadata) => boolean; score: number }[];
}

export const CLASSIFICATION_RULES: RuleDefinition[] = [
  {
    category: DocumentCategory.PAN_CARD,
    keywords: [
      { phrase: 'income tax department', score: 40 },
      { phrase: 'permanent account number', score: 40 },
      { phrase: 'govt. of india', score: 10 },
      { phrase: 'pan', score: 20 },
      { phrase: 'signature', score: 5 }
    ],
    requiredRegex: (meta) => meta.ids.some(id => /^[A-Z]{5}\d{4}[A-Z]$/.test(id)),
    regexBonus: [
      { check: (meta) => meta.dates.length > 0, score: 5 }
    ]
  },
  {
    category: DocumentCategory.AADHAAR_CARD,
    keywords: [
      { phrase: 'government of india', score: 30 },
      { phrase: 'unique identification authority of india', score: 40 },
      { phrase: 'uidai', score: 30 },
      { phrase: 'mera aadhaar', score: 20 },
      { phrase: 'enrollment no', score: 15 }
    ],
    requiredRegex: (meta) => meta.ids.some(id => /^\d{4}\s\d{4}\s\d{4}$|^\d{12}$/.test(id)),
    regexBonus: [
      { check: (meta) => meta.dates.length > 0, score: 5 }
    ]
  },
  {
    category: DocumentCategory.PASSPORT,
    keywords: [
      { phrase: 'republic of india', score: 30 },
      { phrase: 'passport', score: 40 },
      { phrase: 'nationality', score: 20 },
      { phrase: 'place of birth', score: 15 },
      { phrase: 'date of issue', score: 15 },
      { phrase: 'date of expiry', score: 15 }
    ],
    requiredRegex: (meta) => meta.ids.some(id => /^[A-Z][1-9]\d{6}$/.test(id))
  },
  {
    category: DocumentCategory.BANK_STATEMENT,
    keywords: [
      { phrase: 'account number', score: 20 },
      { phrase: 'opening balance', score: 25 },
      { phrase: 'closing balance', score: 25 },
      { phrase: 'transaction date', score: 15 },
      { phrase: 'statement of account', score: 30 },
      { phrase: 'debit', score: 10 },
      { phrase: 'credit', score: 10 },
      { phrase: 'branch', score: 10 }
    ],
    regexBonus: [
      { check: (meta) => meta.amounts.length > 5, score: 30 },
      { check: (meta) => meta.dates.length > 3, score: 10 }
    ]
  },
  {
    category: DocumentCategory.INVOICE,
    keywords: [
      { phrase: 'invoice number', score: 30 },
      { phrase: 'invoice date', score: 20 },
      { phrase: 'tax invoice', score: 40 },
      { phrase: 'total amount', score: 15 },
      { phrase: 'gstin', score: 20 },
      { phrase: 'bill to', score: 15 },
      { phrase: 'subtotal', score: 15 }
    ],
    regexBonus: [
      { check: (meta) => meta.amounts.length > 0, score: 10 }
    ]
  },
  {
    category: DocumentCategory.ELECTRICITY_BILL,
    keywords: [
      { phrase: 'electricity bill', score: 40 },
      { phrase: 'consumer number', score: 30 },
      { phrase: 'meter reading', score: 20 },
      { phrase: 'due date', score: 15 },
      { phrase: 'units consumed', score: 20 }
    ],
    regexBonus: [
      { check: (meta) => meta.amounts.length > 0, score: 10 }
    ]
  },
  {
    category: DocumentCategory.WATER_BILL,
    keywords: [
      { phrase: 'water bill', score: 40 },
      { phrase: 'consumer number', score: 30 },
      { phrase: 'meter reading', score: 20 },
      { phrase: 'due date', score: 15 }
    ]
  },
  {
    category: DocumentCategory.SALARY_SLIP,
    keywords: [
      { phrase: 'salary slip', score: 40 },
      { phrase: 'payslip', score: 40 },
      { phrase: 'gross salary', score: 20 },
      { phrase: 'net salary', score: 20 },
      { phrase: 'employee id', score: 20 },
      { phrase: 'provident fund', score: 10 },
      { phrase: 'deductions', score: 10 },
      { phrase: 'earnings', score: 10 }
    ]
  },
  {
    category: DocumentCategory.DEGREE_CERTIFICATE,
    keywords: [
      { phrase: 'bachelor of', score: 30 },
      { phrase: 'master of', score: 30 },
      { phrase: 'degree awarded', score: 30 },
      { phrase: 'convocation', score: 20 },
      { phrase: 'has been admitted to the degree', score: 40 }
    ]
  },
  {
    category: DocumentCategory.MARKSHEET,
    keywords: [
      { phrase: 'marks obtained', score: 30 },
      { phrase: 'grade', score: 20 },
      { phrase: 'semester', score: 20 },
      { phrase: 'roll number', score: 20 },
      { phrase: 'statement of marks', score: 40 },
      { phrase: 'cgpa', score: 20 }
    ]
  },
  {
    category: DocumentCategory.MEDICAL_RECORD,
    keywords: [
      { phrase: 'medical report', score: 30 },
      { phrase: 'patient name', score: 20 },
      { phrase: 'diagnosis', score: 20 },
      { phrase: 'hospital', score: 15 },
      { phrase: 'clinic', score: 15 },
      { phrase: 'blood test', score: 20 },
      { phrase: 'haemoglobin', score: 10 }
    ]
  },
  {
    category: DocumentCategory.INSURANCE_POLICY,
    keywords: [
      { phrase: 'insurance policy', score: 40 },
      { phrase: 'policy number', score: 30 },
      { phrase: 'premium', score: 20 },
      { phrase: 'sum assured', score: 20 },
      { phrase: 'insured', score: 20 },
      { phrase: 'nominee', score: 10 }
    ]
  }
];
