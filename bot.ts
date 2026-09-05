#!/usr/bin/env node
/**
 * Standalone MAX Bot Runner (Node.js / TypeScript)
 *
 * Usage:
 *   MAX_BOT_TOKEN="your_token" npx tsx bot.ts
 *   npm run bot
 */

import { configureTrustedCerts } from './lib/tls-setup';
configureTrustedCerts();

import { MaxBotService } from './lib/max-bot';


console.log('====================================================');
console.log('       MAX Bot API Long Polling Server Runner       ');
console.log('   Endpoint: https://platform-api2.max.ru           ');
console.log('====================================================\n');

const token = process.env.MAX_BOT_TOKEN;

if (!token || !token.trim()) {
  console.error('[ОШИБКА] Переменная окружения MAX_BOT_TOKEN не задана!');
  console.error('Пример запуска:');
  console.error('  MAX_BOT_TOKEN="your_token_here" npm run bot\n');
  console.error('Или укажите её в файле .env');
}

const bot = MaxBotService.getInstance();

// Handle graceful shutdown
const shutdown = () => {
  console.log('\n[MAX-BOT] Получен сигнал завершения. Остановка Long Polling...');
  bot.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start bot polling
bot.start().catch((err) => {
  console.error('[MAX-BOT] Фатальная ошибка при запуске бота:', err);
});
