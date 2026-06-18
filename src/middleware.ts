import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/cocore";

/**
 * Gate the app pages on the presence of a session cookie. The cookie's
 * validity is re-checked server-side on every authed API call; this is just a
 * cheap routing guard so signed-out users land on /login.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const { pathname } = req.nextUrl;

  if (pathname === "/login") {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protect the app pages; leave API routes and assets alone.
  matcher: ["/", "/chat", "/dashboard"],
};
