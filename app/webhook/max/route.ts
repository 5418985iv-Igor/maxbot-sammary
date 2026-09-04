import { NextRequest, NextResponse } from 'next/server';
import { maxBotService, MaxUpdate } from '@/lib/max-bot';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secretHeader =
    req.headers.get('x-max-bot-api-secret') ||
    req.headers.get('X-Max-Bot-Api-Secret');
  const expectedSecret = process.env.MAX_WEBHOOK_SECRET;

  if (!expectedSecret || !secretHeader || secretHeader !== expectedSecret) {
    maxBotService.addLog(
      'warn',
      '[Webhook MAX] Отклонен запрос: неверный или отсутствующий секрет X-Max-Bot-Api-Secret'
    );
    return new NextResponse('Forbidden', { status: 403 });
  }

  let event: Record<string, unknown> = {};
  try {
    event = await req.json();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    maxBotService.addLog(
      'error',
      `[Webhook MAX] Ошибка парсинга JSON тела запроса: ${errorMsg}`
    );
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Delegate incoming update/message_created to existing bot message handler (non-blocking)
  maxBotService.handleUpdate(event as unknown as MaxUpdate, { isWebhook: true });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/max/webhook/max',
    method: 'POST',
    secretHeader: 'X-Max-Bot-Api-Secret',
  });
}

