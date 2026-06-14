import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Document, FOLDER_TEMPLATES, ALL_FOLDERS } from '../types';
import { ApiDocument } from '../types/api';
import { getDocuments, updateDocument } from '../services/documentApi';
type ViewState = 'login' | 'dashboard' | 'upload' | 'review' | 'archive' | 'tree' | 'entity' | 'timeline';
import { mapApiDocumentToDocument } from '../utils/documentMapper';

export interface PendingDocument {
  file: File;
  base64Data: string;
  mimeType: string;
  serverUrl?: string;
  aiResult?: ApiDocument;
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
  user: any | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (token: string, user: any) => void;
  logout: () => void;
  goToDashboard: () => void;
  goToUpload: () => void;
  goToArchive: () => void;
  goToTree: () => void;
  goToEntity: () => void;
  goToTimeline: () => void;
  setPendingDocument: (doc: PendingDocument | null) => void;
  addFolder: (folder: string) => void;
  saveDocument: (name: string, folder: string, tags: string[], previewUrl: string, entities: string[], docType: string, metadata: Record<string, string | undefined>, unitsCost?: number, rupeesCost?: number, mimeType?: string) => void;
  setPricingOpen: (open: boolean) => void;
  fetchLiveDocuments: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentViewInternal] = useState<ViewState>(() => {
    const savedView = localStorage.getItem('currentView') as ViewState;
    return savedView || 'login';
  });

  const setCurrentView = (view: ViewState) => {
    setCurrentViewInternal(view);
    localStorage.setItem('currentView', view);
  };

  const [documents, setDocuments] = useState<Document[]>([]);
  const [pendingDoc, setPendingDoc] = useState<PendingDocument | null>(null);
  const [user, setUser] = useState<any>(null);
  const isAuthenticated = !!user;
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const addFolder = (folderName: string) => {
    if (!folderName.trim()) return;

  setCustomFolders(prev =>
    prev.includes(folderName)
      ? prev
      : [...prev, folderName]
  );
  };
  const [aiUnits, setAiUnits] = useState(485); // Starting balance
  const [aiCredits, setAiCredits] = useState(142.50); // Starting balance in Rs
  const [aiUnitsUsed, setAiUnitsUsed] = useState(1245); // Seeded lifetime used
  const [aiCreditsUsed, setAiCreditsUsed] = useState(373.50); // Seeded lifetime used
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  useEffect(() => {
    const savedUser =
      localStorage.getItem('user');

    if (savedUser) {
      try {
        setUser(
          JSON.parse(savedUser)
        );
      } catch (error) {
        console.error(
          'Failed to restore user',
          error
        );
      }
    }

    fetchLiveDocuments();
  }, []);
  
  const setPricingOpen = (open: boolean) => setIsPricingOpen(open);

  const login = (
    token: string,
    userData: any
  ) => {
    localStorage.setItem(
      'token',
      token
    );

    localStorage.setItem(
      'user',
      JSON.stringify(userData)
    );

    setUser(userData);

    setCurrentView(
      'dashboard'
    );
  }; // Routes to Dashboard first
  const logout = () => {
    localStorage.removeItem(
      'token'
    );

    localStorage.removeItem(
      'user'
    );

    setUser(null);

    setCurrentView(
      'login'
    );

    setPendingDoc(null);
  };

  const goToDashboard = () => setCurrentView('dashboard');
  const goToUpload = () => setCurrentView('upload');
  const goToArchive = () => setCurrentView('archive');
  const goToTree = () => setCurrentView('tree');
  const goToEntity = () => setCurrentView('entity');
  const goToTimeline = () => setCurrentView('timeline');
  const fetchLiveDocuments = async () => {
  try {
    const docs = await getDocuments();

    console.log(
      'Fetched MongoDB Documents:',
      docs
    );

    const mappedDocs: Document[] = docs.map(
      (doc: any) => {

        const filename =
          doc.storagePath
            ?.split(/[\\/]/)
            .pop();

        const previewUrl =
          filename
            ? `http://localhost:8000/uploads/${encodeURIComponent(filename)}?v=${new Date(doc.updatedAt || Date.now()).getTime()}`
            : undefined;

        return {
          _id: doc._id,

          id: doc._id,

          name:
            doc.documentName ||
            doc.originalName,

          date: doc.createdAt
            ? new Date(doc.createdAt)
                .toISOString()
                .split('T')[0]
            : new Date()
                .toISOString()
                .split('T')[0],

          folder:
            doc.vaultFolder ||
            'Uploads',

          vaultCategory:
            doc.vaultCategory,

          vaultFolder:
            doc.vaultFolder,

          tags:
            doc.tags || [],

          entities:
            doc.entities || [],

          docType:
            doc.docType ||
            'Document',

          metadata:
            doc.metadata || {},

          mimeType:
            doc.mimeType,

          previewUrl
        };
      }
    );

    setDocuments(mappedDocs);
  } catch (error) {
    console.error(
      'Fetch documents error:',
      error
    );
  }
};
  
  const setPendingDocument = (doc: PendingDocument | null) => {
    setPendingDoc(doc);
    if (doc) {
      setCurrentView('review');
    }
  };

  const saveDocument = async (name: string, folder: string, tags: string[], previewUrl: string, entities: string[], docType: string, metadata: Record<string, string | undefined>, unitsCost = 5, rupeesCost = 1.5, mimeType?: string) => {
    try {
      if (pendingDoc?.aiResult?._id) {
        const documentId = pendingDoc.aiResult._id;
        
        // Prepare updates for backend
        const updates: Partial<ApiDocument> = {
          originalName: name,
          tags,
          entities,
          docType,
          metadata: {
            ...(metadata as any),
            summaryFields: (metadata as any).summaryFields || {}, // Explicitly preserve summaryFields
            folder // Store folder in metadata since schema doesn't have it
          }
        };

        console.log('Saving document updates to backend...', documentId, updates);
        await updateDocument(documentId, updates);
      }

      // Update local state and UI
      const newDoc: Document = {
        _id: pendingDoc?.aiResult?._id || Math.random().toString(36).substr(2, 9),
        id: pendingDoc?.aiResult?._id || Math.random().toString(36).substr(2, 9),
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
      
      setDocuments(prev => {
        // If it was an update, replace the existing one, otherwise append
        const exists = prev.some(d => d._id === newDoc._id);
        if (exists) {
          return prev.map(d => d._id === newDoc._id ? newDoc : d);
        }
        return [...prev, newDoc];
      });
      
      // Deduct AI credits
      setAiUnits(prev => Math.max(0, prev - unitsCost));
      setAiCredits(prev => Math.max(0, prev - rupeesCost));

      // Track lifetime usage
      setAiUnitsUsed(prev => prev + unitsCost);
      setAiCreditsUsed(prev => prev + rupeesCost);

      setPendingDoc(null);
      setCurrentView('archive');
      
      // Force a fresh fetch from backend to ensure synchronization
      await fetchLiveDocuments();

    } catch (error) {
      console.error('Failed to save document:', error);
      alert('Failed to save changes to the vault. Please try again.');
    }
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
      user,
      isAuthenticated,
      addFolder,
      login,
      logout,
      goToDashboard,
      goToUpload,
      goToArchive,
      goToTree,
      goToEntity,
      goToTimeline,
      setPendingDocument,
      saveDocument,
      setPricingOpen,
      fetchLiveDocuments,
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
