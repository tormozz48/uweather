/**
 * infra/web.ts — Phase 4: Vite + React SPA hosted on S3 + CloudFront
 *
 * SST StaticSite deploys the Vite build to S3 and fronts it with CloudFront.
 * The API URL is injected as VITE_API_URL so the React app can call the backend
 * without hardcoding endpoint URLs.
 *
 * SPA routing: errorPage points to index.html so that client-side routes
 * (e.g. /history) return 200 instead of 403/404 from CloudFront.
 */
import { api } from './api.ts';
import { wsUrl } from './realtime.ts';

export const web = new sst.aws.StaticSite('Web', {
  path: 'packages/web',

  build: {
    command: 'pnpm build',
    output: 'dist',
  },

  // Inject API + WebSocket URLs at build time
  environment: {
    VITE_API_URL: api.url,
    VITE_WS_URL: wsUrl,
  },

  // SPA routing: serve index.html on all 403/404 responses (client-side router handles the path)
  errorPage: 'index.html',
});
