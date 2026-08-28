import { NextResponse } from 'next/server';
import { maxBotService } from '@/lib/max-bot';

export const dynamic = 'force-dynamic';

export async function GET() {
  const logs = maxBotService.getLogs();
  return NextResponse.json({ logs });
}
