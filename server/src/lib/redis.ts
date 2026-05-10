import { Redis } from 'ioredis';

/** In-process fallback when Redis is unavailable (single-instance only). */
class MemoryRedis {
  private data = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const e = this.data.get(key);
    if (!e) return null;
    if (e.expiresAt !== undefined && Date.now() > e.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return e.value;
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    this.data.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }

  del(
    ...args: [...string[], (err: Error | null, result?: number) => void] | string[]
  ): Promise<number> | void {
    const last = args[args.length - 1];
    const hasCb = typeof last === 'function';
    const cb = hasCb ? (last as (err: Error | null, result?: number) => void) : undefined;
    const keyList = (hasCb ? args.slice(0, -1) : args) as string[];

    let n = 0;
    for (const k of keyList) {
      if (this.data.delete(k)) n++;
    }

    if (cb) {
      cb(null, n);
      return;
    }
    return Promise.resolve(n);
  }

  async incr(key: string): Promise<number> {
    const cur = await this.get(key);
    const next = (cur ? parseInt(cur, 10) : 0) + 1;
    const prev = this.data.get(key);
    this.data.set(key, {
      value: String(next),
      expiresAt: prev?.expiresAt,
    });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const e = this.data.get(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  quit(): Promise<'OK'> {
    return Promise.resolve('OK');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(_event: string, _handler?: (...args: any[]) => void): this {
    return this;
  }
}

const useMemory =
  process.env.DISABLE_REDIS === 'true' ||
  process.env.DISABLE_REDIS === '1' ||
  process.env.USE_MEMORY_REDIS === 'true';

let redisClient: Redis;

if (useMemory) {
  console.log('Using in-memory Redis substitute (DISABLE_REDIS / USE_MEMORY_REDIS). Not suitable for multi-instance.');
  redisClient = new MemoryRedis() as unknown as Redis;
} else if (process.env.REDIS_URL) {
  console.log(`Connecting to Redis via URL`);

  const connectionOptions: {
    maxRetriesPerRequest: number;
    enableReadyCheck: boolean;
    enableOfflineQueue: boolean;
    connectTimeout: number;
    retryStrategy: (times: number) => number | null;
    lazyConnect: boolean;
    password?: string;
  } = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: false,
    connectTimeout: 10000,
    lazyConnect: true,
    retryStrategy(times: number) {
      if (times > 3) {
        console.error('Redis max retries reached, giving up');
        return null;
      }
      return Math.min(times * 50, 2000);
    },
  };

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
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: false,
    connectTimeout: 10000,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) {
        console.error('Redis max retries reached, giving up');
        return null;
      }
      return Math.min(times * 50, 2000);
    },
  });
}

if (!useMemory) {
  redisClient.on('connect', () => {
    console.log('✅ Redis client connected');
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis client connection error:', err);
  });
}

process.on('SIGTERM', () => {
  if (!useMemory) {
    console.log('SIGTERM received, closing Redis connection...');
    redisClient.quit();
  }
});

process.on('SIGINT', () => {
  if (!useMemory) {
    console.log('SIGINT received, closing Redis connection...');
    redisClient.quit();
  }
});

export default redisClient;
