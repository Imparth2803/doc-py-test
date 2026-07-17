import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from 'react';
import { useSocket } from '../hooks/useSocket';
import { Document, FOLDER_TEMPLATES, ALL_FOLDERS } from '../types';
import { ApiDocument } from '../types/api';
import { getDocuments, updateDocument, getDocument } from '../services/documentApi';
type ViewState = 'login' | 'dashboard' | 'upload' | 'review' | 'archive' | 'tree' | 'entity' | 'timeline' | 'tables';
import { mapApiDocumentToDocument } from '../utils/documentMapper';
import { buildPreviewUrl } from '../utils/storagePathUtils';

export interface PendingDocument {
  file: File;
  base64Data: string;
  mimeType: string;
  serverUrl?: string;
  aiResult?: ApiDocument;
}

export interface ManualReminder {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  type: 'Personal' | 'Document' | 'Payment' | 'Renewal' | 'Other';
  relatedDocId?: string;
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
  tablesDocumentId: string | null;
  
  // Actions
  login: (token: string, user: any) => void;
  logout: () => void;
  goToDashboard: () => void;
  goToUpload: () => void;
  goToArchive: () => void;
  goToTree: () => void;
  goToEntity: (entityName?: string) => void;
  goToTimeline: () => void;
  goToTables: (docId: string) => void;
  setPendingDocument: (doc: PendingDocument | null) => void;
  addFolder: (folder: string) => void;
  saveDocument: (name: string, folder: string, category: string, tags: string[], previewUrl: string, entities: string[], docType: string, metadata: Record<string, string | undefined>, unitsCost?: number, rupeesCost?: number, mimeType?: string) => void;
  setPricingOpen: (open: boolean) => void;
  fetchLiveDocuments: () => Promise<void>;
  targetEntityName: string | null;
  targetArchiveDocId: string | null;
  targetArchiveDocType: string | null;
  goToArchiveWithContext: (params: { documentId?: string; recommendedDocumentType?: string }) => void;
  clearArchiveContext: () => void;
  manualReminders: ManualReminder[];
  addManualReminder: (reminder: Omit<ManualReminder, 'id'>) => void;
  deleteManualReminder: (id: string) => void;
  updateDocumentReminder: (docId: string, status: 'ACTIVE' | 'COMPLETED' | 'DISMISSED', completedDate?: string) => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentViewInternal] = useState<ViewState>(() => {
    const savedView = localStorage.getItem('currentView') as ViewState;
    return savedView || 'login';
  });

  console.log('[REACT RENDER] AppProvider rendering. currentView state:', currentView);

  const setCurrentView = (view: ViewState) => {
    console.log('[STATE UPDATE] setCurrentView called with:', view);
    setCurrentViewInternal(view);
    localStorage.setItem('currentView', view);
    console.log('[STATE UPDATE] currentView state update scheduled and localStorage set to:', view);
  };

  const [tablesDocumentId, setTablesDocumentId] = useState<string | null>(null);
  const [targetEntityName, setTargetEntityName] = useState<string | null>(null);
  const [targetArchiveDocId, setTargetArchiveDocId] = useState<string | null>(null);
  const [targetArchiveDocType, setTargetArchiveDocType] = useState<string | null>(null);
  const [manualReminders, setManualReminders] = useState<ManualReminder[]>(() => {
    const saved = localStorage.getItem('manualReminders');
    return saved ? JSON.parse(saved) : [];
  });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pendingDoc, setPendingDoc] = useState<PendingDocument | null>(null);
  const [user, setUser] = useState<any>(null);
  const isAuthenticated = !!user;
  const [customFolders, setCustomFolders] = useState<string[]>([]);

  const { subscribeToDocumentStatus } = useSocket();
  const cleanupsRef = useRef<Record<string, () => void>>({});

  useEffect(() => {
    const currentCleanups = cleanupsRef.current;
    const documentIds = documents.map(doc => doc._id);

    // Unsubscribe from IDs no longer in the list
    Object.keys(currentCleanups).forEach(id => {
      if (!documentIds.includes(id)) {
        console.log(`\n[SOCKET]\nUnsubscribe\nDocument:\n${id}\n----------------------------------------`);
        currentCleanups[id]();
        delete currentCleanups[id];
        console.log(`\n[SOCKET]\nCleanup entry removed\nDocument:\n${id}\n----------------------------------------`);
      }
    });

    // Subscribe to new IDs
    documents.forEach(doc => {
      if (!currentCleanups[doc._id]) {
        console.log(`\n[SOCKET]\nSubscribe\nDocument:\n${doc._id}\n----------------------------------------`);
        currentCleanups[doc._id] = subscribeToDocumentStatus(doc._id, async (newStatus) => {
          if (newStatus === 'COMPLETED' || newStatus === 'PARTIAL_SUCCESS') {
            try {
              const freshApiDoc = await getDocument(doc._id);
              const previewUrl = buildPreviewUrl(
                freshApiDoc.storagePath,
                undefined,
                freshApiDoc.updatedAt || Date.now()
              );
              const canonicalFolder = freshApiDoc.vaultFolder || 'Uploads';
              const freshMapped: Document = {
                _id: freshApiDoc._id,
                id: freshApiDoc._id,
                name: freshApiDoc.documentName || freshApiDoc.originalName,
                date: freshApiDoc.createdAt
                  ? new Date(freshApiDoc.createdAt).toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0],
                folder: canonicalFolder,
                vaultCategory: freshApiDoc.vaultCategory,
                vaultFolder: freshApiDoc.vaultFolder,
                status: freshApiDoc.status,
                tags: freshApiDoc.tags || [],
                entities: freshApiDoc.entities || [],
                docType: freshApiDoc.docType || 'Document',
                metadata: freshApiDoc.metadata || {},
                mimeType: freshApiDoc.mimeType,
                previewUrl,
                pinnedFields: freshApiDoc.pinnedFields || [],
                tables: freshApiDoc.tables,
                reminderState: freshApiDoc.reminderState
              };

              setDocuments(prevDocs =>
                prevDocs.map(d => d._id === doc._id ? freshMapped : d)
              );
              setPendingDoc(prevPending => {
                if (prevPending && prevPending.aiResult && prevPending.aiResult._id === doc._id) {
                  return {
                    ...prevPending,
                    aiResult: freshApiDoc
                  };
                }
                return prevPending;
              });

              // Refetch user profile to sync cumulative units (Phase 3)
              fetchUserProfile();
            } catch (err) {
              console.error('Failed to re-fetch completed document', err);
            }
          } else {
            setDocuments(prevDocs =>
              prevDocs.map(d => d._id === doc._id ? { ...d, status: newStatus as any } : d)
            );
            setPendingDoc(prevPending => {
              if (prevPending && prevPending.aiResult && prevPending.aiResult._id === doc._id) {
                return {
                  ...prevPending,
                  aiResult: {
                    ...prevPending.aiResult,
                    status: newStatus as any
                  }
                };
              }
              return prevPending;
            });
          }
        });
      } else {
        console.log(`\n[SOCKET]\nAlready subscribed\nDocument:\n${doc._id}\n----------------------------------------`);
      }
    });

    return () => {
      Object.keys(currentCleanups).forEach(id => {
        console.log(`\n[SOCKET]\nUnsubscribe\nDocument:\n${id}\n----------------------------------------`);
        currentCleanups[id]();
        delete currentCleanups[id];
        console.log(`\n[SOCKET]\nCleanup entry removed\nDocument:\n${id}\n----------------------------------------`);
      });
    };
  }, [documents.map(d => d._id).join(','), subscribeToDocumentStatus]);

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

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:8000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  // Synchronize AI Unit counters whenever user state changes
  useEffect(() => {
    if (user && user.usage) {
      setAiUnitsUsed(user.usage.totalAiUnits || 0);
      setAiCreditsUsed((user.usage.totalAiUnits || 0) * 0.30);
    }
  }, [user]);

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
    fetchUserProfile();
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
      'upload'
    );
  }; // Routes to Upload screen first
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

  const goToDashboard = () => {
    console.log('[CALLBACK] goToDashboard called');
    setCurrentView('dashboard');
  };
  const goToUpload = () => {
    console.log('[CALLBACK] goToUpload called');
    setCurrentView('upload');
  };
  const goToArchive = () => {
    console.log('[CALLBACK] goToArchive called');
    setCurrentView('archive');
  };
  const goToArchiveWithContext = (params: { documentId?: string; recommendedDocumentType?: string }) => {
    console.log('[CALLBACK] goToArchiveWithContext called with:', params);
    setTargetArchiveDocId(params.documentId || null);
    setTargetArchiveDocType(params.recommendedDocumentType || null);
    setCurrentView('archive');
  };
  const clearArchiveContext = () => {
    setTargetArchiveDocId(null);
    setTargetArchiveDocType(null);
  };
  const addManualReminder = (reminder: Omit<ManualReminder, 'id'>) => {
    const newReminder = {
      ...reminder,
      id: Math.random().toString(36).substring(2, 9)
    };
    setManualReminders(prev => {
      const updated = [...prev, newReminder];
      localStorage.setItem('manualReminders', JSON.stringify(updated));
      return updated;
    });
  };
  const deleteManualReminder = (id: string) => {
    setManualReminders(prev => {
      const updated = prev.filter(r => r.id !== id);
      localStorage.setItem('manualReminders', JSON.stringify(updated));
      return updated;
    });
  };
  const goToTree = () => {
    console.log('[CALLBACK] goToTree called');
    setCurrentView('tree');
  };
  const goToEntity = (entityName?: string) => {
    console.log('[CALLBACK] goToEntity called with:', entityName);
    setTargetEntityName(entityName || null);
    setCurrentView('entity');
  };
  const goToTimeline = () => {
    console.log('[CALLBACK] goToTimeline called');
    setCurrentView('timeline');
  };
  const goToTables = (docId: string) => {
    console.log('[CALLBACK] goToTables called for doc:', docId);
    setTablesDocumentId(docId);
    setCurrentView('tables');
  };
  const fetchLiveDocuments = async () => {
  try {
    const docs = await getDocuments();

    console.log(
      'Fetched MongoDB Documents:',
      docs
    );

    const mappedDocs: Document[] = docs.map(
      (doc: any) => {

        const previewUrl = buildPreviewUrl(
          doc.storagePath,
          undefined,
          doc.updatedAt || Date.now()
        );

        const canonicalFolder = doc.vaultFolder || 'Uploads';
        console.log(`[FETCH DOCUMENT] id=${doc._id} folder=${canonicalFolder} vaultFolder=${doc.vaultFolder || 'none'}`);

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

          folder: canonicalFolder,

          vaultCategory:
            doc.vaultCategory,

          vaultFolder:
            doc.vaultFolder,

          status:
            doc.status,

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

          previewUrl,

          pinnedFields: doc.pinnedFields || [],
          
          tables: doc.tables,
          reminderState: doc.reminderState
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

  const saveDocument = async (name: string, folder: string, category: string, tags: string[], previewUrl: string, entities: string[], docType: string, metadata: Record<string, string | undefined>, unitsCost = 5, rupeesCost = 1.5, mimeType?: string) => {
    try {
      console.log(`[SAVE DOCUMENT] folder=${folder} vaultFolder=${folder} vaultCategory=${category}`);

      if (pendingDoc?.aiResult?._id) {
        const documentId = pendingDoc.aiResult._id;
        
        // Prepare updates for backend
        // Future cleanup:
        // Remove metadata.folder entirely.
        // Use vaultFolder as the only persisted folder field.
        const updates: Partial<ApiDocument> & { vaultFolder: string; vaultCategory: string } = {
          originalName: name,
          tags,
          entities,
          docType,
          vaultFolder: folder,
          vaultCategory: category,
          metadata: {
            ...(metadata as any),
            summaryFields: (metadata as any).summaryFields || {}, // Explicitly preserve summaryFields
            folder // Store folder in metadata since schema doesn't have it (migration fallback)
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
        vaultFolder: folder,
        vaultCategory: category,
        tags,
        previewUrl,
        entities,
        docType,
        metadata: {
          ...metadata,
          folder // migration fallback
        },
        mimeType,
        pinnedFields: pendingDoc?.aiResult?.pinnedFields || [],
        reminderState: pendingDoc?.aiResult?.reminderState
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
      await fetchUserProfile();

    } catch (error) {
      console.error('Failed to save document:', error);
      alert('Failed to save changes to the vault. Please try again.');
    }
  };

  const updateDocumentReminder = async (
    docId: string,
    status: 'ACTIVE' | 'COMPLETED' | 'DISMISSED',
    completedDate?: string
  ) => {
    try {
      const updates = {
        reminderState: {
          status,
          completedDate,
          updatedAt: new Date().toISOString()
        }
      };
      const updatedApiDoc = await updateDocument(docId, updates);
      
      // Update local state immediately
      setDocuments(prev => prev.map(d => {
        if (d._id === docId) {
          return {
            ...d,
            reminderState: updatedApiDoc.reminderState
          };
        }
        return d;
      }));
    } catch (error) {
      console.error('Failed to update document reminder state:', error);
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
      tablesDocumentId,
      targetEntityName,
      targetArchiveDocId,
      targetArchiveDocType,
      addFolder,
      login,
      logout,
      goToDashboard,
      goToUpload,
      goToArchive,
      goToArchiveWithContext,
      clearArchiveContext,
      goToTree,
      goToEntity,
      goToTimeline,
      goToTables,
      setPendingDocument,
      saveDocument,
      setPricingOpen,
      fetchLiveDocuments,
      manualReminders,
      addManualReminder,
      deleteManualReminder,
      updateDocumentReminder,
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
