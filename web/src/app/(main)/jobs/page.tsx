import JobRow from "@/components/JobRow";
import { STATUSES, type Job } from "@/lib/db";
import { todayKST } from "@/lib/date";
import { listJobs } from "@/lib/queries";
import { isGuest, maskForGuest } from "@/lib/role";

export const dynamic = "force-dynamic";

type SP = { fit?: string; status?: string; source?: string; q?: string; hidden?: string; past?: string; on?: string };

export default async function Jobs({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = todayKST();
  const guest = await isGuest();
  let jobs: Job[] = await listJobs({
    fit: sp.fit, status: guest ? undefined : sp.status, source: sp.source, q: sp.q?.trim() || undefined,
    hidden: sp.hidden === "1", past: sp.past === "1" || !!sp.on,
  });
  if (guest) jobs = jobs.map(maskForGuest);
  if (sp.on) jobs = jobs.filter((j) => j.deadline === sp.on || j.soft_deadline === sp.on);

  return (
    <>
      <div>
        <h1 className="page-title">공고</h1>
        <p className="page-sub">{sp.on ? `${sp.on} 일정 · ` : ""}{jobs.length}건 · 마감 빠른 순</p>
      </div>
      <section className="panel">
        {/* GET 폼이라 자바스크립트 없이도 필터가 동작한다 */}
        <form className="filters" method="get">
          <input type="search" name="q" placeholder="회사·직무 검색" defaultValue={sp.q} />
          <select name="fit" defaultValue={sp.fit ?? ""} aria-label="적합도">
            <option value="">적합도 전체</option>
            <option>상</option><option>중</option><option>하</option><option>미채점</option>
          </select>
          {!guest && (
            <select name="status" defaultValue={sp.status ?? ""} aria-label="상태">
              <option value="">상태 전체</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          <select name="source" defaultValue={sp.source ?? ""} aria-label="출처">
            <option value="">출처 전체</option>
            <option value="wanted">원티드</option>
            <option value="jumpit">점핏</option>
            <option value="local">로컬</option>
          </select>
          <label><input type="checkbox" name="past" value="1" defaultChecked={sp.past === "1"} /> 지난 공고</label>
          <label><input type="checkbox" name="hidden" value="1" defaultChecked={sp.hidden === "1"} /> 숨긴 공고</label>
          <button className="btn">적용</button>
        </form>
        {jobs.length ? (
          <div className="rows" style={{ marginTop: -1 }}>{jobs.map((j) => <JobRow key={j.id} job={j} today={today} />)}</div>
        ) : (
          <p className="empty">조건에 맞는 공고가 없어요.</p>
        )}
      </section>
    </>
  );
}
