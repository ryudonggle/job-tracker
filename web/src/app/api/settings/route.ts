import { NextResponse } from "next/server";
import { getSettings, sql } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PATCH(req: Request) {
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (b.interval_days !== undefined) {
    const n = Number(b.interval_days);
    if (!Number.isInteger(n) || n < 1 || n > 30) return NextResponse.json({ error: "주기는 1~30일" }, { status: 400 });
    patch.interval_days = n;
  }
  if (b.profile !== undefined) patch.profile = String(b.profile);
  if (b.min_data_role !== undefined) patch.min_data_role = Math.min(1, Math.max(0, Number(b.min_data_role)));
  if (Object.keys(patch).length) await sql`update settings set ${sql(patch as Record<string, never>)} where id = 1`;

  if (b.report_levels !== undefined) {
    const levels = (b.report_levels as string[]).filter((l) => ["상", "중", "하"].includes(l));
    await sql`update settings set report_levels = ${levels} where id = 1`;
  }
  // 경험 요약을 바꿨으면 전체 다시 채점(다음 실행부터 배치로 처리)
  if (b.rescore) await sql`update jobs set scored_at = null, report_status = '없음', updated_at = now()`;
  return NextResponse.json(await getSettings());
}
