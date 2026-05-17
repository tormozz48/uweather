/**
 * infra/web.ts — Phase 4: Vite + React SPA hosted on S3 + CloudFront
 *
 * SST StaticSite deploys the Vite build to S3 and fronts it with CloudFront.
 * The API URL is injected as VITE_API_URL so the React app can call the backend
 * without hardcoding endpoint URLs.
 *
 * SPA routing: errorPage points to index.html so that client-side routes
 * (e.g. /history) return 200 instead of 403/404 from CloudFront.
 *
 * OG meta tags: A CloudFront Function detects social-media bot user agents on
 * /forecast/{forecastId} paths and 302-redirects them to the API's OG endpoint,
 * which returns a minimal HTML page with og:image, og:title, og:description.
 * Human browsers receive the SPA as usual.
 */
import { api } from './api.ts';
import { wsUrl } from './realtime.ts';

// ── Security response headers ────────────────────────────────────────────────
//
// CloudFront Response Headers Policy adds standard security headers to every
// response from the SPA distribution. These prevent clickjacking, MIME-sniffing,
// and enforce a basic content-security policy.

const securityHeadersPolicy = new aws.cloudfront.ResponseHeadersPolicy('WebSecurityHeaders', {
  name: $interpolate`uweather-${$app.stage}-security-headers`,
  securityHeadersConfig: {
    contentTypeOptions: { override: true },
    frameOptions: { frameOption: 'DENY', override: true },
    referrerPolicy: { referrerPolicy: 'strict-origin-when-cross-origin', override: true },
    strictTransportSecurity: {
      accessControlMaxAgeSec: 31_536_000,
      includeSubdomains: true,
      override: true,
    },
    xssProtection: { modeBlock: true, protection: true, override: true },
  },
});

// ── OG redirect injection ────────────────────────────────────────────────────
//
// SST's StaticSite creates its own viewer-request CloudFront Function for SPA
// routing (URL rewrites, index.html fallback). CloudFront allows only ONE
// function per event type, so we inject our bot-detection logic into SST's
// function via `edge.viewerRequest.injection`.
//
// The injection runs BEFORE SST's default routing. If the request matches
// /forecast/{forecastId} AND the User-Agent is a known social-media bot,
// we return a 302 redirect to the API's /og/forecast/{forecastId} endpoint.
// The early return skips SST's routing — exactly what we want for bots.
// Human browsers fall through to the normal SPA flow.

export const web = new sst.aws.StaticSite('Web', {
  path: 'packages/web',

  // Custom domain: uweather.eu (prod) / dev.uweather.eu (dev).
  // SST resolves the Route 53 hosted zone for uweather.eu and provisions an
  // ACM certificate (us-east-1) + DNS record automatically on every deploy.
  domain: {
    name: $app.stage === 'prod' ? 'uweather.eu' : 'dev.uweather.eu',
    dns: sst.aws.dns(),
  },

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

  // Inject bot-detection into SST's viewer-request CloudFront Function.
  // Returns a 302 redirect for social-media bots on /forecast/{id} paths;
  // human browsers fall through to SST's default SPA routing.
  // Attach security response headers policy to the CloudFront distribution
  transform: {
    cdn: {
      distribution: (args) => {
        const defaultCache = args.defaultCacheBehavior;
        if (defaultCache && typeof defaultCache !== 'string') {
          defaultCache.responseHeadersPolicyId = securityHeadersPolicy.id;
        }
      },
    },
  },

  edge: {
    viewerRequest: {
      injection: $interpolate`
  var __ogUri = event.request.uri;
  var __ogUa = (event.request.headers['user-agent'] && event.request.headers['user-agent'].value) || '';
  var __ogMatch = __ogUri.match(/^\\/forecast\\/([A-Za-z0-9]+)$/);
  if (__ogMatch) {
    var __ogBots = ['TelegramBot','Slackbot','Twitterbot','facebookexternalhit','LinkedInBot','Discordbot','WhatsApp','Googlebot','vkShare','Embedly','Iframely'];
    if (__ogBots.some(function(b) { return __ogUa.indexOf(b) !== -1; })) {
      var __ogApiUrl = '${api.url}'.replace(/\\/$/, '');
      return { statusCode: 302, statusDescription: 'Found', headers: { location: { value: __ogApiUrl + '/og/forecast/' + __ogMatch[1] }, 'cache-control': { value: 'public, max-age=3600' } } };
    }
  }`,
    },
  },
});
