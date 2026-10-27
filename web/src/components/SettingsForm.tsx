"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FitLevel, Settings } from "@/lib/db";

const LEVELS: FitLevel[] = ["상", "중", "하"];

export default function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [interval, setInterval] = useState(initial.interval_days);
  const [levels, setLevels] = useState<FitLevel[]>(initial.report_levels);
  const [minRole, setMinRole] = useState(initial.min_data_role);
  const [profile, setProfile] = useState(initial.profile);
  const [rescore, setRescore] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("저장 중…");
    const r = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval_days: interval, report_levels: levels, min_data_role: minRole, profile, rescore }),
    });
    setMsg(r.ok ? (rescore ? "저장됨 · 다음 실행부터 전체 다시 채점" : "저장됨") : (await r.json().catch(() => ({}))).error ?? "저장 실패");
    if (r.ok) {
      setRescore(false);
      router.refresh();
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>수집 주기</span>
        <div className="inline">
          <select value={interval} onChange={(e) => setInterval(Number(e.target.value))} style={{ width: "auto" }}>
            {[1, 2, 3, 5, 7, 14].map((n) => <option key={n} value={n}>{n === 1 ? "매일" : `${n}일마다`}</option>)}
          </select>
          <span className="muted">매일 오전 7시에 확인해서 주기가 됐으면 수집</span>
        </div>
      </label>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <span>리포트 만들 적합도</span>
        <div className="inline">
          {LEVELS.map((l) => (
            <label key={l}>
              <input
                type="checkbox"
                checked={levels.includes(l)}
                onChange={(e) => setLevels(e.target.checked ? [...levels, l] : levels.filter((x) => x !== l))}
              />
              <span className={`chip fit-${l}`}>{l}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>데이터 직무 기준 (이보다 낮으면 숨김): {Math.round(minRole * 100)}%</span>
        <input type="range" min={0} max={1} step={0.05} value={minRole} onChange={(e) => setMinRole(Number(e.target.value))} />
      </label>
      <label className="field">
        <span>내 경험 요약 (Jev 채점·리포트에 쓰임)</span>
        <textarea value={profile} onChange={(e) => setProfile(e.target.value)} style={{ minHeight: 260 }} />
      </label>
      <label className="inline" style={{ fontSize: 13 }}>
        <input type="checkbox" checked={rescore} onChange={(e) => setRescore(e.target.checked)} />
        저장하면서 모든 공고를 다시 채점 (경험 요약을 크게 바꿨을 때)
      </label>
      <div className="inline">
        <button className="btn primary">저장</button>
        <span className="saved" aria-live="polite">{msg}</span>
      </div>
    </form>
  );
}
