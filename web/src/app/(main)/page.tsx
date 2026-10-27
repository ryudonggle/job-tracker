import Link from "next/link";
import Calendar from "@/components/Calendar";
import JobRow from "@/components/JobRow";
import { addDays, todayKST } from "@/lib/date";
import { rangeJobs, summary, weekJobs } from "@/lib/queries";
import { isGuest, maskForGuest } from "@/lib/role";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function Home({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const today = todayKST();
  const { m } = await searchParams;
  const month = m && MONTH_RE.test(m) ? m : today.slice(0, 7);
  const prev = addDays(`${month}-01`, -1).slice(0, 7);
  const next = addDays(`${month}-01`, 32).slice(0, 7);

  const guest = await isGuest();
  const [rawWeek, rawCal, s] = await Promise.all([
    weekJobs(),
    rangeJobs(addDays(`${month}-01`, -7), addDays(`${next}-01`, 7)),
    summary(),
  ]);
  const week = guest ? rawWeek.map(maskForGuest) : rawWeek;
  const cal = guest ? rawCal.map(maskForGuest).filter((j) => j.deadline) : rawCal;

  return (
    <>
      <div>
        <h1 className="page-title">오늘 {Number(today.slice(5, 7))}월 {Number(today.slice(8))}일</h1>
        <p className="page-sub">신입 데이터 분석·엔지니어 공고 일정</p>
      </div>

      <section className="strip" aria-label="요약">
        <div><span className="k">이번 주 마감</span><span className="v">{s.week}</span></div>
        <div><span className="k">적합도 상</span><span className="v">{s.top}</span></div>
        {!guest && <div><span className="k">지원 예정</span><span className="v">{s.planned}</span></div>}
        <div><span className="k">최근 7일 새 공고</span><span className="v">{s.fresh}</span></div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>이번 주 마감</h2>
          <Link href="/jobs" className="muted" style={{ fontSize: 13 }}>전체 공고 →</Link>
        </div>
        {week.length ? (
          <div className="rows">{week.map((j) => <JobRow key={j.id} job={j} today={today} />)}</div>
        ) : (
          <p className="empty">7일 안에 마감하는 공고가 없어요.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</h2>
          <div className="legend">
            <span><i className="sw fit-상" />상</span>
            <span><i className="sw fit-중" />중</span>
            <span><i className="sw fit-하" />하</span>
            {!guest && <span><i className="sw dash" />권장 제출일</span>}
          </div>
          <div className="cal-nav">
            <Link className="btn" href={`/?m=${prev}`} aria-label="이전 달">←</Link>
            <Link className="btn" href="/">이번 달</Link>
            <Link className="btn" href={`/?m=${next}`} aria-label="다음 달">→</Link>
          </div>
        </div>
        <Calendar month={month} jobs={cal} today={today} />
      </section>
    </>
  );
}
