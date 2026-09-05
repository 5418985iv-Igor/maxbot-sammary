import { NextRequest, NextResponse } from 'next/server';
import { maxBotService, MaxUpdate } from '@/lib/max-bot';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a.trim());
    const bufB = Buffer.from(b.trim());
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Check if User-Agent matches official MAX Bot API platform
 * The MAX webhook caller identifies itself as "OneMe/x.x.x Bot API"
 */
function isMaxUserAgent(ua: string | null): boolean {
  if (!ua) return false;
  return (
    /OneMe\/[0-9.]+\s+Bot\s+API/i.test(ua) ||
    /OneMe\//i.test(ua) ||
    /Bot\s+API/i.test(ua) ||
    /MAX/i.test(ua)
  );
}

/**
 * Check if IP originates from known MAX / VK / Mail.ru network or local proxy
 */
function isMaxIpAddress(rawIp: string | null): boolean {
  if (!rawIp) return false;
  const ip = rawIp.split(',')[0].trim();

  // Local / Docker container / Reverse-proxy private networks
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('10.') ||
    ip.startsWith('172.') ||
    ip.startsWith('192.168.')
  ) {
    return true;
  }

  // Known MAX / Mail.ru / VK Bot API IP ranges (e.g. 95.163.32.0/24, etc.)
  if (
    ip.startsWith('95.163.') ||
    ip.startsWith('185.16.') ||
    ip.startsWith('178.237.') ||
    ip.startsWith('217.69.') ||
    ip.startsWith('128.140.') ||
    ip.startsWith('94.100.') ||
    ip.startsWith('195.218.')
  ) {
    return true;
  }

  return false;
}

/**
 * Validate that an object has the expected MAX Update structure
 */
function isValidSingleUpdate(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  const type = obj.update_type || obj.event_type || obj.type;
  return typeof type === 'string' && type.trim().length > 0;
}

function isValidMaxPayload(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  if (Array.isArray(body)) {
    return body.length > 0 && body.every(isValidSingleUpdate);
  }
  const obj = body as Record<string, unknown>;
  if (Array.isArray(obj.updates)) {
    return obj.updates.length > 0 && obj.updates.every(isValidSingleUpdate);
  }
  return isValidSingleUpdate(obj);
}

export async function POST(req: NextRequest) {
  const secretHeader =
    req.headers.get('x-max-bot-api-secret') ||
    req.headers.get('X-Max-Bot-Api-Secret');
  const expectedSecret = process.env.MAX_WEBHOOK_SECRET?.trim();
  const strictSecret = process.env.MAX_STRICT_WEBHOOK_SECRET === 'true';

  const userAgent = req.headers.get('user-agent') || '';
  const clientIp =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';

  // 1. If client provided the X-Max-Bot-Api-Secret header
  if (secretHeader && secretHeader.trim().length > 0) {
    if (expectedSecret && expectedSecret.length > 0) {
      if (!timingSafeCompare(secretHeader, expectedSecret)) {
        maxBotService.addLog(
          'warn',
          `[Webhook MAX] Отклонен POST-запрос: передан неверный заголовок X-Max-Bot-Api-Secret`,
          {
            url: req.url,
            ip: clientIp,
            userAgent,
          }
        );
        return NextResponse.json(
          { ok: false, error: 'Forbidden: invalid X-Max-Bot-Api-Secret' },
          { status: 403 }
        );
      }
      maxBotService.addLog(
        'info',
        `[Webhook MAX] Запрос авторизован по заголовку X-Max-Bot-Api-Secret (секрет совпадает)`
      );
    } else {
      maxBotService.addLog(
        'info',
        `[Webhook MAX] Получен заголовок X-Max-Bot-Api-Secret (MAX_WEBHOOK_SECRET не задан, проверка пропущена)`
      );
    }
  } else {
    // 2. Client did NOT provide X-Max-Bot-Api-Secret header
    // According to MAX Bot API spec, the secret is optional when registering a webhook subscription.
    // If the subscription was registered without a secret (or via dev.max.ru portal), MAX does not send this header.

    if (strictSecret && expectedSecret && expectedSecret.length > 0) {
      // Administrator explicitly demanded strict secret enforcement via MAX_STRICT_WEBHOOK_SECRET=true
      maxBotService.addLog(
        'warn',
        `[Webhook MAX] Отклонен POST-запрос: включен строгий режим проверки (MAX_STRICT_WEBHOOK_SECRET), заголовок X-Max-Bot-Api-Secret отсутствует`,
        {
          url: req.url,
          ip: clientIp,
          userAgent,
        }
      );
      return NextResponse.json(
        { ok: false, error: 'Forbidden: missing X-Max-Bot-Api-Secret (strict mode)' },
        { status: 403 }
      );
    }

    const isFromMax = isMaxUserAgent(userAgent) || isMaxIpAddress(clientIp);

    if (expectedSecret && expectedSecret.length > 0) {
      maxBotService.addLog(
        'info',
        `[Webhook MAX] Входящий запрос от ${isFromMax ? 'платформы MAX' : 'клиента'} (IP: ${clientIp}, User-Agent: "${userAgent}"). Заголовок X-Max-Bot-Api-Secret не передан платформой MAX (подписка в MAX API создана без секрета).`
      );
    }
  }

  // Parse JSON body
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

  // Validate that body contains valid MAX Update data
  if (!isValidMaxPayload(body)) {
    maxBotService.addLog(
      'warn',
      `[Webhook MAX] Отклонен запрос: тело не содержит допустимого события MAX API (отсутствует update_type)`,
      { body, ip: clientIp, userAgent }
    );
    return NextResponse.json(
      { ok: false, error: 'Invalid MAX Update payload: missing update_type' },
      { status: 400 }
    );
  }

  // Dispatch updates to existing maxBotService.handleUpdate (same pipeline as long polling)
  let processedCount = 0;
  if (Array.isArray(body)) {
    for (const item of body) {
      maxBotService.handleUpdate(item as MaxUpdate, { isWebhook: true });
      processedCount++;
    }
  } else if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.updates)) {
      for (const item of obj.updates) {
        maxBotService.handleUpdate(item as MaxUpdate, { isWebhook: true });
        processedCount++;
      }
    } else {
      maxBotService.handleUpdate(obj as unknown as MaxUpdate, { isWebhook: true });
      processedCount++;
    }
  }

  // Always return HTTP 200 within 30 seconds to acknowledge receipt per MAX Bot API specification
  return NextResponse.json({ ok: true, processed: processedCount });
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

