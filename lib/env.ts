/**
 * Environment variable validation for Nestora.
 * Call this early on server startup (e.g. in layouts or client create) to fail fast.
 */

const requiredServerEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', // required for generating magic links without using Supabase's native email sender
  'RESEND_API_KEY', // required for sending all emails (magic links + notifications) via Resend from Server Actions
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const key of requiredServerEnv) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Check your .env.local (or deployment env) and restart the server.'
    );
  }
}


