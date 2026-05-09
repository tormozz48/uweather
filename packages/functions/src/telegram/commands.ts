import { createLogger } from '@uweather/core';
/**
 * Bot command and message handlers for the Telegram bot.
 *
 * All handlers are registered on the Bot instance via `registerCommands(bot)`.
 * This keeps the entry point (webhook.ts) free of business logic.
 *
 * Commands:
 *   /start       — welcome message with language auto-detect
 *   /weather     — get a forecast for a city
 *   /history     — show the last 5 forecasts
 *   /lang        — change language preference
 *   (plain text) — treated as a city name
 */
import type { Bot } from 'grammy';
import { CONDITION_EMOJI, formatForecastCaption } from './format.js';
import { fetchForecastHistory, runPipeline } from './pipeline.js';
import { getUserLanguage, upsertUser } from './user-store.js';

const log = createLogger({ function: 'telegram-commands' });

// ── Shared reply helper ───────────────────────────────────────────────────────

/**
 * Send the forecast photo and caption, replacing the loading message.
 * On error, edits the loading message with a friendly error text.
 */
async function sendForecastReply(
  bot: Bot,
  chatId: number,
  city: string,
  language: string,
  loadingMessageId: number,
): Promise<void> {
  try {
    const forecast = await runPipeline(city, language, `telegram#${chatId}`);
    await upsertUser(chatId, { city: forecast.city, country: forecast.country });

    await bot.api.deleteMessage(chatId, loadingMessageId);
    await bot.api.sendPhoto(chatId, forecast.imageUrl, {
      caption: formatForecastCaption(forecast),
      parse_mode: 'Markdown',
    });
  } catch (err) {
    log.error('Forecast failed', { chatId, city, err });
    await bot.api.editMessageText(
      chatId,
      loadingMessageId,
      `😕 Couldn't get the forecast for *${city}* right now. Please try again in a moment.`,
      { parse_mode: 'Markdown' },
    );
  }
}

// ── Command: /start ───────────────────────────────────────────────────────────

function registerStart(bot: Bot): void {
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    const tgLang = ctx.from?.language_code ?? 'en';
    const lang = tgLang.startsWith('uk') ? 'uk' : tgLang.startsWith('ru') ? 'ru' : 'en';

    await upsertUser(chatId, { language: lang });

    await ctx.reply(
      [
        '👋 *Welcome to uweather!*',
        '',
        'I deliver funny, AI-powered weather forecasts with generated city images.',
        '',
        '🌤️ Send me a *city name* (e.g. Kyiv, London, Tokyo) to get a forecast.',
        '📜 /history — see your last 5 forecasts.',
        '🌍 /lang {code} — change language (e.g. `/lang uk`, `/lang de`).',
        '',
        'What city are you in?',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });
}

// ── Command: /weather {city} ──────────────────────────────────────────────────

function registerWeather(bot: Bot): void {
  bot.command('weather', async (ctx) => {
    const chatId = ctx.chat.id;
    const city = ctx.match?.trim();

    if (!city) {
      await ctx.reply('Please provide a city name. Example: `/weather Kyiv`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const language = await getUserLanguage(chatId);
    const loadingMsg = await ctx.reply(`🔍 Fetching forecast for *${city}*…`, {
      parse_mode: 'Markdown',
    });

    await sendForecastReply(bot, chatId, city, language, loadingMsg.message_id);
  });
}

// ── Command: /history ─────────────────────────────────────────────────────────

function registerHistory(bot: Bot): void {
  bot.command('history', async (ctx) => {
    const chatId = ctx.chat.id;
    const userId = `telegram#${chatId}`;
    const items = await fetchForecastHistory(userId, 5);

    if (items.length === 0) {
      await ctx.reply(
        "You haven't requested any forecasts yet. Send me a city name to get started!",
      );
      return;
    }

    const lines = ['📜 *Your recent forecasts:*', ''];
    for (const item of items) {
      const emoji = CONDITION_EMOJI[item.weatherSummary.condition] ?? '🌡️';
      const temp = Math.round(item.weatherSummary.temperature);
      lines.push(
        `${emoji} *${item.city}* — ${item.date} — ${temp}°C (${item.weatherSummary.condition})`,
      );
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  });
}

// ── Command: /lang {code} ─────────────────────────────────────────────────────

function registerLang(bot: Bot): void {
  bot.command('lang', async (ctx) => {
    const chatId = ctx.chat.id;
    const code = ctx.match?.trim().toLowerCase();

    if (!code || code.length < 2 || code.length > 5) {
      await ctx.reply(
        'Please provide a language code. Examples: `/lang en`, `/lang uk`, `/lang de`, `/lang fr`, `/lang es`',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    await upsertUser(chatId, { language: code });
    await ctx.reply(`✅ Language set to *${code}*. Your next forecast will be in that language.`, {
      parse_mode: 'Markdown',
    });
  });
}

// ── Plain text → city name ────────────────────────────────────────────────────

function registerPlainText(bot: Bot): void {
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();

    if (text.startsWith('/')) {
      await ctx.reply(
        'Unknown command. Try sending a city name, or use /start to see what I can do.',
      );
      return;
    }

    const language = await getUserLanguage(chatId);
    const loadingMsg = await ctx.reply(`🔍 Fetching forecast for *${text}*…`, {
      parse_mode: 'Markdown',
    });

    await sendForecastReply(bot, chatId, text, language, loadingMsg.message_id);
  });
}

// ── Public registration ───────────────────────────────────────────────────────

/** Register all command and message handlers on the given bot instance. */
export function registerCommands(bot: Bot): void {
  registerStart(bot);
  registerWeather(bot);
  registerHistory(bot);
  registerLang(bot);
  registerPlainText(bot);
}
