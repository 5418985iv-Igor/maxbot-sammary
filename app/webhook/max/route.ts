import { NextRequest, NextResponse } from 'next/server';

interface MaxMessageSender {
  user_id?: number | string;
  id?: number | string;
  name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

interface MaxMessageRecipient {
  chat_id?: number | string;
  chat_type?: string;
  [key: string]: unknown;
}

interface MaxMessageBody {
  text?: string;
  mid?: string;
  seq?: number;
  [key: string]: unknown;
}

interface MaxMessageLink {
  type?: string;
  sender?: MaxMessageSender;
  message?: {
    text?: string;
    body?: { text?: string };
    [key: string]: unknown;
  };
  text?: string;
  [key: string]: unknown;
}

interface MaxWebhookEvent {
  update_type?: string;
  type?: string;
  event?: string;
  timestamp?: number | string;
  chat_id?: number | string;
  recipient_chat_id?: number | string;
  sender?: MaxMessageSender;
  message?: {
    body?: MaxMessageBody;
    text?: string;
    sender?: MaxMessageSender;
    recipient?: MaxMessageRecipient;
    link?: MaxMessageLink;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function processAndLogEvent(event: MaxWebhookEvent) {
  const updateType =
    event.update_type ||
    event.type ||
    event.event ||
    'unknown';

  const rawChatId =
    event.message?.recipient?.chat_id ??
    event.chat_id ??
    event.recipient_chat_id ??
    event.message?.chat_id ??
    (event.recipient as MaxMessageRecipient | undefined)?.chat_id;

  const chatId =
    rawChatId !== undefined && rawChatId !== null
      ? String(rawChatId)
      : '...';

  const text =
    event.message?.body?.text ??
    event.message?.text ??
    event.message?.link?.message?.text ??
    event.message?.link?.message?.body?.text ??
    event.message?.link?.text ??
    (typeof event.text === 'string' ? event.text : '') ??
    '';

  let logMessage = [
    '============================================================',
    'MAX WEBHOOK',
    '===========',
    '',
    'Получено событие',
    `Тип: ${updateType}`,
  ];

  if (updateType === 'message_created') {
    logMessage.push(`Chat ID: ${chatId}`);
    logMessage.push(`Текст: ${text}`);
  } else {
    if (chatId !== '...') {
      logMessage.push(`Chat ID: ${chatId}`);
    }
    if (text) {
      logMessage.push(`Текст: ${text}`);
    }
  }

  logMessage.push('==========');

  const formattedLog = logMessage.join('\n');
  console.log(formattedLog);
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.MAX_WEBHOOK_SECRET?.trim();
  const secretHeader = (
    req.headers.get('x-max-bot-api-secret') ||
    req.headers.get('X-Max-Bot-Api-Secret')
  )?.trim();

  // If secret header is missing or does not match MAX_WEBHOOK_SECRET, return HTTP 403
  if (!expectedSecret || !secretHeader || secretHeader !== expectedSecret) {
    console.warn(
      '[MAX WEBHOOK] 403 Forbidden: X-Max-Bot-Api-Secret header is missing or invalid'
    );
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    console.error('[MAX WEBHOOK] Failed to parse JSON body:', err);
    return new NextResponse('Bad Request: Invalid JSON', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (Array.isArray(body)) {
    for (const item of body) {
      if (item && typeof item === 'object') {
        processAndLogEvent(item as MaxWebhookEvent);
      }
    }
  } else if (
    body &&
    typeof body === 'object' &&
    Array.isArray((body as Record<string, unknown>).updates)
  ) {
    for (const item of (body as { updates: unknown[] }).updates) {
      if (item && typeof item === 'object') {
        processAndLogEvent(item as MaxWebhookEvent);
      }
    }
  } else if (body && typeof body === 'object') {
    processAndLogEvent(body as MaxWebhookEvent);
  }

  return new NextResponse('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
