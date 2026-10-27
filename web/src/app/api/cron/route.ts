import { NextResponse } from "next/server";
import { maybeCollect, processPending } from "@/lib/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel Cron이 하루 1회 호출. 수집은 settings.interval_days 주기로만, 채점·리포트는 매번 남은 것 처리.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const start = Date.now();
  const collected = await maybeCollect(false, start + 170_000);
  const processed = await processPending(280_000 - (Date.now() - start));
  return NextResponse.json({ collected, processed });
}
