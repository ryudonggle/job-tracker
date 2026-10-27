import { NextResponse } from "next/server";
import { COOKIE, authToken, type Role } from "@/lib/auth";

export async function POST(req: Request) {
  const { password, guest } = await req.json().catch(() => ({}));
  // guest: 로그인 화면의 '둘러보기' 버튼 — 비밀번호 없이 보기 전용으로 들어감 (포트폴리오 공개용)
  const role: Role | null =
    guest === true ? "guest"
    : process.env.APP_PASSWORD && password === process.env.APP_PASSWORD ? "admin"
    : process.env.VIEW_PASSWORD && password === process.env.VIEW_PASSWORD ? "viewer"
    : null;
  const token = role && (await authToken(role));
  if (!token) return NextResponse.json({ error: "비밀번호가 틀렸어요" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: guest === true ? 60 * 60 * 24 * 7 : 60 * 60 * 24 * 180,
  });
  return res;
}
