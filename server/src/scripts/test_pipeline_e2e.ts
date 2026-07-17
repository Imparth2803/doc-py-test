import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import connectDB from '../config/db';
import Document from '../models/Document';
import { processDocumentWithAI } from '../services/documentProcessingService';
import { getPlainMetadata } from '../utils/metadataUtils';
import { LocalProvider } from '../services/ai/localProvider';

async function runScenario(
  scenarioId: string,
  scenarioName: string,
  setupFunc: (doc: any) => Promise<void> | void,
  cleanupFunc: () => Promise<void> | void
) {
  console.log(`\n============================================================`);
  console.log(`[SCENARIO ${scenarioId}] ${scenarioName}`);
  console.log(`============================================================`);

  const doc = await Document.findOne().sort({ createdAt: -1 });
  if (!doc) {
    console.error('No documents found in MongoDB.');
    return;
  }

  const documentId = doc._id.toString();
  console.log(`Initial Document State: [ID: ${documentId}] [Original Name: ${doc.originalName}] [Status: ${doc.status}]`);

  // Default Reset
  doc.status = 'PROCESSING';
  doc.processingCheckpoint = {
    ocrCompleted: false,
    enrichmentCompleted: false,
    tablesCompleted: false,
    aiCompleted: false
  };
  
  // Custom setup for scenario
  await setupFunc(doc);
  await doc.save();

  try {
    const start = Date.now();
    await processDocumentWithAI(documentId, 'en');
    console.log(`\nProcessing time: ${Date.now() - start} ms`);
  } catch (err: any) {
    console.error(`\nPipeline threw error:`, err.message);
  } finally {
    await cleanupFunc();
  }

  // Reload document to verify fields
  const updatedDoc = await Document.findById(documentId);
  if (!updatedDoc) {
    console.error('Document could not be re-loaded.');
    return;
  }

  console.log('\n--- VERIFICATION RESULTS ---');
  console.log('Document Status:', updatedDoc.status);
  console.log('Suggested Filename:', updatedDoc.documentName);
  console.log('Doc Type (Category):', updatedDoc.docType);
  console.log('Tags:', updatedDoc.tags);
  
  const plainMetadata = getPlainMetadata(updatedDoc.metadata);
  console.log('aiStatus:', plainMetadata.aiStatus);
  console.log('aiError:', plainMetadata.aiError);
  console.log('aiSummary:', plainMetadata.aiSummary);
  
  const diagnostics = plainMetadata.processingDiagnostics?.aiDiagnostics;
  console.log('AI Diagnostics:', JSON.stringify(diagnostics, null, 2));
}

async function main() {
  await connectDB();

  const originalAnalyzeText = LocalProvider.prototype.analyzeText;

  // SCENARIO 1: Ollama Running (Succeeds)
  await runScenario(
    '1',
    'Ollama Running & Succeeds -> status COMPLETED',
    async (doc) => {
      // Mock local provider to succeed
      LocalProvider.prototype.analyzeText = async (text, fileName, options) => {
        console.log('[MOCK] Local Ollama provider analysis executed successfully.');
        return {
          summary: 'Ollama successfully extracted savings ledger summaries from the bank document.',
          category: 'Bank Statement',
          tags: ['statement', 'bank', 'tjsb'],
          entities: ['TJSB Bank'],
          suggestedFilename: 'Ollama_EStatement_Savings',
          summaryFields: { 'Account Type': 'Savings' },
          metadata: {
            processingDiagnostics: {
              localAnalysis: {
                model: 'qwen2.5:1.5b',
                success: true,
                latencyMs: 450
              }
            }
          }
        };
      };
    },
    () => {
      LocalProvider.prototype.analyzeText = originalAnalyzeText;
    }
  );

  // SCENARIO 2: Ollama Offline (Fails health check)
  await runScenario(
    '2',
    'Ollama Offline -> status PARTIAL_SUCCESS, no Gemini fallback',
    async (doc) => {
      // Let it run natively without stubs, Ollama is offline.
    },
    () => {}
  );

  // SCENARIO 3: Empty OCR (Skips AI analysis)
  await runScenario(
    '3',
    'Empty OCR Text -> AI Analysis skipped entirely',
    async (doc) => {
      doc.extractedText = '';
      doc.processingCheckpoint.ocrCompleted = true; // Avoid re-running OCR
    },
    () => {}
  );

  // SCENARIO 4: Malformed Ollama Response (Validation Fails)
  await runScenario(
    '4',
    'Malformed Ollama Response -> Validation fails -> status PARTIAL_SUCCESS',
    async (doc) => {
      LocalProvider.prototype.analyzeText = async (text, fileName, options) => {
        console.log('[MOCK] Local Ollama returned a malformed response (missing suggestedFilename/summary).');
        return {
          summary: '', // Missing
          category: 'Other',
          tags: [],
          entities: [],
          suggestedFilename: '', // Missing
          summaryFields: {}
        };
      };
    },
    () => {
      LocalProvider.prototype.analyzeText = originalAnalyzeText;
    }
  );

  process.exit(0);
}

main().catch(err => {
  console.error('E2E runner crashed:', err);
  process.exit(1);
});
