import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  sortRecentDocuments, 
  countProcessingDocuments, 
  calculateCompletion, 
  filterSearch,
  calculateAIInsights,
  calculateVaultAnalytics,
  calculateEntityStats,
  calculateTableStats,
  calculateFolderDistribution,
  calculateSystemHealth,
  detectPotentialDuplicates
} from '../utils/dashboardUtils';

export function useDashboard() {
  const { 
    documents, 
    aiUnits, 
    aiCredits, 
    aiUnitsUsed, 
    aiCreditsUsed,
    goToUpload, 
    goToArchive,
    goToTree,
    goToEntity,
    goToTimeline,
    setPricingOpen,
    goToArchiveWithContext
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' focus handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' && 
        document.activeElement?.tagName !== 'INPUT' && 
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredDocs = useMemo(() => {
    return filterSearch(documents, searchQuery);
  }, [documents, searchQuery]);

  const recentDocs = useMemo(() => {
    return sortRecentDocuments(documents);
  }, [documents]);

  const processingDocs = useMemo(() => {
    return countProcessingDocuments(documents);
  }, [documents]);

  const completion = useMemo(() => {
    return calculateCompletion(documents);
  }, [documents]);

  const failedDocsCount = useMemo(() => {
    return documents.filter(d => d.status === 'FAILED').length;
  }, [documents]);

  const completedDocsCount = useMemo(() => {
    return documents.filter(d => d.status === 'COMPLETED').length;
  }, [documents]);

  const estDocsLeft = Math.floor(aiUnits / 6.5);

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'upload':
        goToUpload();
        break;
      case 'archive':
        goToArchive();
        break;
      case 'tree':
        goToTree();
        break;
      case 'entity':
        goToEntity();
        break;
      case 'timeline':
        goToTimeline();
        break;
      case 'tables':
        goToArchive();
        break;
      default:
        break;
    }
  };

  // Phase 2 AI Analytics and Insights calculations
  const aiInsights = useMemo(() => {
    return calculateAIInsights(documents);
  }, [documents]);

  const vaultAnalytics = useMemo(() => {
    return calculateVaultAnalytics(documents, aiUnitsUsed);
  }, [documents, aiUnitsUsed]);

  const entityStats = useMemo(() => {
    return calculateEntityStats(documents);
  }, [documents]);

  const tableStats = useMemo(() => {
    return calculateTableStats(documents);
  }, [documents]);

  const folderDistribution = useMemo(() => {
    return calculateFolderDistribution(documents);
  }, [documents]);

  const systemHealth = useMemo(() => {
    return calculateSystemHealth(documents);
  }, [documents]);

  const potentialDuplicates = useMemo(() => {
    return detectPotentialDuplicates(documents);
  }, [documents]);

  return {
    documents,
    aiUnits,
    aiCredits,
    aiUnitsUsed,
    aiCreditsUsed,
    goToUpload,
    goToArchive,
    goToTree,
    goToEntity,
    goToTimeline,
    setPricingOpen,
    goToArchiveWithContext,
    searchQuery,
    setSearchQuery,
    searchInputRef,
    filteredDocs,
    recentDocs,
    processingDocs,
    completionRate: completion.completionRate,
    missingDocs: completion.missingDocs,
    failedDocsCount,
    completedDocsCount,
    estDocsLeft,
    handleQuickAction,
    aiInsights,
    vaultAnalytics,
    entityStats,
    tableStats,
    folderDistribution,
    systemHealth,
    potentialDuplicates
  };
}
