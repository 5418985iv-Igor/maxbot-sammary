import { NextRequest, NextResponse } from 'next/server';
import { maxBotService } from '@/lib/max-bot';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'start') {
      await maxBotService.start();
      return NextResponse.json({ success: true, status: maxBotService.getStatus() });
    }

    if (action === 'stop') {
      maxBotService.stop();
      return NextResponse.json({ success: true, status: maxBotService.getStatus() });
    }

    if (action === 'check') {
      const info = await maxBotService.checkMe();
      return NextResponse.json({ success: true, botInfo: info });
    }

    if (action === 'clear') {
      maxBotService.clearLogs();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
