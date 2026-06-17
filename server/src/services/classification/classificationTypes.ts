export enum DocumentCategory {
  PAN_CARD = "PAN Card",
  AADHAAR_CARD = "Aadhaar",
  PASSPORT = "Passport",
  DRIVING_LICENSE = "Driving License",
  VOTER_ID = "Voter ID",
  BANK_STATEMENT = "Bank Statement",
  INVOICE = "Invoice",
  RECEIPT = "Receipt",
  MARKSHEET = "Marksheet",
  TRANSCRIPT = "Transcript",
  DEGREE_CERTIFICATE = "Degree Certificate",
  EMPLOYMENT_LETTER = "Employment Letter",
  SALARY_SLIP = "Salary Slip",
  MEDICAL_RECORD = "Medical Record",
  PRESCRIPTION = "Prescription",
  INSURANCE_POLICY = "Insurance Policy",
  UTILITY_BILL = "Utility Bill",
  ELECTRICITY_BILL = "Electricity Bill",
  WATER_BILL = "Water Bill",
  TAX_DOCUMENT = "Tax Document",
  PROPERTY_AGREEMENT = "Property Agreement",
  BUSINESS_REGISTRATION = "Business Registration",
  LEGAL_DOCUMENT = "Legal Document",
  OTHER = "Other"
}

export interface RuleClassificationResult {
  category: DocumentCategory;
  confidence: number;
  matchedRules: string[];
  evidence: string[];
}

export interface ClassificationComparisonResult {
  match: boolean;
  ruleCategory: DocumentCategory;
  geminiCategory: string;
  confidence: number;
  normalizedMatch: boolean;
}
