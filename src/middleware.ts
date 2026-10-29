import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookie, verifyToken } from '@/server/auth/jwt';

const PROTECTED: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/organizer', roles: ['organizer', 'admin'] },
  { prefix: '/profile', roles: ['participant', 'organizer', 'admin'] },
  { prefix: '/my-tickets', roles: ['participant', 'organizer', 'admin'] },
  { prefix: '/tickets', roles: ['participant', 'organizer', 'admin'] },
];

/**
 * Первичная (быстрая) проверка роли. Дублируется в guards.ts на уровне
 * серверных экшенов и Route Handlers — middleware не является единственной защитой.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = PROTECTED.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule) return NextResponse.next();

  const token = request.cookies.get(sessionCookie.name)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (!rule.roles.includes(session.role)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = 'error=forbidden';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/organizer/:path*', '/profile/:path*', '/my-tickets/:path*', '/tickets/:path*'],
};
