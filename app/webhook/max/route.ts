import { NextRequest, NextResponse } from 'next/server';
import { maxBotService } from '@/lib/max-bot';

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

  const updateType =
    (event.update_type as string) ||
    (event.event_type as string) ||
    (event.type as string) ||
    '';

  if (updateType === 'message_created') {
    const msg = event.message as Record<string, unknown> | undefined;
    const recipient = msg?.recipient as Record<string, unknown> | undefined;
    const rawChatId =
      recipient?.chat_id ??
      event.chat_id ??
      event.recipient_chat_id ??
      (event.recipient as Record<string, unknown> | undefined)?.chat_id;

    const chatId: string | number =
      typeof rawChatId === 'string' || typeof rawChatId === 'number'
        ? rawChatId
        : 'неизвестно';

    const msgBody = msg?.body as Record<string, unknown> | undefined;
    const messageText =
      (msgBody?.text as string) ??
      (msg?.text as string) ??
      (event.text as string) ??
      '—';

    const logMessage = `[Webhook MAX] [Событие: message_created] Chat ID: ${chatId} | Текст: "${messageText}"`;
    maxBotService.addLog('event', logMessage, event);
  } else {
    maxBotService.addLog(
      'info',
      `[Webhook MAX] Получено событие: ${updateType || 'неизвестный тип'}`,
      event
    );
  }

  return NextResponse.json({ ok: true });
}
