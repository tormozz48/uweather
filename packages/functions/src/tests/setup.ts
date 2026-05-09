/**
 * Global vitest setup — loads .env.test before any test file runs.
 *
 * Create packages/functions/.env.test with your API keys:
 *   OPENWEATHER_API_KEY=...
 *   WEATHERAPI_KEY=...
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Walk up two levels: src/__tests__ → src → packages/functions
config({ path: resolve(__dirname, '../../.env.test') });
