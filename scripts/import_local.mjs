#!/usr/bin/env node
// jasoseo-project/applications/<폴더>/00-input/job-posting.md → job-tracker DB (source='local')
//
//   node scripts/import_local.mjs --dry-run  # 쓰지 않고 무엇을 넣을지만 출력
//   node scripts/import_local.mjs            # 넣기 (다시 실행하면 공고 내용만 갱신, 상태·메모·권장 제출일은 유지)
//
// - 넣는 대상: 마감 안 지남(또는 상시) + 로컬 적합도 메모가 최상·상·중상·중
// - 로컬 적합도를 그대로 쓰므로 Jev 채점·리포트는 돌리지 않음(scored_at·needs_masters를 채워 둠)
// - 같은 원문 URL이 이미 DB에 있으면(원티드·점핏 자동 수집분) 건너뜀

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = path.resolve(ROOT, "../jasoseo-project/applications");
const postgres = createRequire(path.join(ROOT, "web/package.json"))("postgres");
const DRY = process.argv.includes("--dry-run");

const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString();
const today = kst().slice(0, 10);

// 로컬 6단계 → 앱 3단계 + 정렬용 점수
const FIT = { 최상: ["상", 2.0], 상: ["상", 1.8], 중상: ["중", 1.3], 중: ["중", 1.0] };

// 파싱이 안 되거나 통합정리·메일로 확인한 정보로 바로잡는 값 (폴더명 → { fit, deadline, time, status, memo, always, skip, ... })
// 개인 지원 현황이라 저장소에는 없고 scripts/overrides.local.mjs(.gitignore)에서 읽는다. 없으면 빈 값.
const OVERRIDES = await import("./overrides.local.mjs").then((m) => m.default).catch(() => ({}));

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const pad = (n) => String(n).padStart(2, "0");

/** "2026-10-23", "2026.10.16", "2026년 10월 19일", "10/23" → 마지막 날짜 + 그 뒤 시각 */
function lastDate(s) {
  const re = /(?:(20\d\d)\s*[-.년]\s*)?(\d{1,2})\s*[-./월]\s*(\d{1,2})(?!\d)\s*일?(?:\s*\([^)]*\))?(?:\s*(\d{1,2}):(\d{2}))?/g;
  let found = null;
  for (const m of s.matchAll(re)) {
    const mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    found = { date: `${m[1] ?? "2026"}-${pad(mo)}-${pad(d)}`, time: m[4] ? `${pad(m[4])}:${m[5]}` : null };
  }
  return found;
}

function parseDeadline(text) {
  const lines = text.split("\n");
  const labelRe = /^\s*(?:[-|]\s*)?\**\s*(?:서류\s*)?(?:접수\s*)?마감|^\s*[-|]\s*(?:서류\s*)?접수(?:기간)?\s*[:|]/;
  for (const line of lines) {
    if (!labelRe.test(line) || /추천/.test(line)) continue;
    const bold = [...line.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]).join(" ");
    const seg = bold || line;
    const d = lastDate(seg) ?? lastDate(line);
    if (d) return { ...d, always: false };
    if (/상시|채용\s*시|미기재|확인\s*필요|날짜\s*없음/.test(line)) return { date: null, time: null, always: true };
  }
  return null;
}

function parsePosting(folder) {
  const file = path.join(APPS, folder, "00-input/job-posting.md");
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const heading = (text.match(/^#\s+(.+)$/m)?.[1] ?? folder).trim();
  const [company, ...rest] = heading.includes(" — ") ? heading.split(" — ") : [folder.split("-")[0], heading];
  const url = text.match(/https?:\/\/[^\s)>\]]+/)?.[0] ?? "";

  // 적합도 메모 섹션
  const fitIdx = text.search(/^#{2,3}\s*적합도/m);
  const fitText = fitIdx >= 0 ? text.slice(fitIdx).replace(/^#{2,3}[^\n]*\n/, "").split(/\n#{1,2}\s/)[0].trim() : "";
  const fitRaw = fitText.match(/최상|중상|중하|상|중|하/)?.[0] ?? null;
  const body = (fitIdx >= 0 ? text.slice(0, fitIdx) : text).replace(/^#\s+.+\n/, "").trim();

  return { folder, company: company.trim(), title: rest.join(" — ").trim() || heading, url, fitRaw, fitText, body, dl: parseDeadline(text) };
}

const env = loadEnv();
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });

try {
  const folders = fs.readdirSync(APPS, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_")).map((d) => d.name);
  const known = new Set((await sql`select url from jobs where source <> 'local'`).map((r) => r.url));

  const picked = [], dropped = [], dupUrls = [];
  for (const folder of folders) {
    const p = parsePosting(folder);
    if (!p) { dropped.push([folder, "공고 파일 없음"]); continue; }
    const o = OVERRIDES[folder] ?? {};
    if (o.skip) { dropped.push([folder, o.skip]); continue; }

    const fitRaw = o.fit ?? p.fitRaw;
    const deadline = o.always ? null : o.deadline ?? p.dl?.date ?? null;
    const time = o.deadline ? o.time ?? null : p.dl?.time ?? null;
    const always = !deadline && (o.always || (p.dl?.always ?? false));

    if (!FIT[fitRaw]) { dropped.push([folder, `적합도 ${fitRaw ?? "없음"}`]); continue; }
    if (deadline && deadline < today) { dropped.push([folder, `마감 ${deadline}`]); continue; }
    if (!deadline && !always) { dropped.push([folder, "마감일 못 찾음"]); continue; }
    if (p.url && known.has(p.url)) { dropped.push([folder, "자동 수집분과 중복"]); dupUrls.push(p.url); continue; }

    const [level, score] = FIT[fitRaw];
    picked.push({
      source: "local", source_id: folder, url: p.url, company: o.company ?? p.company, title: o.title ?? p.title,
      deadline, deadline_time: time, always_open: always,
      main_tasks: p.body.slice(0, 6000),
      is_data_role: 1, needs_masters: 0, fit_level: level, fit_score: score, fit_confidence: null,
      report: p.fitText ? `**로컬 적합도: ${fitRaw}**\n${p.fitText}` : `**로컬 적합도: ${fitRaw}**`,
      report_status: "완료",
      status: o.status ?? "관심", memo: o.memo ?? null, soft_deadline: o.soft ?? null,
      fitRaw,
    });
  }

  picked.sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  for (const j of picked) console.log(`+ ${j.deadline ?? "상시      "} ${j.deadline_time ?? "     "} ${j.fitRaw.padEnd(2)} ${j.status.padEnd(5)} ${j.company} · ${j.title}`);
  console.log(`\n넣을 공고 ${picked.length}건 / 제외 ${dropped.length}건`);
  const why = {};
  for (const [, r] of dropped) { const k = r.replace(/\d{4}-\d\d-\d\d/, "지남"); why[k] = (why[k] ?? 0) + 1; }
  console.log("제외 사유:", why);
  if (process.argv.includes("-v")) for (const [f, r] of dropped) console.log(`- ${f}: ${r}`);

  if (!DRY) {
    for (const { fitRaw, ...j } of picked) {
      await sql`
        insert into jobs ${sql(j)}
        on conflict (source, source_id) do update set
          url = excluded.url, company = excluded.company, title = excluded.title,
          deadline = excluded.deadline, deadline_time = excluded.deadline_time, always_open = excluded.always_open,
          main_tasks = excluded.main_tasks, fit_level = excluded.fit_level, fit_score = excluded.fit_score,
          report = excluded.report, updated_at = now(), local_synced_at = now()`;
    }
    // 자동 수집분 중 '데이터 직무 아님'으로 숨겨졌지만 로컬에서 중 이상으로 본 공고는 다시 보이게 (석사 필수는 그대로 숨김)
    const shown = await sql`
      update jobs set hidden = false, updated_at = now()
      where url = any(${dupUrls}) and hidden and coalesce(needs_masters, 0) < 0.5
      returning company, title`;
    for (const r of shown) console.log(`숨김 해제: ${r.company} · ${r.title}`);
    // 로컬에서 온 공고라 sync_local이 다시 쓰지 않도록 표시
    await sql`update jobs set scored_at = coalesce(scored_at, now()), local_synced_at = now() where source = 'local'`;
    console.log("DB 반영 완료");
  }
} finally {
  await sql.end();
}
