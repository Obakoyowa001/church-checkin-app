import { NextResponse } from 'next/server';
import { appsScriptGet, AppsScriptError } from '@/lib/appsScript';
import type { StatsApiResponse } from '@/lib/types';

// Apps Script cold starts can be slow; give this function longer than
// Vercel's default so it isn't killed before our own timeout in
// appsScript.ts gets a chance to return a friendly error.
export const maxDuration = 25;

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
