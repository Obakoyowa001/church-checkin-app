import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, isValidAdminSessionCookie } from '@/lib/adminAuth';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const valid = await isValidAdminSessionCookie(cookie);

  if (valid) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
