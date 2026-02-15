import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { PG_POOL } from '../database/database.provider';
import { REDIS_CLIENT } from '../redis/redis.provider';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pg: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    let database = 'down';
    let redis = 'down';

    try {
      await this.pg.query('SELECT 1');
      database = 'up';
    } catch {
      database = 'down';
    }

    try {
      const pong = await this.redis.ping();
      redis = pong === 'PONG' ? 'up' : 'down';
    } catch {
      redis = 'down';
    }

    const healthy = database === 'up' && redis === 'up';

    const payload = {
      status: healthy ? 'ok' : 'degraded',
      services: {
        database,
        redis,
      },
      timestamp: new Date().toISOString(),
    };

    if (!healthy) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
