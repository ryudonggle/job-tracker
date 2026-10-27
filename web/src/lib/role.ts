import { cookies } from "next/headers";
import { COOKIE, roleOf, type Role } from "@/lib/auth";
import type { Job } from "@/lib/db";

/** 서버 컴포넌트에서 현재 로그인 역할. 미들웨어를 통과했으므로 null이면 admin이 아닌 것으로 본다. */
export async function currentRole(): Promise<Role | null> {
  return roleOf((await cookies()).get(COOKIE)?.value);
}

export async function isViewer(): Promise<boolean> {
  return (await currentRole()) !== "admin";
}

export async function isGuest(): Promise<boolean> {
  return (await currentRole()) === "guest";
}

/** 둘러보기(guest)에게는 개인 기록(지원 상태·메모·권장 제출일)을 지운 공고만 보낸다. */
export function maskForGuest<T extends Job>(job: T): T {
  return { ...job, status: "관심", memo: null, soft_deadline: null };
}
