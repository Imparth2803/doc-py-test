import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { initializeSocket } from './services/socket';

import connectDB from './config/db';
import authRoutes from "./routes/authRoutes";
import documentRoutes from './routes/documentRoutes';
import path from "path";
import { REGISTERED_SERVICES } from './config/serviceRegistry';
import { validateOCRServiceHealth } from './services/ocrService';
import { validateTableServiceHealth } from './services/tableExtractionService';
import { validateGLiNERServiceHealth } from './services/entities/glinerService';
import { initializeRedis, checkRedisHealth, isRedisAvailable } from './queue/redis';
import { initializeQueue, isQueueEnabled } from './queue/documentQueue';
import { initializeQueueEvents } from './queue/queueEvents';
import { initializeWorker } from './workers/documentWorker';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(
  "/uploads",
  (req, res, next) => {
    const fs = require('fs');
    const path = require('path');
    
    const uploadsDir = path.join(__dirname, "../uploads");
    const resolvedPath = path.join(uploadsDir, decodeURIComponent(req.path));
    const fileExists = fs.existsSync(resolvedPath);
    const stats = fileExists ? fs.statSync(resolvedPath) : null;

    console.log('\n[STATIC REQUEST]');
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Resolved Filename:', path.basename(resolvedPath));
    console.log('Absolute Path:', resolvedPath);
    console.log('Range Header:', req.headers.range || 'N/A');
    console.log('If-Range:', req.headers['if-range'] || 'N/A');
    console.log('If-None-Match:', req.headers['if-none-match'] || 'N/A');
    console.log('User-Agent:', req.headers['user-agent'] || 'N/A');

    console.log('\n[STATIC FILE]');
    console.log('Exists:', fileExists);
    console.log('Absolute Path:', resolvedPath);
    console.log('Size:', stats ? `${stats.size} bytes` : 'N/A');
    console.log('Last Modified:', stats ? stats.mtime : 'N/A');
    console.log('ETag (if available):', res.getHeader('ETag') || 'N/A');
    console.log('----------------------------------------\n');

    res.on('finish', () => {
      console.log('\n[STATIC RESPONSE]');
      console.log('Status:', res.statusCode);
      console.log('Content-Length:', res.getHeader('Content-Length') || 'N/A');
      console.log('Accept-Ranges:', res.getHeader('Accept-Ranges') || 'N/A');
      console.log('ETag:', res.getHeader('ETag') || 'N/A');
      console.log('File Size:', stats ? stats.size : 'N/A');
      
      if (res.statusCode === 404) {
        console.warn(`WARNING: Static resource not found (404) for ${req.originalUrl}`);
      } else if (res.statusCode === 416) {
        console.warn(`WARNING: Range request not satisfiable (416) for ${req.originalUrl}. Requested Range: ${req.headers.range}. File size on disk: ${stats ? stats.size : 'unknown'}`);
      }
      console.log('----------------------------------------\n');
    });

    next();
  },
  express.static(
    path.join(__dirname, "../uploads")
  )
);
console.log(
  "Serving uploads with diagnostic logging from:",
  path.join(__dirname, "../uploads")
);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    // 1. Initialize Redis
    console.log('[STARTUP] Initializing Redis...');
    const redisStarted = await initializeRedis();
    if (!redisStarted) {
      console.error('[FATAL] Redis is required for Queue-Based Processing architecture. Application startup aborted.');
      process.exit(1);
    }
    
    // 2. Initialize Queues and Workers
    console.log('[STARTUP] Redis connected. Initializing BullMQ...');
    await initializeQueue();
    await initializeQueueEvents();
    await initializeWorker();
    const queueEnabled = isQueueEnabled();
    if (!queueEnabled) {
      console.error('[FATAL] Failed to enable BullMQ. Application startup aborted.');
      process.exit(1);
    }

    const isRedisHealthy = await checkRedisHealth();

    console.log('====================================');
    console.log('Service Configuration');
    console.log('====================================');
    console.log(`Backend:\n${REGISTERED_SERVICES.backend}\n`);
    console.log(`OCR:\n${REGISTERED_SERVICES.ocr}\n`);
    console.log(`Table Extraction:\n${REGISTERED_SERVICES.table_extraction}\n`);
    console.log(`GLiNER:\n${REGISTERED_SERVICES.gliner}\n`);
    console.log(`Ollama:\n${REGISTERED_SERVICES.ollama}\n`);
    console.log(`Redis:\n${isRedisHealthy ? 'Connected' : 'Disconnected (WARNING)'}\n`);
    console.log(`BullMQ:\n${queueEnabled ? 'Enabled' : 'Disabled'}\n`);
    console.log(`AI Provider:\n${process.env.AI_PROVIDER || 'gemini'}`);
    console.log('====================================\n');

    if (!queueEnabled) {
      console.warn('WARNING: Redis unavailable. Queue processing disabled. Worker will not process jobs.');
    }
    
    console.log('STARTING SERVER...');

    await connectDB();

    console.log('DATABASE CONNECTED');

    // Start recovery monitor
    const { startRecoveryMonitor } = require('./services/recoveryService');
    startRecoveryMonitor();

    // Validate OCR Service
    const { validateOCRServiceHealth } = require('./services/ocrService');
    validateOCRServiceHealth();

    // Validate Table Service
    validateTableServiceHealth();

    // Validate GLiNER Service
    validateGLiNERServiceHealth();

    initializeSocket(server);

    server.listen(PORT, () => {
      console.log(`SERVER RUNNING ON PORT ${PORT}`);
    });

  } catch (error) {
    console.error('SERVER START ERROR:', error);
    // Even if something fails in initialization, we might want to try starting the server anyway
    // unless it's a critical error like DB connection.
  }
};

startServer();