import type { Config } from 'drizzle-kit';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });

export default {
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL || ''
  }
} satisfies Config;
