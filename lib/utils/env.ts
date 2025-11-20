import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE: z.string().min(1).optional(),
  SUPABASE_SERVICE_KEY: z.string().min(1).optional(),
  SUPABASE_DB_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1).optional()
});

type PublicEnv = z.infer<typeof publicEnvSchema>;
type ServerEnv = z.infer<typeof serverEnvSchema>;

const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
});

let cachedServerEnv: ServerEnv | null = null;

const loadServerEnv = (): ServerEnv => {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const result = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  });

  if (!result.success) {
    const { fieldErrors } = result.error.flatten();
    const messages = Object.entries(fieldErrors)
      .flatMap(([field, errors]) =>
        (errors ?? []).map((message) => `${field}: ${message}`)
      )
      .join(', ');

    throw new Error(
      messages
        ? `Invalid server environment variables - ${messages}`
        : 'Invalid server environment variables'
    );
  }

  cachedServerEnv = result.data;
  return cachedServerEnv;
};

type Env = PublicEnv & {
  readonly SUPABASE_SERVICE_ROLE_KEY:
    | ServerEnv['SUPABASE_SERVICE_ROLE_KEY']
    | ServerEnv['SUPABASE_SERVICE_ROLE']
    | ServerEnv['SUPABASE_SERVICE_KEY'];
  readonly SUPABASE_DB_URL: ServerEnv['SUPABASE_DB_URL'];
  readonly OPENAI_API_KEY: ServerEnv['OPENAI_API_KEY'] | null;
};

export const env: Env = {
  ...publicEnv,
  get SUPABASE_SERVICE_ROLE_KEY() {
    const {
      SUPABASE_SERVICE_ROLE_KEY: primary,
      SUPABASE_SERVICE_ROLE: legacy,
      SUPABASE_SERVICE_KEY: fallback
    } = loadServerEnv();

    return primary ?? legacy ?? fallback;
  },
  get SUPABASE_DB_URL() {
    return loadServerEnv().SUPABASE_DB_URL;
  },
  get OPENAI_API_KEY() {
    return loadServerEnv().OPENAI_API_KEY ?? null;
  }
};
