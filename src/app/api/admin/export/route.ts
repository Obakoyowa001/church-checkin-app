import { NextResponse } from 'next/server';
import { appsScriptGet, AppsScriptError } from '@/lib/appsScript';
import type { ExportApiResponse } from '@/lib/types';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Apps Script cold starts can be slow; give this function longer than
// Vercel's default so it isn't killed before our own timeout in
// appsScript.ts gets a chance to return a friendly error.
export const maxDuration = 25;

// Auth is enforced by src/middleware.ts for all /api/admin/* routes.
export async function GET() {
  let data: ExportApiResponse;
  try {
    data = await appsScriptGet<ExportApiResponse>({ action: 'export' });
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : 'Export is unavailable right now.';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }

  if (!data.success || !data.rows) {
    return NextResponse.json({ success: false, error: data.error ?? 'Export failed.' }, { status: 502 });
  }

  const header = ['timestamp', 'memberId', 'fullName', 'serviceDate'];
  const lines = [header.join(',')];
  for (const row of data.rows) {
    lines.push(
      [row.timestamp, row.memberId, row.fullName, row.serviceDate].map((v) => csvEscape(String(v))).join(',')
    );
  }
  const csv = lines.join('\n');
  const filename = `attendance-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
