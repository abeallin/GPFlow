import { NextResponse } from 'next/server';
import { automationService } from '@/server/automation-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const history = searchParams.get('history') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const activeRuns = await automationService.getActiveRuns();
    const runs = history ? await automationService.getRuns(limit, offset) : [];

    return NextResponse.json({ activeRuns, runs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
