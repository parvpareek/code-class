import { Redis } from 'ioredis';

let redisClient: Redis;

if (process.env.REDIS_URL) {
  console.log(`Connecting to Redis via URL`);
  
  // Optimized connection options to prevent memory leaks
  const connectionOptions: {
    maxRetriesPerRequest: number;
    enableReadyCheck: boolean;
    enableOfflineQueue: boolean;
    connectTimeout: number;
    retryStrategy: (times: number) => number | null;
    lazyConnect: boolean;
    password?: string;
  } = {
    maxRetriesPerRequest: 3, // Reduced from 20 to prevent retry buildup
    enableReadyCheck: true,
    enableOfflineQueue: false, // Don't queue commands when disconnected (prevents memory buildup)
    connectTimeout: 10000, // 10 second timeout
    lazyConnect: true, // Don't connect immediately
    retryStrategy(times: number) {
      if (times > 3) {
        console.error('Redis max retries reached, giving up');
        return null; // Stop retrying after 3 attempts
      }
      const delay = Math.min(times * 50, 2000); // 2s max backoff
      return delay;
    },
  };

  // Add password if provided separately
  if (process.env.REDIS_PASSWORD) {
    connectionOptions.password = process.env.REDIS_PASSWORD;
  }

  redisClient = new Redis(process.env.REDIS_URL, connectionOptions);
} else {
  const redisHost = process.env.REDIS_HOST || '127.0.0.1';
  const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
  const redisPassword = process.env.REDIS_PASSWORD || undefined;

  console.log(`Connecting to Redis at ${redisHost}:${redisPort}`);

  redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: 3, // Reduced from 20
    enableReadyCheck: true,
    enableOfflineQueue: false, // Don't queue commands when disconnected
    connectTimeout: 10000,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) {
        console.error('Redis max retries reached, giving up');
        return null;
      }
      const delay = Math.min(times * 50, 2000); // 2s max backoff
      return delay;
    },
  });
}

redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis client connection error:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing Redis connection...');
  redisClient.quit();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing Redis connection...');
  redisClient.quit();
});

export default redisClient; 