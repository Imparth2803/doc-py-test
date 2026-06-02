export const FOLDER_TEMPLATES = {
  "The Individual": [
    "00_Identity_and_Emergency",
    "01_Health_and_Medical",
    "02_Finance_and_Wealth",
    "03_Education_and_Career",
    "04_Hobbies_and_Self_Dev"
  ],
  "The Business": [
    "00_Incorporation_and_Legal",
    "01_Finance_and_Tax",
    "02_HR_and_Management",
    "03_Operations_and_Supply"
  ],
  "The Asset": [
    "00_Ownership_and_Legal",
    "01_Insurance_and_Taxes",
    "02_Utilities_and_Telecom",
    "03_Appliances_and_Warranties",
    "04_Maintenance_and_Inventory"
  ],
  "The Household": [
    "00_Legal_and_Legacy",
    "01_Family_Life_and_Media",
    "99_System_and_Staging"
  ]
};

export const ALL_FOLDERS = Object.values(FOLDER_TEMPLATES).flat();

export type DocumentTag = string;

export type Document = {
  _id: string;
  id: string; // Internal React key / legacy compatibility
  name: string;
  date: string;
  folder: string;
  vaultCategory?: string;
  vaultFolder?: string;
  tags: DocumentTag[];
  previewUrl?: string; // a data URL for preview
  mimeType?: string;
  entities: string[];
  docType?: string;
  metadata?: Record<string, string | undefined>;
};

