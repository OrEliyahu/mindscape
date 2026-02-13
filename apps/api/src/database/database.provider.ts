import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

export const DATABASE_PROVIDER = {
  provide: PG_POOL,
  useFactory: (): Pool =>
    new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? 'mindscape',
      user: process.env.DB_USER ?? 'mindscape_user',
      password: process.env.DB_PASSWORD ?? 'mindscape_local_dev',
      max: 20,
    }),
};
