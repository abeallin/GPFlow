import { NextResponse } from 'next/server';
import { automationService } from '@/server/automation-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await automationService.startRun(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to start automation run:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
