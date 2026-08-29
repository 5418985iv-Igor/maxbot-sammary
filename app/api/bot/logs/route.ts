import { NextResponse } from 'next/server';
import { maxBotService } from '@/lib/max-bot';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const logs = maxBotService.getLogs();
    return NextResponse.json({ logs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        logs: [
          {
            id: 'err-1',
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `Ошибка чтения логов: ${message}`,
          },
        ],
      },
      { status: 200 }
    );
  }
}
