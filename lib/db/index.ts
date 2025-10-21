import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/drizzle/schema';
import { env } from '@/lib/utils/env';

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

const getPool = () => {
  if (!global.__dbPool) {
    global.__dbPool = new Pool({ connectionString: env.SUPABASE_DB_URL });
  }
  return global.__dbPool;
};

export const db = drizzle(getPool(), { schema });
