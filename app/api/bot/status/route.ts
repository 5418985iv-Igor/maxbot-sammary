import { NextResponse } from 'next/server';
import { maxBotService } from '@/lib/max-bot';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = maxBotService.getStatus();
    return NextResponse.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        isRunning: false,
        hasToken: Boolean(process.env.MAX_BOT_TOKEN),
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
        botInfo: null,
        marker: null,
        logCount: 0,
        error: message,
      },
      { status: 200 }
    );
  }
}
