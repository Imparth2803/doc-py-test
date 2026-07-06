import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:8000';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Establish connection to WebSocket server
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
