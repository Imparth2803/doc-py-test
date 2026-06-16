import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import connectDB from './config/db';
import authRoutes from "./routes/authRoutes";
import documentRoutes from './routes/documentRoutes';
import path from "path";

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
    console.log('STARTING SERVER...');

    await connectDB();

    console.log('DATABASE CONNECTED');

    // Start recovery monitor
    const { startRecoveryMonitor } = require('./services/recoveryService');
    startRecoveryMonitor();

    // Validate OCR Service
    const { validateOCRServiceHealth } = require('./services/ocrService');
    validateOCRServiceHealth();

    app.listen(PORT, () => {
      console.log(`SERVER RUNNING ON PORT ${PORT}`);
    });

  } catch (error) {
    console.error('SERVER START ERROR:', error);
  }
};

startServer();