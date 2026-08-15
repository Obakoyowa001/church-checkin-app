import { NextRequest, NextResponse } from 'next/server';
import { appsScriptPost, AppsScriptError } from '@/lib/appsScript';
import type { CheckinApiResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  let memberId: string;
  try {
    const body = await req.json();
    memberId = String(body?.memberId ?? '').trim();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' } satisfies CheckinApiResponse, { status: 400 });
  }

  if (!memberId) {
    return NextResponse.json({ success: false, error: 'Missing memberId.' } satisfies CheckinApiResponse, { status: 400 });
  }

  try {
    const data = await appsScriptPost<CheckinApiResponse>({ action: 'checkin', memberId });
    if (!data.success) {
      return NextResponse.json(data, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : 'Check-in is unavailable right now.';
    return NextResponse.json({ success: false, error: message } satisfies CheckinApiResponse, { status: 502 });
  }
}
