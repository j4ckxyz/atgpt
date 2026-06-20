import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/cocore";
import { DID_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(DID_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
