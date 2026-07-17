import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = typeof window !== 'undefined'
  ? `http://${window.location.hostname}:8000`
  : 'http://localhost:8000';

export const useSocket = () => {
  const socketRef = useRef<any>(null);

  useEffect(() => {
    // 1. Electron IPC-based socket mock (if running in desktop shell)
    if ((window as any).electronAPI) {
      console.log('[SOCKET] Desktop shell detected. Routing real-time status updates through IPC...');
      const listeners: Record<string, Function[]> = {};

      const mockSocket = {
        id: 'electron-ipc-socket',
        on: (event: string, callback: Function) => {
          if (!listeners[event]) {
            listeners[event] = [];
            (window as any).electronAPI.socketOn(event);
          }
          listeners[event].push(callback);
        },
        off: (event: string, callback: Function) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter(cb => cb !== callback);
            if (listeners[event].length === 0) {
              delete listeners[event];
              (window as any).electronAPI.socketOff(event);
            }
          }
        },
        disconnect: () => {
          (window as any).electronAPI.socketDisconnect();
        }
      };

      const handleSocketEvent = (event: any, data: { event: string; payload: any }) => {
        const eventListeners = listeners[data.event];
        if (eventListeners) {
          eventListeners.forEach(cb => cb(data.payload));
        }
      };

      (window as any).electronAPI.onSocketEvent(handleSocketEvent);
      socketRef.current = mockSocket;

      console.log('[SOCKET] Virtual desktop socket interface registered.');

      return () => {
        console.log('[SOCKET] Tearing down virtual desktop socket listeners...');
        (window as any).electronAPI.removeSocketListener(handleSocketEvent);
        mockSocket.disconnect();
      };
    }

    // 2. Standard socket.io connection (backward compatible web mode)
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SOCKET] Connected to WebSocket server:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected from WebSocket server');
    });

    return () => {
      console.log('[SOCKET] Cleaning up and disconnecting socket...');
      socket.disconnect();
    };
  }, []);

  const subscribeToDocumentStatus = useCallback((
    documentId: string,
    callback: (status: string) => void
  ) => {
    const socket = socketRef.current;
    if (!socket) {
      // Retry subscription slightly later if socket isn't ready
      const timeoutId = setTimeout(() => {
        if (socketRef.current) {
          const eventName = `document:${documentId}:status`;
          socketRef.current.on(eventName, listener);
        }
      }, 500);

      const listener = (data: { documentId: string; status: string }) => {
        console.log(`[SOCKET] Real-time status for ${documentId} -> ${data.status}`);
        callback(data.status);
      };

      return () => {
        clearTimeout(timeoutId);
        if (socketRef.current) {
          socketRef.current.off(`document:${documentId}:status`, listener);
        }
      };
    }

    const eventName = `document:${documentId}:status`;
    const listener = (data: { documentId: string; status: string }) => {
      console.log(`[SOCKET] Real-time status for ${documentId} -> ${data.status}`);
      callback(data.status);
    };

    socket.on(eventName, listener);

    return () => {
      socket.off(eventName, listener);
    };
  }, []);

  return {
    socket: socketRef.current,
    subscribeToDocumentStatus,
  };
};
