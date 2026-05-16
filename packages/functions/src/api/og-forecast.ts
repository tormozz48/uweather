import { createLogger } from '@uweather/core';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { fetchForecastById, toForecastResponse } from './utils.js';

const log = createLogger({ function: 'api-og-forecast' });

/**
 * Bot user-agent patterns that request OG meta tags for link previews.
 * Covers Telegram, Slack, Twitter/X, Facebook, LinkedIn, Discord, WhatsApp,
 * and generic link-preview crawlers.
 */
const BOT_USER_AGENTS = [
  'TelegramBot',
  'Slackbot',
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'Discordbot',
  'WhatsApp',
  'Googlebot',
  'vkShare',
  'Embedly',
  'Quora Link Preview',
  'Iframely',
];

/** Escape HTML special characters to prevent XSS in OG values. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Truncate text to a max length, adding ellipsis if needed. */
function truncate(text: string, maxLength: number): string {
  const singleLine = text.replace(/\n/g, ' ').trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1)}…`;
}

const OG_DESCRIPTION_MAX_LENGTH = 200;

/**
 * GET /og/forecast/{forecastId}
 *
 * Returns a minimal HTML page with Open Graph and Twitter Card meta tags.
 * Used by social media bots (Telegram, Slack, Twitter, etc.) for link previews.
 *
 * Human browsers should never reach this endpoint — the CloudFront Function
 * on the StaticSite only redirects bot user agents here.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const reqLog = log.child({ requestId: context.awsRequestId });
  const forecastId = event.pathParameters?.forecastId?.trim();
  const userAgent = event.headers?.['user-agent'] ?? 'unknown';

  if (!forecastId) {
    return { statusCode: 400, body: 'Missing forecastId' };
  }

  const isBot = BOT_USER_AGENTS.some((bot) => userAgent.includes(bot));
  reqLog.info('OG request', { forecastId, userAgent, isBot });

  try {
    const forecast = toForecastResponse(await fetchForecastById(forecastId));

    const title = escapeHtml(`${forecast.city} weather — uweather`);
    const description = escapeHtml(truncate(forecast.funnyText, OG_DESCRIPTION_MAX_LENGTH));
    const imageUrl = escapeHtml(forecast.imageUrl);
    const temperature = forecast.weather.temperature;
    const condition = escapeHtml(forecast.weather.condition);

    const html = `<!DOCTYPE html>
<html lang="${escapeHtml(forecast.language)}">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${condition}, ${temperature}°C — ${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1024" />
  <meta property="og:image:height" content="576" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${condition}, ${temperature}°C — ${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <p>${title}: ${condition}, ${temperature}°C</p>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
      body: html,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('not found')) {
      reqLog.warn('OG forecast not found', { forecastId });
      return { statusCode: 404, body: 'Forecast not found' };
    }

    reqLog.error('OG error', { forecastId, error: message });
    return { statusCode: 500, body: 'Internal server error' };
  }
};
