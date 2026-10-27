import postgres from "postgres";

// Supabase pooler(트랜잭션 모드)라 prepared statement를 끈다.
const g = globalThis as unknown as { sql?: postgres.Sql };
export const sql =
  g.sql ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 3, idle_timeout: 20 });
if (process.env.NODE_ENV !== "production") g.sql = sql;

export type FitLevel = "상" | "중" | "하";
import type { Status } from "./constants";
export { STATUSES, type Status } from "./constants";

export type Job = {
  id: number;
  source: "wanted" | "jumpit" | "local"; // local = jasoseo-project/applications에서 불러온 공고
  source_id: string;
  url: string;
  company: string;
  title: string;
  location: string | null;
  employment: string | null;
  deadline: string | null; // YYYY-MM-DD
  deadline_time: string | null;
  always_open: boolean;
  main_tasks: string | null;
  requirements: string | null;
  preferred: string | null;
  tech_stacks: string[] | null;
  is_data_role: number | null;
  newcomer_ok: number | null;
  needs_masters: number | null;
  fit_level: FitLevel | null;
  fit_score: number | null;
  fit_confidence: number | null;
  fit_probs: Record<string, number> | null;
  scored_at: string | null;
  report: string | null;
  report_status: "없음" | "대기" | "완료" | "실패" | "생략";
  status: Status;
  soft_deadline: string | null;
  memo: string | null;
  hidden: boolean;
  created_at: string;
  updated_at: string;
};

export type Settings = {
  interval_days: number;
  last_collect_at: string | null;
  profile: string;
  min_data_role: number;
  report_levels: FitLevel[];
};

export async function getSettings(): Promise<Settings> {
  const [s] = await sql<Settings[]>`
    select interval_days, last_collect_at, profile, min_data_role, report_levels
    from settings where id = 1`;
  return s;
}

// date 컬럼을 JS Date로 바꾸지 않고 문자열로 받기 위한 공통 select
export const JOB_COLS = sql`
  id, source, source_id, url, company, title, location, employment,
  to_char(deadline, 'YYYY-MM-DD') as deadline, deadline_time, always_open,
  main_tasks, requirements, preferred, tech_stacks,
  is_data_role, newcomer_ok, needs_masters, fit_level, fit_score, fit_confidence, fit_probs, scored_at,
  report, report_status, status, to_char(soft_deadline, 'YYYY-MM-DD') as soft_deadline,
  memo, hidden, created_at, updated_at`;
