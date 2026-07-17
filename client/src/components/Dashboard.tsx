import React from 'react';
import { TopNav } from './TopNav';
import { Search, FileText, Download, Plus } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardGrid } from './dashboard/DashboardGrid';
import { DashboardWidget } from './dashboard/DashboardWidget';
import { WidgetHeader } from './dashboard/WidgetHeader';
import { WidgetBody } from './dashboard/WidgetBody';
import { WidgetEmpty } from './dashboard/WidgetEmpty';
import { downloadDocument } from '../lib/shareUtils';

// Phase 2 Widgets
import { GlobalSearchWidget } from '../widgets/dashboard/GlobalSearchWidget';
import { QuickActionsWidget } from '../widgets/dashboard/QuickActionsWidget';
// import { ProcessingQueueWidget } from '../widgets/dashboard/ProcessingQueueWidget';
import { RecentDocumentsWidget } from '../widgets/dashboard/RecentDocumentsWidget';
// import { AIInsightsWidget } from '../widgets/dashboard/AIInsightsWidget';
import { VaultAnalyticsWidget } from '../widgets/dashboard/VaultAnalyticsWidget';
import { EntityDashboardWidget } from '../widgets/dashboard/EntityDashboardWidget';
import { TableDashboardWidget } from '../widgets/dashboard/TableDashboardWidget';
import { FolderDistributionWidget } from '../widgets/dashboard/FolderDistributionWidget';
import { MissingEssentialsWidget } from '../widgets/dashboard/MissingEssentialsWidget';
// import { DashboardHealthWidget } from '../widgets/dashboard/DashboardHealthWidget';
import { SmartRemindersWidget } from '../widgets/dashboard/SmartRemindersWidget';
import { DuplicateDetectionWidget } from '../widgets/dashboard/DuplicateDetectionWidget';
import { AICreditsWidget } from '../widgets/dashboard/AICreditsWidget';
import { CalendarRemindersWidget } from '../widgets/dashboard/CalendarRemindersWidget';

export function Dashboard(props: any) {
  console.count("Dashboard Render");
  console.log("[DASHBOARD PROPS]", props);
  const dashboardState = useDashboard();
  const {
    documents,
    goToUpload,
    goToArchive,
    goToEntity,
    searchQuery,
    setSearchQuery,
    searchInputRef,
    filteredDocs,
    recentDocs,
    completionRate,
    missingDocs,
    estDocsLeft,
    aiUnits,
    aiCredits,
    setPricingOpen,
    goToArchiveWithContext,
    handleQuickAction,
    vaultAnalytics,
    entityStats,
    tableStats,
    folderDistribution,
    potentialDuplicates
  } = dashboardState;

  console.log("[DASHBOARD CONTEXT VALUES]", {
    documents: documents.length,
    searchQuery,
    completionRate,
    aiUnits,
    aiCredits,
    recentDocsCount: recentDocs.length,
  });

  const handleDocClick = (docId: string) => {
    const doc = documents.find(d => d._id === docId);
    if (doc) {
      downloadDocument(doc);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <TopNav activeTab="hub" />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-1">Vault Intelligence</h1>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">
              Synchronization status: {completionRate}% active
            </p>
          </div>
          <button 
            onClick={() => {
              console.log('[BUTTON CLICK] "Scan New File" button onClick triggered in Dashboard');
              goToUpload();
            }}
            className="bg-blue-600 text-white px-5 py-3.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-[0.98] shadow-md shadow-blue-500/10"
          >
            <Plus size={18} strokeWidth={2.5} />
            Scan New File
          </button>
        </header>

        <DashboardGrid className="mb-6">
          {/* Global Search Bar */}
          <GlobalSearchWidget 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchInputRef={searchInputRef}
          />

          {/* Render Search Results dynamically if input has text */}
          {searchQuery.trim() !== '' && (
            <div className="col-span-12">
              <DashboardWidget className="p-6">
                <WidgetHeader 
                  title={`Search Results (${filteredDocs.length})`}
                  icon={<Search className="text-blue-500 w-5 h-5" />}
                  actions={
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wider"
                    >
                      Clear Results
                    </button>
                  }
                />
                <WidgetBody>
                  {filteredDocs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredDocs.map(doc => (
                        <div 
                          key={doc._id}
                          className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between hover:border-blue-200 hover:bg-white transition-all group"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="text-sm font-bold text-gray-900 truncate">{doc.name}</h4>
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-tight">
                                 {doc.mimeType?.split('/')[1] || doc.name?.split('.').pop() || 'Document'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100">
                            {doc.previewUrl && (
                              <button
                                onClick={() => downloadDocument(doc)}
                                className="p-1.5 hover:bg-gray-150 rounded-lg text-gray-500 transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <WidgetEmpty 
                      message={`No documents matching "${searchQuery}" found in your vault.`}
                      icon={<FileText className="w-10 h-10 text-gray-300" />}
                    />
                  )}
                </WidgetBody>
              </DashboardWidget>
            </div>
          )}

          {/* Quick Actions Toolbar */}
          <QuickActionsWidget onAction={handleQuickAction} />
        </DashboardGrid>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* Recent Documents Widget */}
          <div className="col-span-12 flex">
            <RecentDocumentsWidget 
              recentDocs={recentDocs}
              onViewAll={goToArchive}
              onDocClick={(docId) => goToArchiveWithContext({ documentId: docId })}
            />
          </div>

          {/* Vault Analytics Widget */}
          <div className="col-span-12 lg:col-span-6 flex">
            <VaultAnalyticsWidget analytics={vaultAnalytics} />
          </div>

          {/* Calendar & Reminders Widget */}
          <div className="col-span-12 lg:col-span-6 flex">
            <CalendarRemindersWidget documents={documents} />
          </div>

          {/* Entity Dashboard */}
          <div className="col-span-12 lg:col-span-6 flex">
            <EntityDashboardWidget 
              entityStats={entityStats}
              onViewAllEntities={goToEntity}
            />
          </div>

          {/* Table Dashboard */}
          <div className="col-span-12 lg:col-span-6 flex">
            <TableDashboardWidget 
              tableStats={tableStats}
              onViewTablesClick={goToArchive}
              onDocClick={handleDocClick}
            />
          </div>

          {/* Folder Distribution */}
          <div className="col-span-12 lg:col-span-6 flex">
            <FolderDistributionWidget distribution={folderDistribution} />
          </div>

          {/* Smart Reminders Widget */}
          <div className="col-span-12 lg:col-span-6 flex">
            <SmartRemindersWidget documents={documents} />
          </div>

          {/* Missing Life Essentials Widget */}
          <div className="col-span-12 flex">
            <MissingEssentialsWidget 
              completionRate={completionRate}
              missingDocs={missingDocs}
              onUploadClick={goToUpload}
              onUploadedClick={(docType) => goToArchiveWithContext({ recommendedDocumentType: docType })}
            />
          </div>

          {/* Duplicate Detection */}
          <div className="col-span-12 lg:col-span-6 flex">
            <DuplicateDetectionWidget 
              duplicates={potentialDuplicates}
              onDocClick={handleDocClick}
            />
          </div>

          {/* AI Credits Widget */}
          <div className="col-span-12 lg:col-span-6 flex">
            <AICreditsWidget 
              aiUnits={aiUnits}
              aiCredits={aiCredits}
              estDocsLeft={estDocsLeft}
              onUpgradeClick={() => setPricingOpen(true)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
