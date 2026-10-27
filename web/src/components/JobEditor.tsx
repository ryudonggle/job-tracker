"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUSES } from "@/lib/constants";
import type { Job } from "@/lib/db";

/** 상세 오른쪽: 상태·권장 제출일·메모·숨기기. 바꾸면 바로 저장. */
export default function JobEditor({ job, readOnly = false }: { job: Job; readOnly?: boolean }) {
  const router = useRouter();
  const [memo, setMemo] = useState(job.memo ?? "");
  const [msg, setMsg] = useState("");

  async function save(patch: Record<string, unknown>) {
    setMsg("저장 중…");
    const r = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setMsg(r.ok ? "저장됨" : "저장 실패");
    if (r.ok) router.refresh();
  }

  if (readOnly)
    return (
      <div className="side">
        <div className="field"><span>상태</span><div>{job.status}</div></div>
        <div className="field"><span>권장 제출일</span><div>{job.soft_deadline ?? "–"}</div></div>
        {job.memo && <div className="field"><span>메모</span><div className="pre">{job.memo}</div></div>}
      </div>
    );

  return (
    <div className="side">
      <label className="field">
        <span>상태</span>
        <select defaultValue={job.status} onChange={(e) => save({ status: e.target.value })}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label className="field">
        <span>권장 제출일 (달력에 점선으로 표시)</span>
        <input
          type="date"
          defaultValue={job.soft_deadline ?? ""}
          max={job.deadline ?? undefined}
          onChange={(e) => save({ soft_deadline: e.target.value || null })}
        />
      </label>
      <label className="field">
        <span>메모</span>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={() => memo !== (job.memo ?? "") && save({ memo })}
          placeholder="지원 준비, 확인할 것…"
        />
      </label>
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <span className="saved" aria-live="polite">{msg}</span>
        <button className="btn" onClick={() => save({ hidden: !job.hidden })}>{job.hidden ? "다시 보이기" : "숨기기"}</button>
      </div>
    </div>
  );
}
