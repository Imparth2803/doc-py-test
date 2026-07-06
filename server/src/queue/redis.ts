import Redis from 'ioredis';
import { SERVICES } from '../config/services';

const redisConfig = {
  host: SERVICES.redis.host,
  port: SERVICES.redis.port,
  password: SERVICES.redis.password || undefined,
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    if (times > 3) {
      console.warn('[REDIS] Max retries reached. Stopping reconnection attempts.');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 1000, 2000);
    return delay;
  },
};

let redisConnection: Redis | null = null;
let isConnected = false;

export const getRedisConnection = (): Redis | null => {
  if (!redisConnection) {
    try {
      redisConnection = new Redis(redisConfig);

      redisConnection.on('error', (err) => {
        console.error('[REDIS] Connection Error:', err.message);
        isConnected = false;
      });

      redisConnection.on('ready', () => {
        console.log('[REDIS] Connected successfully');
        isConnected = true;
      });
      
      redisConnection.on('close', () => {
        isConnected = false;
      });
    } catch (err) {
      console.error('[REDIS] Failed to create Redis instance:', err);
      return null;
    }
  }
  return redisConnection;
};

// Explicit initialization for startup
export const initializeRedis = async (): Promise<boolean> => {
  const conn = getRedisConnection();
  if (!conn) return false;

  try {
    // Wait a bit for the connection to be established or fail
    return await Promise.race([
      new Promise<boolean>((resolve) => {
        if (conn.status === 'ready') resolve(true);
        conn.once('ready', () => resolve(true));
        conn.once('error', () => resolve(false));
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(conn.status === 'ready'), 2000))
    ]);
  } catch (err) {
    return false;
  }
};

export const isRedisAvailable = (): boolean => {
  return isConnected && redisConnection !== null && redisConnection.status === 'ready';
};

// Helper for health checks without crashing
export const checkRedisHealth = async (): Promise<boolean> => {
  if (!redisConnection) return false;
  try {
    return (await redisConnection.ping()) === 'PONG';
  } catch (err) {
    return false;
  }
};

export { redisConnection };
