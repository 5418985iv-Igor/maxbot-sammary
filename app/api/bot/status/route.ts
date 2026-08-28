import { NextResponse } from 'next/server';
import { maxBotService } from '@/lib/max-bot';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = maxBotService.getStatus();
  return NextResponse.json(status);
}
