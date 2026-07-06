import { Queue } from 'bullmq';
import { SERVICES } from '../config/services';
import { isRedisAvailable } from './redis';

export interface DocumentJobPayload {
  documentId: string;
  processingJobId: string;
  language?: string;
}

let documentQueue: Queue<DocumentJobPayload> | null = null;

export const getDocumentQueue = (): Queue<DocumentJobPayload> | null => {
  if (!documentQueue && isRedisAvailable()) {
    documentQueue = new Queue<DocumentJobPayload>('document-processing', {
      connection: {
        host: SERVICES.redis.host,
        port: SERVICES.redis.port,
        password: SERVICES.redis.password || undefined,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10s, 20s, 40s
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }
  return documentQueue;
};

export const initializeQueue = async (): Promise<boolean> => {
  if (!isRedisAvailable()) {
    console.log('[QUEUE] Redis unavailable - Queue Disabled');
    return false;
  }
  const queue = getDocumentQueue();
  return !!queue;
};

export const isQueueEnabled = (): boolean => {
  return documentQueue !== null && isRedisAvailable();
};

export const addDocumentJob = async (documentId: string, processingJobId: string | undefined, language?: string) => {
  const queue = getDocumentQueue();
  if (!queue) {
    throw new Error('Queue is not initialized or Redis is unavailable');
  }
  return await queue.add('process-document', { 
    documentId, 
    processingJobId: processingJobId || '',
    language: language || 'en'
  });
};

export { documentQueue };
