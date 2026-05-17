import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Document, FOLDER_TEMPLATES, ALL_FOLDERS } from '../types';
import { AIAnalysisResult } from '../services/geminiService';

type ViewState = 'login' | 'dashboard' | 'upload' | 'review' | 'archive' | 'tree' | 'entity';

export interface PendingDocument {
  file: File;
  base64Data: string;
  mimeType: string;
  aiResult?: AIAnalysisResult;
}

interface AppState {
  currentView: ViewState;
  documents: Document[];
  pendingDoc: PendingDocument | null;
  customFolders: string[];
  aiUnits: number;
  aiCredits: number;
  aiUnitsUsed: number;
  aiCreditsUsed: number;
  isPricingOpen: boolean;
  
  // Actions
  login: () => void;
  logout: () => void;
  goToDashboard: () => void;
  goToUpload: () => void;
  goToArchive: () => void;
  goToTree: () => void;
  goToEntity: () => void;
  setPendingDocument: (doc: PendingDocument | null) => void;
  saveDocument: (name: string, folder: string, tags: string[], previewUrl: string, entities: string[], docType: string, metadata: Record<string, string | undefined>, unitsCost?: number, rupeesCost?: number, mimeType?: string) => void;
  addFolder: (folder: string) => void;
  setPricingOpen: (open: boolean) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<ViewState>('login');
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 'd1',
      name: 'Aadhar Card - Tejas',
      date: '2023-01-15',
      folder: '00_Identity_and_Emergency',
      tags: ['ID', 'Aadhar', 'Government'],
      entities: ['Tejas'],
      docType: 'Identity',
      metadata: { documentNumber: '1234 5678 9012', issuer: 'UIDAI' }
    },
    {
      id: 'd2',
      name: 'Vaccination Record 2024',
      date: '2024-05-10',
      folder: '01_Health_and_Medical',
      tags: ['Health', 'Vaccine', 'Pediatric'],
      entities: ['11-year-old Son'],
      docType: 'Medical Record',
      metadata: { issuer: 'City Hospital' }
    },
    {
      id: 'd3',
      name: 'MOA - Nijitek Pvt Ltd',
      date: '2022-11-20',
      folder: '00_Incorporation_and_Legal',
      tags: ['Incorporation', 'Legal', 'Business'],
      entities: ['Nijitek Private Limited'],
      docType: 'Corporate Document',
      metadata: { documentNumber: 'U72900GJ2022PTC123456', issueDate: '2022-11-20' }
    },
    {
      id: 'd4',
      name: 'Property Tax Receipt 2025',
      date: '2025-02-14',
      folder: '01_Insurance_and_Taxes',
      tags: ['Tax', 'Property', 'Receipt'],
      entities: ['Ahmedabad Residence'],
      docType: 'Receipt',
      metadata: { documentNumber: 'PT-98765', issuer: 'AMC' }
    },
    {
      id: 'd5',
      name: 'Honda City Registration',
      date: '2024-08-01',
      folder: '00_Ownership_and_Legal',
      tags: ['Vehicle', 'RC', 'Honda'],
      entities: ['The Car'],
      docType: 'Registration',
      metadata: { documentNumber: 'GJ-01-AB-1234', expiryDate: '2039-08-01', issuer: 'RTO Ahmedabad' }
    },
    {
      id: 'd6',
      name: 'Pest Control Invoice',
      date: '2026-01-10',
      folder: '04_Maintenance_and_Inventory',
      tags: ['Maintenance', 'Invoice', 'Home'],
      entities: ['Ahmedabad Residence'],
      docType: 'Invoice',
      metadata: { issuer: 'Urban Company' }
    },
    {
      id: 'd7',
      name: 'Marriage Certificate',
      date: '2015-12-01',
      folder: '00_Identity_and_Emergency',
      tags: ['Marriage', 'Certificate', 'Civil'],
      entities: ['Tejas', 'Kajal'],
      docType: 'Identity',
      metadata: { documentNumber: 'MC-123456', issuer: 'Government of Gujarat' }
    },
    {
      id: 'd8',
      name: 'Passport - Kajal',
      date: '2021-04-12',
      folder: '00_Identity_and_Emergency',
      tags: ['Passport', 'Travel', 'Gov'],
      entities: ['Kajal'],
      docType: 'Identity',
      metadata: { documentNumber: 'K9876543', expiryDate: '2031-04-11', issuer: 'Gov of India' }
    },
    {
      id: 'd9',
      name: 'Birth Certificate - Son',
      date: '2015-06-15',
      folder: '00_Identity_and_Emergency',
      tags: ['Birth', 'Certificate', 'Son'],
      entities: ['11-year-old Son'],
      docType: 'Identity',
      metadata: { documentNumber: 'BC-2015-001', issuer: 'Ahmedabad Municipal Corporation' }
    },
    {
      id: 'd10',
      name: 'Nijitek Private Limited - GST Registration',
      date: '2023-01-05',
      folder: '00_Incorporation_and_Legal',
      tags: ['GST', 'Tax', 'Business'],
      entities: ['Nijitek Private Limited'],
      docType: 'Tax',
      metadata: { documentNumber: '24AAACN1234E1Z1', issuer: 'GST Authority' }
    },
    {
      id: 'd11',
      name: 'Car Insurance Policy',
      date: '2025-07-20',
      folder: '01_Maintenance_and_Insurance',
      tags: ['Insurance', 'Car', 'Policy'],
      entities: ['The Car'],
      docType: 'Insurance',
      metadata: { documentNumber: 'POL-100200300', expiryDate: '2026-07-19', issuer: 'HDFC Ergo' }
    },
    {
      id: 'd12',
      name: 'Bank Statement - Joint Account',
      date: '2026-04-30',
      folder: '02_Finance_and_Statements',
      tags: ['Bank', 'Finance', 'Joint'],
      entities: ['Tejas', 'Kajal'],
      docType: 'Statement',
      metadata: { issuer: 'HDFC Bank' }
    },
    {
      id: 'd13',
      name: 'Nijitek - Board Resolution (New Office)',
      date: '2024-11-05',
      folder: '02_Board_and_Shareholders',
      tags: ['Board', 'Resolution', 'Business'],
      entities: ['Nijitek Private Limited'],
      docType: 'Minutes',
      metadata: { issuer: 'Board of Directors' }
    },
    {
      id: 'd14',
      name: 'Property Tax Receipt 2024-25',
      date: '2024-10-10',
      folder: '01_Insurance_and_Taxes',
      tags: ['Tax', 'Property', 'Ahmedabad'],
      entities: ['Ahmedabad Residence'],
      docType: 'Receipt',
      metadata: { documentNumber: 'TX-88221', issuer: 'AMC' }
    },
    {
      id: 'd15',
      name: 'Medical Insurance - Family Floater',
      date: '2026-02-01',
      folder: '01_Maintenance_and_Insurance',
      tags: ['Health', 'Insurance', 'Family'],
      entities: ['Tejas', 'Kajal', '11-year-old Son'],
      docType: 'Policy',
      metadata: { documentNumber: 'MED-778899', expiryDate: '2027-01-31', issuer: 'Star Health' }
    },
    {
      id: 'd16',
      name: 'Car Service Invoice - Periodic Maintenance',
      date: '2025-12-15',
      folder: '04_Maintenance_and_Inventory',
      tags: ['Service', 'Maintenance', 'Honda'],
      entities: ['The Car'],
      docType: 'Invoice',
      metadata: { issuer: 'Honda Authorized Service Center' }
    },
    {
      id: 'd17',
      name: 'Passport - Tejas',
      date: '2020-01-20',
      folder: '00_Identity_and_Emergency',
      tags: ['Passport', 'Identity', 'Travel'],
      entities: ['Tejas'],
      docType: 'Identity',
      metadata: { documentNumber: 'Z1234567', expiryDate: '2030-01-19', issuer: 'Gov of India' }
    }
  ]);
  const [pendingDoc, setPendingDoc] = useState<PendingDocument | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [aiUnits, setAiUnits] = useState(485); // Starting balance
  const [aiCredits, setAiCredits] = useState(142.50); // Starting balance in Rs
  const [aiUnitsUsed, setAiUnitsUsed] = useState(1245); // Seeded lifetime used
  const [aiCreditsUsed, setAiCreditsUsed] = useState(373.50); // Seeded lifetime used
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  const addFolder = (folder: string) => {
    setCustomFolders(prev => {
      if (!prev.includes(folder) && !ALL_FOLDERS.includes(folder)) {
        return [...prev, folder];
      }
      return prev;
    });
  };

  const setPricingOpen = (open: boolean) => setIsPricingOpen(open);

  const login = () => setCurrentView('dashboard'); // Routes to Dashboard first
  const logout = () => {
    setCurrentView('login');
    setPendingDoc(null);
  };

  const goToDashboard = () => setCurrentView('dashboard');
  const goToUpload = () => setCurrentView('upload');
  const goToArchive = () => setCurrentView('archive');
  const goToTree = () => setCurrentView('tree');
  const goToEntity = () => setCurrentView('entity');
  
  const setPendingDocument = (doc: PendingDocument | null) => {
    setPendingDoc(doc);
    if (doc) {
      setCurrentView('review');
    }
  };

  const saveDocument = (name: string, folder: string, tags: string[], previewUrl: string, entities: string[], docType: string, metadata: Record<string, string | undefined>, unitsCost = 5, rupeesCost = 1.5, mimeType?: string) => {
    const newDoc: Document = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      date: new Date().toISOString().split('T')[0],
      folder,
      tags,
      previewUrl,
      entities,
      docType,
      metadata,
      mimeType
    };
    setDocuments(prev => [...prev, newDoc]);
    
    // Deduct AI credits
    setAiUnits(prev => Math.max(0, prev - unitsCost));
    setAiCredits(prev => Math.max(0, prev - rupeesCost));

    // Track lifetime usage
    setAiUnitsUsed(prev => prev + unitsCost);
    setAiCreditsUsed(prev => prev + rupeesCost);

    setPendingDoc(null);
    setCurrentView('archive');
  };

  return (
    <AppContext.Provider value={{
      currentView,
      documents,
      pendingDoc,
      customFolders,
      aiUnits,
      aiCredits,
      aiUnitsUsed,
      aiCreditsUsed,
      isPricingOpen,
      login,
      logout,
      goToDashboard,
      goToUpload,
      goToArchive,
      goToTree,
      goToEntity,
      setPendingDocument,
      saveDocument,
      addFolder,
      setPricingOpen
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
