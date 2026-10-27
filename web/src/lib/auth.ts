export const COOKIE = "jt_auth";

/** guest = 로그인 화면 '둘러보기'(포트폴리오 공개용). viewer와 같이 보기 전용이고, 메모·지원 상태·권장 제출일은 안 보인다. */
export type Role = "admin" | "viewer" | "guest";

/** 쿠키 값 = sha256(역할:비밀번호:서버 비밀값). admin은 APP_PASSWORD, viewer·guest는 VIEW_PASSWORD.
 *  guest 쿠키는 누구에게나 주므로 서버 비밀값(CRON_SECRET)을 섞어, 쿠키로 VIEW_PASSWORD를 대입 추측할 수 없게 한다.
 *  미들웨어(edge)에서도 돌도록 Web Crypto 사용. */
export async function authToken(role: Role = "admin"): Promise<string | null> {
  const pw = role === "admin" ? process.env.APP_PASSWORD : process.env.VIEW_PASSWORD;
  if (!pw) return null;
  const prefix = role === "admin" ? "job-tracker" : role === "viewer" ? "job-tracker:view" : "job-tracker:guest";
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const data = new TextEncoder().encode(`${prefix}:${pw}:${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function roleOf(token: string | undefined): Promise<Role | null> {
  if (!token) return null;
  if (token === (await authToken("admin"))) return "admin";
  if (token === (await authToken("viewer"))) return "viewer";
  if (token === (await authToken("guest"))) return "guest";
  return null;
}
