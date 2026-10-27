"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/jobs", label: "공고" },
  { href: "/settings", label: "설정" },
];

export default function Nav({ role }: { role: Role }) {
  const path = usePathname();
  const viewer = role !== "admin";

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  }
  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">공고 트래커</Link>
        <nav className="nav">
          {LINKS.filter((l) => !viewer || l.href !== "/settings").map((l) => {
            const on = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}>{l.label}</Link>;
          })}
          {viewer && <span className="chip fit-none">{role === "guest" ? "둘러보기" : "보기 전용"}</span>}
          <button type="button" className="linkish" onClick={logout}>{viewer ? "로그인" : "로그아웃"}</button>
        </nav>
      </div>
    </header>
  );
}
