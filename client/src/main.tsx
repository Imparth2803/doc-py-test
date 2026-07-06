import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AppProvider } from './context/AppContext';

console.log(
  'GOOGLE CLIENT:',
  import.meta.env.VITE_GOOGLE_CLIENT_ID
);
if (typeof window !== 'undefined') {
  document.addEventListener(
    "click",
    (e) => {
      console.log("[NATIVE CLICK] Target:", e.target);
      console.log("[NATIVE CLICK] Composed Path:", e.composedPath());
    },
    { capture: true }
  );
}

createRoot(
  document.getElementById('root')!
).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AppProvider>
        <App />
      </AppProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
