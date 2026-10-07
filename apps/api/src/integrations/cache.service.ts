import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config';

/** Redis üzerinde basit JSON önbellek. Redis yoksa sessizce önbelleksiz çalışır. */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger('Cache');
  readonly redis: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.redis.on('error', (e) => this.logger.warn(`Redis: ${e.message}`));
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const v = await this.redis.get(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* önbellek isteğe bağlıdır */
    }
  }

  async del(pattern: string) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length) await this.redis.del(...keys);
    } catch {
      /* yok say */
    }
  }

  async ping() {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }
}
