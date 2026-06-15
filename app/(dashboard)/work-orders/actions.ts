'use server';

import { validateEnv } from '@/lib/env';

// Validate required env vars on server startup (this runs in Node, not the browser)
validateEnv();


