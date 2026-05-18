import React from 'react';

import { useApp } from './context/AppContext';

import { Login } from './components/Login';
import { Upload } from './components/Upload';
import { Review } from './components/Review';

import { Archive } from './components/Archive';

import { TreeView } from './components/TreeView';
import { EntityView } from './components/EntityView';
import { Dashboard } from './components/Dashboard';
import { PricingModal } from './components/PricingModal';

function AppContent() {
  const {
    currentView,
    isPricingOpen,
    setPricingOpen,
  } = useApp();

  return (
    <>
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

          default:
            return <Login />;
        }
      })()}

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() =>
          setPricingOpen(false)
        }
      />
    </>
  );
}

export default function App() {
  return <AppContent />;
}