import { NextResponse } from 'next/server';
import { automationService } from '@/server/automation-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.all) {
      await automationService.stopAllRuns();
      return NextResponse.json({ ok: true });
    }
    if (typeof body.runId === 'number') {
      await automationService.stopRun(body.runId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Missing runId or all flag' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
