import { NextResponse } from 'next/server';
import { automationService } from '@/server/automation-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runIdStr = searchParams.get('runId');
    if (!runIdStr) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }
    const runId = parseInt(runIdStr, 10);
    const result = await automationService.retryFailed(runId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
