import { createLogger } from '@uweather/core';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
/**
 * Telegram webhook entry point — Phase 4.
 *
 * Creates the grammY Bot, registers all command handlers, and exports the
 * Lambda handler using the `aws-lambda-async` transport.
 *
 * aws-lambda-async: API Gateway receives an immediate 200 response while the
 * bot handler continues running asynchronously inside the Lambda process.
 * This avoids Telegram's 5-second response deadline for long-running pipelines.
 *
 * See co-located modules for each concern:
 *   commands.ts   — /start, /weather, /history, /lang, plain-text handlers
 *   pipeline.ts   — orchestrator invocation, SFN polling, forecast fetch
 *   user-store.ts — user profile reads and writes (Users DynamoDB table)
 *   format.ts     — Markdown caption builder, condition emoji map
 */
import { Bot, webhookCallback } from 'grammy';
import { Resource } from 'sst';
import { registerCommands } from './commands.js';

const log = createLogger({ function: 'telegram-webhook' });

const bot = new Bot(Resource.TelegramBotToken.value);
registerCommands(bot);

const handleUpdate = webhookCallback(bot, 'aws-lambda-async');

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  log.info('Telegram update received');
  try {
    await handleUpdate(event, context);
  } catch (err) {
    log.error('Webhook handler error', { err });
  }
  // Always return 200 — grammY's aws-lambda-async calls the Lambda callback
  // synchronously (API Gateway gets the 200 immediately) and runs the bot handler
  // asynchronously. A non-2xx return would cause Telegram to retry indefinitely.
  return { statusCode: 200, body: 'ok' };
};
