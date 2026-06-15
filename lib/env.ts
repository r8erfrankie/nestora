/**
 * Environment variable validation for Nestora.
 * Call this early on server startup (e.g. in layouts or client create) to fail fast.
 */

const requiredServerEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

const optionalServerEnv = [
  'RESEND_API_KEY', // ONLY used for work order notifications via double-dynamic import in email-actions (server-only). Never for auth/login. Missing = notifications skipped gracefully.
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

  // Warn for optional but recommended
  for (const key of optionalServerEnv) {
    if (!process.env[key]) {
      console.warn(`[env] ${key} not set — some features (e.g. email notifications) will be disabled.`);
    }
  }
}


