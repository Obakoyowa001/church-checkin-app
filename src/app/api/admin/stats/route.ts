import { NextResponse } from 'next/server';
import { appsScriptGet, AppsScriptError } from '@/lib/appsScript';
import type { StatsApiResponse } from '@/lib/types';

// Auth is enforced by src/middleware.ts for all /api/admin/* routes.
export async function GET() {
  try {
    const data = await appsScriptGet<StatsApiResponse>({ action: 'stats' });
    if (!data.success) {
      return NextResponse.json(data, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : 'Stats are unavailable right now.';
    return NextResponse.json({ success: false, error: message } satisfies StatsApiResponse, { status: 502 });
  }
}
