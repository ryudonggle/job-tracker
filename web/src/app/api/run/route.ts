import { NextResponse } from "next/server";
import { maybeCollect, processPending } from "@/lib/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// 설정 화면의 수동 실행 버튼. { collect: true }면 주기와 상관없이 수집부터.
export async function POST(req: Request) {
  const { collect = false } = await req.json().catch(() => ({}));
  try {
    const start = Date.now();
    const collected = collect ? await maybeCollect(true, start + 170_000) : null;
    const processed = await processPending(280_000 - (Date.now() - start));
    return NextResponse.json({ collected, processed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
