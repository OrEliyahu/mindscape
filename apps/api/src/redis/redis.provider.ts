import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const REDIS_PROVIDER = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis =>
    new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: 3,
    }),
};
