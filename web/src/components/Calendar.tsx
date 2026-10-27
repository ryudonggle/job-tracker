import Link from "next/link";
import type { Job } from "@/lib/db";
import { addDays } from "@/lib/date";

const DOWS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_PER_CELL = 4;

/** 한 달 달력. 마감일은 적합도 색으로 칠하고, 권장 제출일은 점선 테두리. */
export default function Calendar({ month, jobs, today }: { month: string; jobs: Job[]; today: string }) {
  const first = `${month}-01`;
  const start = addDays(first, -new Date(`${first}T00:00:00Z`).getUTCDay());
  const nextMonth = addDays(first, 32).slice(0, 7);
  const end = addDays(`${nextMonth}-01`, -1);
  const weeks = Math.ceil((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400e3 / 7 + 1 / 7);

  const byDay = new Map<string, { job: Job; soft: boolean }[]>();
  const push = (d: string | null, job: Job, soft: boolean) => {
    if (!d) return;
    byDay.set(d, [...(byDay.get(d) ?? []), { job, soft }]);
  };
  for (const j of jobs) {
    push(j.deadline, j, false);
    if (j.soft_deadline && j.soft_deadline !== j.deadline) push(j.soft_deadline, j, true);
  }

  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  return (
    <div className="cal-scroll">
      <div className="cal" role="grid">
        {DOWS.map((d) => <div key={d} className="dow">{d}</div>)}
        {days.map((d) => {
          const evs = (byDay.get(d) ?? []).sort((a, b) => Number(a.soft) - Number(b.soft));
          const cls = ["cell", d.slice(0, 7) !== month && "out", d === today && "today"].filter(Boolean).join(" ");
          return (
            <div key={d} className={cls} role="gridcell">
              <span className="d">{Number(d.slice(8))}</span>
              {evs.slice(0, MAX_PER_CELL).map(({ job, soft }) => (
                <Link
                  key={`${job.id}${soft ? "s" : ""}`}
                  href={`/jobs/${job.id}`}
                  className={`ev ${job.fit_level ? `fit-${job.fit_level}` : "fit-none"}${soft ? " soft" : ""}`}
                  title={`${soft ? "제출 권장 · " : "마감 · "}${job.company} ${job.title}`}
                >
                  {soft ? "✎ " : ""}{job.company}
                </Link>
              ))}
              {evs.length > MAX_PER_CELL && (
                <Link href={`/jobs?on=${d}`} className="muted" style={{ fontSize: 12 }}>+{evs.length - MAX_PER_CELL}개 더</Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
