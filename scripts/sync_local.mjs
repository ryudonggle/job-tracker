#!/usr/bin/env node
// job-tracker DB → jasoseo-project/applications/<회사>-<직무>/00-input/ 로컬 저장
//
//   node scripts/sync_local.mjs            # 바뀐 공고만 (상·중 + 상태를 바꾼 공고)
//   node scripts/sync_local.mjs --dry-run  # 쓰지 않고 무엇을 할지만 출력
//   node scripts/sync_local.mjs --levels 상,중,하 --all
//
// - 새 공고: 폴더를 만들고 job-posting.md + fit-report.md 작성
// - 이미 있는 폴더(같은 원문 URL이 job-posting.md에 있거나 같은 폴더 이름): job-posting.md는 건드리지 않고 fit-report.md만 갱신
// - fit-report.md는 자동 생성 파일이라 동기화 때마다 덮어씀
// - 숨긴 공고(데이터 직무 아님·석사 필수)와 마감 지난 공고는 새로 만들지 않음

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = path.resolve(ROOT, "../jasoseo-project/applications");
const APP_URL = "https://job-tracker-six-vert.vercel.app";
const postgres = createRequire(path.join(ROOT, "web/package.json"))("postgres");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const ALL = args.includes("--all");
const li = args.indexOf("--levels");
const LEVELS = li >= 0 ? args[li + 1].split(",") : ["상", "중"];

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString();
const today = kst().slice(0, 10);
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDate = (d) => (d ? `${d}(${DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]})` : "상시");
const pct = (v) => (v == null ? "–" : `${Math.round(v * 100)}%`);
const SOURCE = { wanted: "원티드", jumpit: "점핏", local: "로컬" };

/** 기존 폴더 이름 규칙에 맞춘 이름: 공백·괄호·특수문자 제거, 단어는 '-'로 */
function slug(s) {
  return s
    .replace(/\(([^)]*)\)/g, "") // 회사 영문 병기 "(Class101)" 제거
    .replace(/[[\]{}<>/\\|·,&:;!?"'`~@#$%^*+=]/g, "-")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
const folderName = (j) => `${slug(j.company)}-${slug(j.title)}`.slice(0, 80).replace(/-$/, "");

// 기존 applications/<폴더>/00-input/job-posting.md 안의 원문 URL → 폴더
function indexExisting() {
  const byUrl = new Map();
  for (const dir of fs.readdirSync(APPS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const f = path.join(APPS, dir.name, "00-input/job-posting.md");
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, "utf8");
    for (const m of text.matchAll(/https:\/\/(?:www\.wanted\.co\.kr\/wd|jumpit\.saramin\.co\.kr\/position)\/\d+/g)) {
      byUrl.set(m[0], dir.name);
    }
  }
  return byUrl;
}

const section = (title, body) => (body?.trim() ? `\n## ${title}\n\n${body.trim()}\n` : "");

function postingMd(j) {
  return `# ${j.company} — ${j.title}

> 출처: ${j.url} (${SOURCE[j.source]}, ${kst(j.created_at).slice(0, 10)} 수집 · job-tracker 자동 저장)

- 마감: **${fmtDate(j.deadline)}${j.deadline_time ? ` ${j.deadline_time}` : ""}**
- 근무지: ${j.location ?? "–"}
- 기술 스택: ${j.tech_stacks?.length ? j.tech_stacks.join(", ") : "–"}
- 적합도: ${j.fit_level ?? "채점 전"}${j.fit_score != null ? ` (Jev ${j.fit_score.toFixed(2)}/2)` : ""} — 리포트는 \`fit-report.md\`
${section("주요 업무", j.main_tasks)}${section("자격 요건", j.requirements)}${section("우대 사항", j.preferred)}`;
}

function reportMd(j) {
  const p = j.fit_probs ?? {};
  return `# 적합도 리포트 — ${j.company} ${j.title}

> job-tracker 자동 생성 (${kst().slice(0, 16).replace("T", " ")} 동기화). **다음 동기화 때 덮어쓰니** 메모는 앱에서 남기세요.
> 앱: ${APP_URL}/jobs/${j.id} · 원문: ${j.url}

- 적합도: **${j.fit_level ?? "채점 전"}**${j.fit_score != null ? ` — Jev ${j.fit_score.toFixed(2)}/2 (상 ${pct(p["2"])} · 중 ${pct(p["1"])} · 하 ${pct(p["0"])})` : ""}
- 데이터 직무 ${pct(j.is_data_role)} · 신입 지원 가능 ${pct(j.newcomer_ok)}
- 마감: ${fmtDate(j.deadline)}${j.deadline_time ? ` ${j.deadline_time}` : ""}${j.soft_deadline ? ` · 권장 제출일 ${fmtDate(j.soft_deadline)}` : ""}
- 상태: ${j.status}${j.memo ? `\n- 메모: ${j.memo.replace(/\n/g, " ")}` : ""}

## 리포트

${j.report?.trim() || "(아직 리포트 없음)"}
`;
}

const env = loadEnv();
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });

try {
  const COLS = sql`
    id, source, url, company, title, location, to_char(deadline, 'YYYY-MM-DD') deadline, deadline_time,
      main_tasks, requirements, preferred, tech_stacks, fit_level, fit_score, fit_probs, is_data_role, newcomer_ok,
      report, status, to_char(soft_deadline, 'YYYY-MM-DD') soft_deadline, memo, created_at`;
  const jobs = await sql`
    select ${COLS} from jobs
    where not hidden and source <> 'local'
      and (fit_level = any(${LEVELS}) or status <> '관심')
      ${ALL ? sql`` : sql`and (local_synced_at is null or updated_at > local_synced_at)`}
    order by id`;

  const byUrl = indexExisting();
  const done = [];
  let created = 0, updated = 0, skipped = 0;

  // 폴더별로 묶는다 (기존 폴더 하나에 공고 여러 개가 정리돼 있는 경우가 있음)
  const groups = new Map(); // folder → { existing, jobs }
  for (const j of jobs) {
    const existing = byUrl.get(j.url) ?? (fs.existsSync(path.join(APPS, folderName(j))) ? folderName(j) : null);
    if (!existing && ((j.deadline && j.deadline < today) || j.status === "패스" || j.status === "탈락")) {
      skipped++;
      continue;
    }
    const folder = existing ?? folderName(j);
    const g = groups.get(folder) ?? { existing: !!existing, jobs: [] };
    g.jobs.push(j);
    groups.set(folder, g);
  }

  for (const [folder, g] of groups) {
    // 같은 폴더에 속한 다른 공고(이번에 안 바뀐 것)도 리포트에 같이 넣어야 덮어써도 안 사라진다
    const urls = [...byUrl].filter(([, f]) => f === folder).map(([u]) => u);
    const others = urls.length
      ? await sql`select ${COLS} from jobs where not hidden and url = any(${urls}) and id <> all(${g.jobs.map((j) => j.id)})`
      : [];
    const all = [...g.jobs, ...others].sort((a, b) => Number(a.id) - Number(b.id));
    const dir = path.join(APPS, folder, "00-input");
    console.log(`${g.existing ? "갱신" : "새로"}  [${g.jobs.map((j) => j.fit_level ?? "-").join(",")}] ${folder}${all.length > 1 ? ` (공고 ${all.length}건)` : ""}`);
    if (!DRY) {
      fs.mkdirSync(dir, { recursive: true });
      if (!g.existing) fs.writeFileSync(path.join(dir, "job-posting.md"), postingMd(g.jobs[0]));
      fs.writeFileSync(path.join(dir, "fit-report.md"), all.map(reportMd).join("\n---\n\n"));
    }
    g.existing ? updated++ : created++;
    done.push(...g.jobs.map((j) => j.id));
  }

  // updated_at은 건드리지 않고 동기화 시각만 기록
  if (!DRY && done.length) await sql`update jobs set local_synced_at = now() where id = any(${done})`;
  console.log(`\n${DRY ? "(dry-run) " : ""}새 폴더 ${created} · 리포트 갱신 ${updated} · 건너뜀(마감·패스) ${skipped} — ${kst().slice(0, 16)}`);
} finally {
  await sql.end();
}
