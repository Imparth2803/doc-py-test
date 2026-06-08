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
