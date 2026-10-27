import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, roleOf } from "@/lib/auth";

const PUBLIC = ["/login", "/api/login", "/api/logout", "/api/cron", "/manifest.webmanifest", "/sw.js", "/icons/"];
/** 보기 전용 계정이 못 여는 곳 (설정·경험 요약·수동 실행) */
const ADMIN_ONLY = ["/settings", "/api/settings", "/api/run"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const role = await roleOf(req.cookies.get(COOKIE)?.value);
  if (role === "admin") return NextResponse.next();
  if (role === "viewer" || role === "guest") {
    const blocked = ADMIN_ONLY.some((p) => pathname.startsWith(p)) || (pathname.startsWith("/api/") && req.method !== "GET");
    if (!blocked) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "보기 전용 계정이에요" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
