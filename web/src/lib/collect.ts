import { sql } from "./db";

const UA = "Mozilla/5.0 (job-tracker personal)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 제목 1차 필터: 데이터 관련으로 보이면 일단 수집 (최종 판단은 Jev is_data_role)
const TITLE_RE = /데이터|data|분석|analy|애널리|\bBI\b|ETL|DW|통계|머신러닝|\bML\b|\bAI\b|인공지능|빅데이터|사이언/i;
// 신입이 지원하기 어려운 제목
const EXCLUDE_RE = /경력\s*\d|시니어|senior|lead|리드|팀장|principal|staff\b|\d+\s*년\s*이상/i;

type Candidate = {
  source: "wanted" | "jumpit";
  source_id: string;
  company: string;
  title: string;
};

type Detail = {
  url: string;
  location: string | null;
  employment: string | null;
  deadline: string | null;
  deadline_time: string | null;
  always_open: boolean;
  main_tasks: string | null;
  requirements: string | null;
  preferred: string | null;
  tech_stacks: string[];
};

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST

const WANTED_TAGS = [655, 656, 1024, 1634];

async function listWanted(): Promise<Candidate[]> {
  const out = new Map<string, Candidate>();
  for (const tag of WANTED_TAGS) {
    for (let offset = 0; offset < 300; offset += 100) {
      const d = await getJson(
        `https://www.wanted.co.kr/api/v4/jobs?country=kr&tag_type_ids=${tag}&job_sort=job.latest_order&years=0&locations=all&limit=100&offset=${offset}`,
      );
      for (const j of d.data ?? []) {
        out.set(String(j.id), {
          source: "wanted",
          source_id: String(j.id),
          company: j.company?.name ?? "",
          title: j.position ?? "",
        });
      }
      await sleep(1000);
      if (!d.links?.next) break;
    }
  }
  return [...out.values()];
}

async function detailWanted(id: string): Promise<Detail | null> {
  const { job: j } = await getJson(`https://www.wanted.co.kr/api/v4/jobs/${id}`);
  if (!j || j.status !== "active") return null;
  const a = j.address ?? {};
  return {
    url: `https://www.wanted.co.kr/wd/${id}`,
    location: [a.location, a.district].filter(Boolean).join(" ") || null,
    employment: null,
    deadline: j.due_time ?? null,
    deadline_time: null,
    always_open: !j.due_time,
    main_tasks: j.detail?.main_tasks ?? null,
    requirements: j.detail?.requirements ?? null,
    preferred: j.detail?.preferred_points ?? null,
    tech_stacks: (j.skill_tags ?? []).map((t: { title?: string; text?: string }) => t.title ?? t.text).filter(Boolean),
  };
}

const JUMPIT_KEYWORDS = ["데이터", "데이터 분석", "데이터 엔지니어", "머신러닝"];

async function listJumpit(): Promise<Candidate[]> {
  const out = new Map<string, Candidate>();
  for (const kw of JUMPIT_KEYWORDS) {
    for (let page = 1; page <= 10; page++) {
      const d = await getJson(
        `https://jumpit-api.saramin.co.kr/api/positions?sort=reg_dt&page=${page}&keyword=${encodeURIComponent(kw)}&career=0`,
      );
      const ps = d.result?.positions ?? [];
      for (const p of ps) {
        if (p.newcomer === false && (p.minCareer ?? 0) > 0) continue;
        out.set(String(p.id), {
          source: "jumpit",
          source_id: String(p.id),
          company: p.companyName ?? "",
          title: stripTags(p.title ?? ""),
        });
      }
      await sleep(1000);
      if (ps.length === 0 || page * ps.length >= (d.result?.totalCount ?? 0)) break;
    }
  }
  return [...out.values()];
}

async function detailJumpit(id: string): Promise<Detail | null> {
  const { result: r } = await getJson(`https://jumpit-api.saramin.co.kr/api/position/${id}`);
  if (!r) return null;
  const closed: string | null = r.closedAt ?? null;
  return {
    url: `https://jumpit.saramin.co.kr/position/${id}`,
    location: (r.workingPlaces ?? []).map((w: { address?: string }) => w.address).filter(Boolean).join(", ") || null,
    employment: null,
    deadline: r.alwaysOpen || !closed ? null : closed.slice(0, 10),
    deadline_time: r.alwaysOpen || !closed ? null : closed.slice(11, 16),
    always_open: !!r.alwaysOpen || !closed,
    main_tasks: r.responsibility ?? null,
    requirements: r.qualifications ?? null,
    preferred: r.preferredRequirements ?? null,
    tech_stacks: (r.techStacks ?? []).map((t: { stack?: string } | string) => (typeof t === "string" ? t : t.stack)).filter(Boolean),
  };
}

export type CollectResult = { found: number; inserted: number };

/** 목록 → 제목 필터 → DB에 없는 것만 상세 조회 → insert. maxDetails·untilMs로 실행 시간 제한.
 *  시간이 모자라 못 본 공고는 DB에 없으니 다음 수집 때 다시 후보가 된다. */
export async function collect(maxDetails = 120, untilMs = Date.now() + 170_000): Promise<CollectResult> {
  const lists = await Promise.all([listWanted(), listJumpit()]);
  const cands = lists.flat().filter((c) => TITLE_RE.test(c.title) && !EXCLUDE_RE.test(c.title));

  const existing = new Set(
    (await sql<{ k: string }[]>`select source || ':' || source_id as k from jobs`).map((r) => r.k),
  );
  const fresh = cands.filter((c) => !existing.has(`${c.source}:${c.source_id}`)).slice(0, maxDetails);

  let inserted = 0;
  const t = today();
  for (const c of fresh) {
    if (Date.now() > untilMs) break;
    try {
      const d = c.source === "wanted" ? await detailWanted(c.source_id) : await detailJumpit(c.source_id);
      if (d && !(d.deadline && d.deadline < t)) {
        const r = await sql`
          insert into jobs ${sql({ ...c, ...d })}
          on conflict (source, source_id) do nothing`;
        inserted += r.count;
      }
    } catch (e) {
      console.error("detail failed", c.source, c.source_id, e);
    }
    await sleep(800);
  }
  return { found: cands.length, inserted };
}
