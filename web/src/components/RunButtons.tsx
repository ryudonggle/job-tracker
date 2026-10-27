"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run(collect: boolean) {
    setBusy(true);
    setMsg(collect ? "수집부터 하는 중… (최대 5분)" : "채점·리포트 처리 중…");
    try {
      const r = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collect }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const c = d.collected;
      const p = d.processed;
      setMsg(`${c ? `새 공고 ${c.inserted}건 (후보 ${c.found}) · ` : ""}채점 ${p.scored}건 · 리포트 ${p.reported}건`);
    } catch (e) {
      setMsg(`실패: ${e instanceof Error ? e.message : e}`);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="form">
      <div className="inline">
        <button className="btn primary" disabled={busy} onClick={() => run(true)}>지금 수집</button>
        <button className="btn" disabled={busy} onClick={() => run(false)}>남은 채점·리포트만</button>
      </div>
      <span className="saved" aria-live="polite">{msg}</span>
    </div>
  );
}
