export const RECOMMENDED_DOCS = [
  // Critical
  { id: 'aadhaar', title: 'Aadhaar', tagsMatch: ['aadhaar', 'aadhar', 'uidai'], category: 'Identity & Civil', priority: 'Critical' },
  { id: 'pan', title: 'PAN Card', tagsMatch: ['pan', 'permanent account number'], category: 'Identity & Civil', priority: 'Critical' },
  { id: 'passport', title: 'Passport', tagsMatch: ['passport'], category: 'Identity & Civil', priority: 'Critical' },

  // High
  { id: 'driving', title: 'Driving Licence', tagsMatch: ['driving', 'license', 'licence'], category: 'Identity & Civil', priority: 'High' },
  { id: 'healthinsurance', title: 'Health Insurance', tagsMatch: ['health', 'insurance', 'medical policy'], category: 'Health & Medical', priority: 'High' },
  { id: 'vehicleinsurance', title: 'Vehicle Insurance', tagsMatch: ['vehicle insurance', 'car insurance', 'bike insurance', 'motor policy'], category: 'Vehicles', priority: 'High' },

  // Medium
  { id: 'utility', title: 'Utility Bill', tagsMatch: ['utility', 'electricity', 'water', 'gas', 'bill'], category: 'Utilities', priority: 'Medium' },
  { id: 'property', title: 'Property Documents', tagsMatch: ['property', 'deed', 'mortgage', 'lease', 'rent'], category: 'Property & Housing', priority: 'Medium' },
  { id: 'tax', title: 'Tax Documents', tagsMatch: ['tax', 'return', 'w2', '1040'], category: 'Finance & Taxes', priority: 'Medium' },
  { id: 'educational', title: 'Educational Certificates', tagsMatch: ['certificate', 'degree', 'diploma', 'marksheet', 'educational'], category: 'Education & Career', priority: 'Medium' }
];

export const ALL_FOLDERS = [
  "00_Identity_and_Emergency",
  "01_Health_and_Medical",
  "02_Finance_and_Wealth",
  "03_Education_and_Career",
  "04_Hobbies_and_Self_Dev"
];
