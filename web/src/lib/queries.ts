import { JOB_COLS, sql, type Job } from "./db";
import { addDays, todayKST } from "./date";

const ACTIVE = sql`not hidden and status not in ('탈락', '패스')`;

/** 오늘부터 7일 안에 마감 */
export async function weekJobs() {
  const t = todayKST();
  return sql<Job[]>`
    select ${JOB_COLS} from jobs
    where ${ACTIVE} and deadline between ${t} and ${addDays(t, 6)}
    order by deadline, fit_score desc nulls last`;
}

/** 달력용: 마감일 또는 권장 제출일이 범위 안 */
export async function rangeJobs(from: string, to: string) {
  return sql<Job[]>`
    select ${JOB_COLS} from jobs
    where not hidden and (deadline between ${from} and ${to} or soft_deadline between ${from} and ${to})
    order by fit_score desc nulls last`;
}

export async function summary() {
  const t = todayKST();
  const [r] = await sql<{ week: number; top: number; planned: number; fresh: number }[]>`
    select
      count(*) filter (where deadline between ${t} and ${addDays(t, 6)})::int as week,
      count(*) filter (where fit_level = '상' and (deadline >= ${t} or deadline is null))::int as top,
      count(*) filter (where status = '지원 예정')::int as planned,
      count(*) filter (where created_at > now() - interval '7 days')::int as fresh
    from jobs where ${ACTIVE}`;
  return r;
}

export type JobFilter = { fit?: string; status?: string; source?: string; q?: string; hidden?: boolean; past?: boolean };

export async function listJobs(f: JobFilter) {
  const t = todayKST();
  const like = f.q ? `%${f.q}%` : null;
  return sql<Job[]>`
    select ${JOB_COLS} from jobs
    where true
      ${f.hidden ? sql`` : sql`and not hidden`}
      ${f.past ? sql`` : sql`and (deadline is null or deadline >= ${t})`}
      ${f.fit ? (f.fit === "미채점" ? sql`and fit_level is null` : sql`and fit_level = ${f.fit}`) : sql``}
      ${f.status ? sql`and status = ${f.status}` : sql``}
      ${f.source ? sql`and source = ${f.source}` : sql``}
      ${like ? sql`and (company ilike ${like} or title ilike ${like})` : sql``}
    order by deadline nulls last, fit_score desc nulls last
    limit 300`;
}

export async function getJob(id: number) {
  const [j] = await sql<Job[]>`select ${JOB_COLS} from jobs where id = ${id}`;
  return j ?? null;
}

export type Run = {
  id: number; kind: string; started_at: string; finished_at: string | null;
  found: number | null; inserted: number | null; scored: number | null; reported: number | null; error: string | null;
};

export async function recentRuns() {
  return sql<Run[]>`select id, kind, started_at, finished_at, found, inserted, scored, reported, error from runs order by id desc limit 15`;
}
