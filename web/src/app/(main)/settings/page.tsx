import RunButtons from "@/components/RunButtons";
import SettingsForm from "@/components/SettingsForm";
import { getSettings, sql } from "@/lib/db";
import { recentRuns } from "@/lib/queries";

export const dynamic = "force-dynamic";

const fmt = (t: string | Date | null) =>
  t ? new Date(t).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

export default async function SettingsPage() {
  const [s, runs, [pending]] = await Promise.all([
    getSettings(),
    recentRuns(),
    sql<{ unscored: number; waiting: number }[]>`
      select count(*) filter (where scored_at is null)::int unscored,
             count(*) filter (where report_status = '대기')::int waiting from jobs`,
  ]);
  const nextAt = s.last_collect_at ? new Date(new Date(s.last_collect_at).getTime() + s.interval_days * 86400e3) : null;

  return (
    <>
      <div>
        <h1 className="page-title">설정</h1>
        <p className="page-sub">
          마지막 수집 {fmt(s.last_collect_at)} · 다음 수집 {nextAt ? `${fmt(nextAt)} 이후 첫 실행` : "다음 실행 때"} · 채점 대기 {pending.unscored}건 · 리포트 대기 {pending.waiting}건
        </p>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-head"><h2>수집·채점</h2></div>
          <SettingsForm initial={s} />
        </section>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section className="panel">
            <div className="panel-head"><h2>수동 실행</h2></div>
            <RunButtons />
          </section>
          <section className="panel">
            <div className="panel-head"><h2>최근 실행</h2></div>
            {runs.length ? (
              <div className="table-scroll">
                <table className="runs">
                  <thead><tr><th>시작</th><th>종류</th><th>결과</th><th>걸린 시간</th></tr></thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id}>
                        <td>{fmt(r.started_at)}</td>
                        <td>{r.kind === "collect" ? "수집" : "채점·리포트"}</td>
                        <td style={{ whiteSpace: "normal" }}>
                          {r.error ? <span className="err">{r.error.slice(0, 120)}</span>
                            : !r.finished_at ? "진행 중"
                            : r.kind === "collect" ? `후보 ${r.found} · 새 ${r.inserted}`
                            : `채점 ${r.scored} · 리포트 ${r.reported}`}
                        </td>
                        <td className="mono">{r.finished_at ? `${Math.round((+new Date(r.finished_at) - +new Date(r.started_at)) / 1000)}초` : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">아직 실행 기록이 없어요.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
