import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import connectDB from './config/db';
import authRoutes from "./routes/authRoutes";
import documentRoutes from './routes/documentRoutes';
import path from "path";
import { REGISTERED_SERVICES } from './config/serviceRegistry';
import { validateOCRServiceHealth } from './services/ocrService';
import { validateGLiNERServiceHealth } from './services/entities/glinerService';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(
  "/uploads",
  express.static(
    path.join(process.cwd(), "uploads")
  )
);
console.log(
  "Serving uploads from:",
  path.join(process.cwd(), "uploads")
);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    console.log('====================================');
    console.log('Service Configuration');
    console.log('====================================');
    console.log(`Backend:\n${REGISTERED_SERVICES.backend}\n`);
    console.log(`OCR:\n${REGISTERED_SERVICES.ocr}\n`);
    console.log(`GLiNER:\n${REGISTERED_SERVICES.gliner}\n`);
    console.log(`Ollama:\n${REGISTERED_SERVICES.ollama}\n`);
    console.log(`AI Provider:\n${process.env.AI_PROVIDER || 'gemini'}`);
    console.log('====================================\n');
    
    console.log('STARTING SERVER...');

    await connectDB();

    console.log('DATABASE CONNECTED');

    // Start recovery monitor
    const { startRecoveryMonitor } = require('./services/recoveryService');
    startRecoveryMonitor();

    // Validate OCR Service
    const { validateOCRServiceHealth } = require('./services/ocrService');
    validateOCRServiceHealth();

    // Validate GLiNER Service
    validateGLiNERServiceHealth();

    app.listen(PORT, () => {
      console.log(`SERVER RUNNING ON PORT ${PORT}`);
    });

  } catch (error) {
    console.error('SERVER START ERROR:', error);
  }
};

startServer();