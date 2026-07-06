import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export const initializeSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[SOCKET] Socket.io server initialized successfully');
  return io;
};

export const getIO = (): SocketIOServer | null => {
  return io;
};

export const emitDocumentStatus = (documentId: string, status: string) => {
  if (!io) {
    console.warn('[SOCKET] IO server not initialized. Cannot emit status update.');
    return;
  }
  const eventName = `document:${documentId}:status`;
  console.log(`[SOCKET] Emitting event: ${eventName} with status: ${status}`);
  io.emit(eventName, { documentId, status });
};
