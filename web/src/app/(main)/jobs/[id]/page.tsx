import Link from "next/link";
import { notFound } from "next/navigation";
import JobEditor from "@/components/JobEditor";
import { FitChip, MiniMarkdown, SOURCE_LABEL } from "@/components/bits";
import { dday, fmtDate, todayKST } from "@/lib/date";
import { getJob } from "@/lib/queries";
import { currentRole, maskForGuest } from "@/lib/role";

export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

const REPORT_NOTE: Record<string, string> = {
  없음: "아직 채점 전이라 리포트가 없어요.",
  대기: "다음 실행 때 리포트를 만들어요.",
  실패: "리포트 생성에 실패했어요. 설정에서 다시 실행해 보세요.",
  생략: "적합도가 리포트 대상이 아니거나 데이터 직무가 아니라서 생략했어요.",
};

/** 로컬 리포트 "**로컬 적합도: 상**\n상 — 내용" 에서 위 칩과 겹치는 등급 표기를 걷어 낸다 */
function localReport(report: string, level: string | null) {
  const m = report.match(/^\*\*로컬 적합도:\s*([^*]+)\*\*\n?([\s\S]*)$/);
  if (!m) return { raw: null, body: report };
  const raw = m[1].trim();
  const body = m[2].replace(new RegExp(`^${raw}\\s*[—–-]\\s*`), "").trim();
  return { raw: raw !== level ? raw : null, body };
}

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getJob(Number(id));
  if (!found) notFound();
  const role = await currentRole();
  const guest = role === "guest";
  const job = guest ? maskForGuest(found) : found;
  const today = todayKST();
  const d = dday(job.deadline, today);
  const local = job.source === "local" && job.report ? localReport(job.report, job.fit_level) : null;

  const sections = [
    [job.source === "local" ? "공고 내용 (로컬 정리본)" : "주요 업무", job.main_tasks],
    ["자격 요건", job.requirements],
    ["우대 사항", job.preferred],
  ] as const;

  return (
    <>
      <Link href="/jobs" className="muted" style={{ fontSize: 13 }}>← 공고 목록</Link>
      <div className="detail-grid" style={guest ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
        <article className="panel">
          <div className="dhead">
            <div style={{ minWidth: 0 }}>
              <div className="co">{job.company}</div>
              <h1>{job.title}</h1>
            </div>
            <div className="big-dday">
              <div className={`n${d.urgent ? " urgent" : ""}`}>{d.label}</div>
              <div className="when">{job.always_open ? "상시 채용" : `${fmtDate(job.deadline)}${job.deadline_time ? ` ${job.deadline_time}` : ""} 마감`}</div>
            </div>
          </div>

          <dl className="props">
            <dt>적합도</dt>
            <dd>
              <FitChip level={job.fit_level} />
              {job.fit_score !== null && job.source !== "local" && (
                <span className="scorebar" title="Jev 점수 0(하)~2(상)">
                  <span className="bar"><i style={{ width: `${(job.fit_score / 2) * 100}%` }} /></span>
                  <span className="mono muted">{job.fit_score.toFixed(2)}/2</span>
                </span>
              )}
            </dd>
            {!guest && (<><dt>상태</dt><dd><span className="chip status">{job.status}</span></dd></>)}
            {job.soft_deadline && (<><dt>권장 제출일</dt><dd>{fmtDate(job.soft_deadline)}</dd></>)}
            {job.source === "local" ? (
              <><dt>로컬 폴더</dt><dd className="muted" style={{ fontSize: 12.5 }}>applications/{job.source_id}</dd></>
            ) : (
              <>
                <dt>신입 지원</dt>
                <dd>{job.newcomer_ok === null ? "–" : `${pct(job.newcomer_ok)} 가능해 보임`}</dd>
                <dt>데이터 직무</dt>
                <dd>{pct(job.is_data_role)}</dd>
              </>
            )}
            {job.needs_masters !== null && job.needs_masters >= 0.5 && (
              <><dt>학력</dt><dd><span className="chip fit-하">석사 이상 필수 · 숨김</span></dd></>
            )}
            {job.location && (<><dt>위치</dt><dd>{job.location}</dd></>)}
            {!!job.tech_stacks?.length && (
              <><dt>기술 스택</dt><dd>{job.tech_stacks.map((t) => <span key={t} className="chip plain">{t}</span>)}</dd></>
            )}
            {job.url && (
              <>
                <dt>원문</dt>
                <dd><a href={job.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{job.source === "local" ? "원문 링크" : `${SOURCE_LABEL[job.source]}에서`} 보기 ↗</a></dd>
              </>
            )}
          </dl>

          <section className="sec">
            <h2>{local ? "적합도 메모" : "적합도 리포트"}</h2>
            {local ? (
              <>
                {local.raw && <p className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>원래 평가: {local.raw}</p>}
                {local.body ? <p className="report-body">{local.body}</p> : <p className="muted">메모가 없어요.</p>}
              </>
            ) : job.report ? <MiniMarkdown text={job.report} /> : <p className="muted">{REPORT_NOTE[job.report_status] ?? ""}</p>}
          </section>

          {sections.map(([title, body]) =>
            body ? (
              <section key={title} className="sec">
                <h2>{title}</h2>
                {job.source === "local" ? <MiniMarkdown text={body} /> : <div className="pre">{body}</div>}
              </section>
            ) : null,
          )}
        </article>

        {!guest && (
          <aside className="panel" style={{ position: "sticky", top: 70 }}>
            <JobEditor job={job} readOnly={role !== "admin"} />
          </aside>
        )}
      </div>
    </>
  );
}
