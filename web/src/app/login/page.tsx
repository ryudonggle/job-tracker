"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(body: { password: string } | { guest: true }) {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) location.href = "/";
    else {
      setErr((await r.json().catch(() => ({}))).error ?? "로그인 실패");
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    login({ password: pw });
  }

  return (
    <main className="login">
      <form className="panel" onSubmit={submit}>
        <h1 style={{ fontSize: 18 }}>공고 트래커</h1>
        <label className="field">
          <span>비밀번호</span>
          <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        {err && <p className="err">{err}</p>}
        <button className="btn primary" disabled={busy || !pw}>{busy ? "확인 중…" : "들어가기"}</button>
        <div className="or muted">또는</div>
        <button type="button" className="btn" disabled={busy} onClick={() => login({ guest: true })}>로그인 없이 둘러보기</button>
        <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>둘러보기는 보기 전용이라 수정할 수 없어요</p>
      </form>
    </main>
  );
}
