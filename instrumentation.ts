export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const isBuild = process.env.npm_lifecycle_event === 'build' || process.argv.some(arg => arg.includes('build'));
    if (!isBuild) {
      try {
        const { maxBotService } = await import('@/lib/max-bot');
        await maxBotService.start();
      } catch (err) {
        console.error('[MAX-BOT] Instrumentation register error:', err);
      }
    }
  }
}
