import { Worker, Job } from 'bullmq';
import { SERVICES } from '../config/services';
import { processDocumentWithAI } from '../services/documentProcessingService';
import ProcessingJob from '../models/ProcessingJob';
import Document from '../models/Document';
import { isRedisAvailable } from '../queue/redis';

let documentWorker: Worker | null = null;

export const getDocumentWorker = (): Worker | null => {
  if (!documentWorker && isRedisAvailable()) {
    documentWorker = new Worker(
      'document-processing',
      async (job: Job) => {
        const { documentId, processingJobId, language } = job.data;
        console.log(`[WORKER] Starting job ${job.id} for document ${documentId} with language ${language || 'en'} (Attempt ${job.attemptsMade + 1})`);

        const processingJob = await ProcessingJob.findById(processingJobId);
        if (processingJob) {
          processingJob.status = 'PROCESSING';
          processingJob.attempts = job.attemptsMade + 1;
          processingJob.startedAt = processingJob.startedAt || new Date();
          await processingJob.save();
        }

        try {
          const result = await processDocumentWithAI(documentId, language);
          return result;
        } catch (error: any) {
          console.error(`[WORKER] Error processing document ${documentId}:`, error.message);
          throw error; // Let BullMQ catch and trigger retry logic
        }
      },
      {
        connection: {
          host: SERVICES.redis.host,
          port: SERVICES.redis.port,
          password: SERVICES.redis.password || undefined,
          maxRetriesPerRequest: null,
        },
        concurrency: 1, // MUST remain 1 to prevent OOM / CPU starvation on M2
      }
    );

    console.log('[WORKER] Document processing worker registered successfully and listening on queue: document-processing');

    documentWorker.on('error', (err) => {
      console.error('[WORKER_ERROR]', err);
    });
  }
  return documentWorker;
};

export const initializeWorker = async (): Promise<boolean> => {
  if (!isRedisAvailable()) return false;
  const worker = getDocumentWorker();
  return !!worker;
};

export { documentWorker };
