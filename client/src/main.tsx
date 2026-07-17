import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AppProvider } from './context/AppContext';

import axios from 'axios';

// Configure Electron IPC Interception Bridge
if (typeof window !== 'undefined' && (window as any).electronAPI) {
  console.log('[Electron Bridge] Overriding default Axios and Fetch adapters to communicate via IPC...');

  // 1. Axios Adapter Override
  axios.defaults.adapter = async (config) => {
    try {
      const url = config.url || '';
      let bodyData = config.data;
      let filePath: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;
      let isMultipart = false;

      // Extract details if FormData is used
      if (config.data instanceof FormData) {
        isMultipart = true;
        const file = config.data.get('file') as any;
        if (file) {
          filePath = file.path || null;
          fileName = file.name || null;
          mimeType = file.type || null;
        }
        bodyData = null; // Purge FormData instance for IPC transfer
      } else if (typeof config.data === 'string') {
        try {
          bodyData = JSON.parse(config.data);
        } catch {
          bodyData = config.data;
        }
      }

      const ipcResponse = await (window as any).electronAPI.apiCall(url, {
        method: (config.method || 'GET').toUpperCase(),
        headers: config.headers,
        body: bodyData,
        isMultipart,
        filePath,
        fileName,
        mimeType
      });

      if (!ipcResponse.ok) {
        throw {
          message: ipcResponse.error || 'IPC API Call failed',
          response: {
            data: ipcResponse.data,
            status: ipcResponse.status,
            statusText: ipcResponse.statusText,
            headers: ipcResponse.headers,
            config
          }
        };
      }

      return {
        data: ipcResponse.data,
        status: ipcResponse.status,
        statusText: ipcResponse.statusText,
        headers: ipcResponse.headers,
        config
      };
    } catch (err) {
      return Promise.reject(err);
    }
  };

  // 2. Fetch Override
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);

    // Only intercept requests destined for API endpoints (or relative paths)
    if (url.includes('/api/')) {
      let bodyData: any = init?.body;
      let filePath: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;
      let isMultipart = false;

      if (init?.body instanceof FormData) {
        isMultipart = true;
        const file = init.body.get('file') as any;
        if (file) {
          filePath = file.path || null;
          fileName = file.name || null;
          mimeType = file.type || null;
        }
        bodyData = null; // Purge FormData instance for IPC transfer
      } else if (typeof init?.body === 'string') {
        try {
          bodyData = JSON.parse(init.body);
        } catch {
          bodyData = init.body;
        }
      }

      const ipcResponse = await (window as any).electronAPI.apiCall(url, {
        method: init?.method || 'GET',
        headers: init?.headers,
        body: bodyData,
        isMultipart,
        filePath,
        fileName,
        mimeType
      });

      return {
        ok: ipcResponse.ok,
        status: ipcResponse.status,
        json: async () => ipcResponse.data,
        text: async () => typeof ipcResponse.data === 'string' ? ipcResponse.data : JSON.stringify(ipcResponse.data),
        headers: new Headers(ipcResponse.headers || {}),
      } as Response;
    }

    return originalFetch(input, init);
  };
} else if (typeof window !== 'undefined') {
  console.log('[LAN Bridge] Non-Electron environment. Intercepting Axios and Fetch to route requests dynamically to host...');

  // 1. Fetch Request Interceptor
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    if (url.includes('localhost:8000')) {
      url = url.replace('localhost:8000', `${window.location.hostname}:8000`);
    }
    return originalFetch(url, init);
  };

  // 2. Axios Request Interceptor
  axios.interceptors.request.use((config) => {
    if (config.url && config.url.includes('localhost:8000')) {
      config.url = config.url.replace('localhost:8000', `${window.location.hostname}:8000`);
    }
    return config;
  });
}

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
