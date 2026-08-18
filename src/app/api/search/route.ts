import { NextRequest, NextResponse } from 'next/server';
import { appsScriptGet, AppsScriptError } from '@/lib/appsScript';
import type { SearchApiResponse } from '@/lib/types';

// Apps Script cold starts can be slow; give this function longer than
// Vercel's default so it isn't killed before our own timeout in
// appsScript.ts gets a chance to return a friendly error.
export const maxDuration = 25;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (!query) {
    return NextResponse.json({ success: true, results: [] } satisfies SearchApiResponse);
  }

  try {
    const data = await appsScriptGet<SearchApiResponse>({ action: 'search', query });
    if (!data.success) {
      return NextResponse.json(data, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : 'Search is unavailable right now.';
    return NextResponse.json({ success: false, error: message } satisfies SearchApiResponse, { status: 502 });
  }
}
