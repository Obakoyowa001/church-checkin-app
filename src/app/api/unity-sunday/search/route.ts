import { NextRequest, NextResponse } from 'next/server';
import { appsScriptGet, AppsScriptError } from '@/lib/appsScript';
import type { SearchApiResponse } from '@/lib/types';

// In development or when APPS_SCRIPT_URL is not yet configured, provide demo attendees
const DEMO_ATTENDEES = [
  { memberId: 'U001', fullName: 'Grace Davis', phone: '(555) 567-8901' },
  { memberId: 'U002', fullName: 'John Smith', phone: '(555) 234-5678' },
  { memberId: 'U003', fullName: 'Mary Johnson', phone: '(555) 345-6789' },
  { memberId: 'U004', fullName: 'Samuel Jackson', phone: '(555) 456-7890' },
  { memberId: 'U005', fullName: 'Faith Walker', phone: '(555) 901-2345' },
  { memberId: 'U006', fullName: 'David Miller', phone: '(555) 890-1234' },
  { memberId: 'U007', fullName: 'Esther Wilson', phone: '(555) 789-0123' },
  { memberId: 'U008', fullName: 'Daniel Brown', phone: '(555) 678-9012' },
  { memberId: 'U009', fullName: 'Ruth Harris', phone: '(555) 234-8901' },
  { memberId: 'U010', fullName: 'Peter Allen', phone: '(555) 123-4567' },
];

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (!query) {
    return NextResponse.json({ success: true, results: [] } satisfies SearchApiResponse);
  }

  // Graceful fallback for local development / testing without live Google Sheet credentials
  if (!process.env.APPS_SCRIPT_URL) {
    const qLower = query.toLowerCase();
    const results = DEMO_ATTENDEES.filter((m) => m.fullName.toLowerCase().includes(qLower));
    return NextResponse.json({ success: true, results } satisfies SearchApiResponse);
  }

  try {
    const data = await appsScriptGet<SearchApiResponse>({ action: 'searchUnity', query });
    if (!data.success) {
      return NextResponse.json(data, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : 'Search is unavailable right now.';
    return NextResponse.json({ success: false, error: message } satisfies SearchApiResponse, { status: 502 });
  }
}
