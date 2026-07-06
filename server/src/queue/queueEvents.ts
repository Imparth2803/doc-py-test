import { QueueEvents } from 'bullmq';
import { SERVICES } from '../config/services';
import { isRedisAvailable } from './redis';

let queueEvents: QueueEvents | null = null;

export const getQueueEvents = (): QueueEvents | null => {
  if (!queueEvents && isRedisAvailable()) {
    queueEvents = new QueueEvents('document-processing', {
      connection: {
        host: SERVICES.redis.host,
        port: SERVICES.redis.port,
        password: SERVICES.redis.password || undefined,
        maxRetriesPerRequest: null,
      },
    });

    queueEvents.on('active', ({ jobId }) => {
      console.log(`[QUEUE] Job Active: ${jobId}`);
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`[QUEUE] Job Completed: ${jobId}`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[QUEUE] Job Failed: ${jobId} | Reason: ${failedReason}`);
    });

    queueEvents.on('stalled', ({ jobId }) => {
      console.warn(`[QUEUE] Job Stalled: ${jobId}`);
    });
  }
  return queueEvents;
};

export const initializeQueueEvents = async (): Promise<boolean> => {
  if (!isRedisAvailable()) return false;
  const events = getQueueEvents();
  return !!events;
};

export { queueEvents };
