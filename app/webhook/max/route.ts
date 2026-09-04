import { NextRequest, NextResponse } from 'next/server';
import { maxBotService, MaxUpdate } from '@/lib/max-bot';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secretHeader =
    req.headers.get('x-max-bot-api-secret') ||
    req.headers.get('X-Max-Bot-Api-Secret');
  const expectedSecret = process.env.MAX_WEBHOOK_SECRET;

  // If secret is set in .env, validate it
  if (expectedSecret && expectedSecret.trim().length > 0) {
    if (!secretHeader || secretHeader.trim() !== expectedSecret.trim()) {
      maxBotService.addLog(
        'warn',
        `[Webhook MAX] Отклонен POST-запрос: неверный или отсутствующий заголовок X-Max-Bot-Api-Secret (получен: ${
          secretHeader ? 'неверный' : 'отсутствует'
        })`,
        {
          url: req.url,
          receivedHeader: secretHeader ? '[Скрыт]' : null,
          ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        }
      );
      return NextResponse.json(
        { ok: false, error: 'Forbidden: invalid or missing X-Max-Bot-Api-Secret' },
        { status: 403 }
      );
    }
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    maxBotService.addLog(
      'error',
      `[Webhook MAX] Ошибка парсинга JSON тела запроса: ${errorMsg}`
    );
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle single update or multiple updates batch
  if (Array.isArray(body)) {
    for (const item of body) {
      maxBotService.handleUpdate(item as MaxUpdate, { isWebhook: true });
    }
  } else if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.updates)) {
      for (const item of obj.updates) {
        maxBotService.handleUpdate(item as MaxUpdate, { isWebhook: true });
      }
    } else {
      maxBotService.handleUpdate(obj as unknown as MaxUpdate, { isWebhook: true });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const hasSecret = Boolean(
    process.env.MAX_WEBHOOK_SECRET && process.env.MAX_WEBHOOK_SECRET.trim().length > 0
  );

  maxBotService.addLog(
    'info',
    '[Webhook MAX] Получен GET-запрос проверки эндпоинта Webhook (Healthcheck / Ping от клиента)',
    {
      url: req.url,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    }
  );

  return NextResponse.json({
    ok: true,
    status: 'active',
    endpoint: '/max/webhook/max',
    alternateEndpoint: '/webhook/max',
    method: 'POST',
    secretHeader: 'X-Max-Bot-Api-Secret',
    secretConfigured: hasSecret,
    time: new Date().toISOString(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, OPTIONS, HEAD',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, X-Max-Bot-Api-Secret',
    },
  });
}

