import React from 'react';

import { useApp } from './context/AppContext';

import { Login } from './components/Login';
import { Upload } from './components/Upload';
import { Review } from './components/Review';

import { Archive } from './components/Archive';

import { TreeView } from './components/TreeView';
import { EntityView } from './components/EntityView';
import { TimelineView } from './components/TimelineView';
import { Dashboard } from './components/Dashboard';
import { PricingModal } from './components/PricingModal';
import { TableView } from './components/TableView';

function AppContent() {
  const {
    currentView,
    isPricingOpen,
    setPricingOpen,
    tablesDocumentId,
  } = useApp();

  console.log('[REACT RENDER] AppContent rendered. currentView:', currentView, 'isPricingOpen:', isPricingOpen);

  React.useEffect(() => {
    console.log('[APPCONTENT EFFECT] currentView is now:', currentView);
  }, [currentView]);

  return (
    <div 
      onClickCapture={(e) => {
        console.log('[REACT SYNTHETIC CLICK CAPTURE] Target:', e.target);
      }}
      onClick={(e) => {
        console.log('[REACT SYNTHETIC CLICK BUBBLE] Target:', e.target);
      }}
      style={{ minHeight: '100vh' }}
    >
      {(() => {
        switch (currentView) {
          case 'login':
            return <Login />;

          case 'dashboard':
            return <Dashboard />;

          case 'upload':
            return <Upload />;

          case 'review':
            return <Review />;

          case 'archive':
            return <Archive />;

          case 'tree':
            return <TreeView />;

          case 'entity':
            return <EntityView />;

          case 'timeline':
            return <TimelineView />;

          case 'tables':
            return <TableView documentId={tablesDocumentId} />;

          default:
            return <Login />;
        }
      })()}

      {isPricingOpen && (
        <PricingModal
          isOpen={isPricingOpen}
          onClose={() =>
            setPricingOpen(false)
          }
        />
      )}
    </div>
  );
}

export default function App() {
  return <AppContent />;
}