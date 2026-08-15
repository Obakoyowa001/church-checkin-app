import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  computeAdminSessionToken,
  verifyAdminPassword,
} from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  let password: string;
  try {
    const body = await req.json();
    password = String(body?.password ?? '');
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }

  const ok = await verifyAdminPassword(password);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Incorrect password.' }, { status: 401 });
  }

  const token = await computeAdminSessionToken();
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Admin login is not configured (ADMIN_PASSWORD / ADMIN_SESSION_SECRET).' },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
