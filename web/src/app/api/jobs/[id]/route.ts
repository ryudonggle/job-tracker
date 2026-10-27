import { NextResponse } from "next/server";
import { STATUSES, sql } from "@/lib/db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, string | boolean | null> = {};

  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
    patch.status = b.status;
  }
  if (b.memo !== undefined) patch.memo = b.memo ? String(b.memo) : null;
  if (b.soft_deadline !== undefined) {
    if (b.soft_deadline && !DATE_RE.test(b.soft_deadline)) return NextResponse.json({ error: "bad date" }, { status: 400 });
    patch.soft_deadline = b.soft_deadline || null;
  }
  if (b.hidden !== undefined) patch.hidden = !!b.hidden;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const r = await sql`update jobs set ${sql(patch)}, updated_at = now() where id = ${Number(id)}`;
  if (!r.count) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
