import { NextResponse } from "next/server";

export default function proxy(req) {
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isApiAuth = pathname.startsWith('/api/auth');
  const isStatic = pathname.startsWith('/_next') || pathname === '/favicon.ico';

  if (isStatic || isApiAuth) return NextResponse.next();

  const token = req.cookies.get('authjs.session-token') ?? 
                req.cookies.get('__Secure-authjs.session-token');

  const isLoggedIn = !!token;

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};