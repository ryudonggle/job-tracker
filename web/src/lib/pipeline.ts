import { JOB_COLS, getSettings, sql, type Job } from "./db";
import { collect } from "./collect";
import { checkMasters, scoreJob } from "./jev";

// 학사 신입이라 석사 이상 필수 공고는 지원 불가 → 숨김
const MASTERS_CUTOFF = 0.5;

/** 제목만 봐도 석사 필수인 경우 (Jev가 요건 본문에 학위가 없으면 놓침: "전문연구요원(신규/전직)", "(석사 이상)") */
export function titleNeedsMasters(t: string) {
  if (/우대/.test(t)) return false;
  if (/석사\s*이상|석사\s*졸업|석·박사|박사/.test(t)) return true;
  return /전문연구요원/.test(t) && !/가능|포함|신입/.test(t);
}
const mastersScore = (jev: number, title: string) => (titleNeedsMasters(title) ? Math.max(jev, 0.95) : jev);
import { writeReport } from "./report";

/** items를 최대 n개씩 동시에 처리. 시간이 모자라면(stop) 새 작업을 시작하지 않는다. */
async function pool<T>(items: T[], n: number, stop: () => boolean, fn: (item: T) => Promise<void>) {
  let i = 0;
  const worker = async () => {
    while (i < items.length && !stop()) await fn(items[i++]);
  };
  await Promise.all(Array.from({ length: n }, worker));
}

async function logRun<T extends Record<string, unknown>>(kind: string, fn: () => Promise<T>) {
  const [run] = await sql<{ id: number }[]>`insert into runs (kind) values (${kind}) returning id`;
  try {
    const r = await fn();
    await sql`update runs set finished_at = now(), ${sql(r as Record<string, never>)} where id = ${run.id}`;
    return r;
  } catch (e) {
    await sql`update runs set finished_at = now(), error = ${String(e)} where id = ${run.id}`;
    throw e;
  }
}

/** 주기가 됐으면 수집. force면 주기 무시. */
export async function maybeCollect(force = false, untilMs?: number) {
  const s = await getSettings();
  const due =
    force ||
    !s.last_collect_at ||
    Date.now() - new Date(s.last_collect_at).getTime() >= (s.interval_days * 24 - 2) * 3600e3; // 크론 시각 오차 2시간 허용
  if (!due) return null;
  return logRun("collect", async () => {
    const r = await collect(120, untilMs);
    await sql`update settings set last_collect_at = now() where id = 1`;
    return r;
  });
}

/** 미채점 → Jev, 리포트 대상 → OpenAI. 실행 시간 한도(budgetMs) 안에서만 처리. */
export async function processPending(budgetMs = 200_000) {
  const start = Date.now();
  const left = () => budgetMs - (Date.now() - start);
  return logRun("process", async () => {
    const s = await getSettings();
    let scored = 0;
    let reported = 0;

    const unscored = await sql<Job[]>`select ${JOB_COLS} from jobs where scored_at is null order by id limit 80`;
    await pool(unscored, 4, () => left() < 20_000, async (job) => {
      try {
        const r = await scoreJob(s.profile, job);
        r.needs_masters = mastersScore(r.needs_masters, job.title);
        const hide = r.is_data_role < s.min_data_role || r.needs_masters >= MASTERS_CUTOFF;
        const reportStatus = hide || !s.report_levels.includes(r.fit_level) ? "생략" : "대기";
        await sql`
          update jobs set ${sql(r as unknown as Record<string, never>, "fit_level", "fit_score", "fit_confidence", "is_data_role", "newcomer_ok", "needs_masters")},
            fit_probs = ${sql.json(r.fit_probs)}, scored_at = now(),
            report_status = ${reportStatus}, hidden = ${hide}, updated_at = now()
          where id = ${job.id}`;
        scored++;
      } catch (e) {
        console.error("jev failed", job.id, e);
      }
    });

    // 석사 요건 질문이 생기기 전에 채점된 공고 보충
    const unchecked = await sql<Job[]>`select ${JOB_COLS} from jobs where scored_at is not null and needs_masters is null order by id limit 120`;
    await pool(unchecked, 6, () => left() < 30_000, async (job) => {
      try {
        const m = mastersScore(await checkMasters(job), job.title);
        const hide = m >= MASTERS_CUTOFF;
        await sql`
          update jobs set needs_masters = ${m}, updated_at = now(),
            hidden = hidden or ${hide},
            report_status = case when ${hide} and report_status = '대기' then '생략' else report_status end
          where id = ${job.id}`;
      } catch (e) {
        console.error("masters check failed", job.id, e);
      }
    });

    // 제목 규칙은 API 없이 바로 적용 (규칙을 고친 뒤 기존 공고에도 반영되도록 매번 확인)
    const visible = await sql<{ id: number; title: string }[]>`
      select id, title from jobs where not hidden and needs_masters < ${MASTERS_CUTOFF}`;
    const byTitle = visible.filter((j) => titleNeedsMasters(j.title)).map((j) => j.id);
    if (byTitle.length) {
      await sql`
        update jobs set needs_masters = 0.95, hidden = true, updated_at = now(),
          report_status = case when report_status = '대기' then '생략' else report_status end
        where id = any(${byTitle})`;
    }

    const pending = await sql<Job[]>`
      select ${JOB_COLS} from jobs where report_status = '대기'
      order by deadline nulls last, fit_score desc limit 40`;
    await pool(pending, 4, () => left() < 30_000, async (job) => {
      try {
        const report = await writeReport(s.profile, job);
        await sql`update jobs set report = ${report}, report_status = '완료', reported_at = now(), updated_at = now() where id = ${job.id}`;
        reported++;
      } catch (e) {
        console.error("report failed", job.id, e);
        await sql`update jobs set report_status = '실패', updated_at = now() where id = ${job.id}`;
      }
    });
    return { scored, reported };
  });
}
