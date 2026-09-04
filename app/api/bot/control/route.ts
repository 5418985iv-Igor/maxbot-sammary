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

    if (action === 'check_subscriptions') {
      const subs = await maxBotService.checkSubscriptions();
      return NextResponse.json({ success: true, subscriptions: subs });
    }

    if (action === 'register_webhook') {
      const targetUrl = body.url as string | undefined;
      const secret = body.secret as string | undefined;
      const result = await maxBotService.registerWebhook(targetUrl, secret);
      return NextResponse.json({ success: true, result });
    }

    if (action === 'delete_webhook') {
      const targetUrl = body.url as string | undefined;
      await maxBotService.deleteWebhook(targetUrl);
      return NextResponse.json({ success: true });
    }

    if (action === 'test_webhook') {
      const text = (body.text as string) || 'саммари 10';
      const chatId = body.chatId || -78187846992386;
      await maxBotService.simulateTestWebhook(text, chatId);
      return NextResponse.json({ success: true });
    }

    if (action === 'sync_production_logs') {
      const prodUrl = body.prodUrl as string | undefined;
      const res = await maxBotService.syncProductionLogs(prodUrl);
      return NextResponse.json({ success: true, count: res.count });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
