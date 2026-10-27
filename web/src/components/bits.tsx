import type { Job } from "@/lib/db";
import { dday } from "@/lib/date";

export function FitChip({ level }: { level: Job["fit_level"] }) {
  return <span className={`chip ${level ? `fit-${level}` : "fit-none"}`}>{level ?? "채점 전"}</span>;
}

export function DDay({ deadline, today }: { deadline: string | null; today?: string }) {
  const d = dday(deadline, today);
  return <span className={`dday${d.urgent ? " urgent" : ""}${d.n !== null && d.n < 0 ? " past" : ""}`}>{d.label}</span>;
}

export const SOURCE_LABEL: Record<Job["source"], string> = { wanted: "원티드", jumpit: "점핏", local: "로컬" };

/** 리포트·로컬 정리본용 아주 작은 마크다운: **굵게**, '- ' 목록, '> ' 인용(출처), 링크 */
export function MiniMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let items: string[] = [];
  let lastHead = "";
  const flush = () => {
    if (items.length) blocks.push(<ul key={`u${blocks.length}`}>{items.map((t, i) => <li key={i}>{labeled(t)}</li>)}</ul>);
    items = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(">")) {
      flush();
      blocks.push(<p key={`q${blocks.length}`} className="md-quote">{inline(line.replace(/^>\s*/, ""))}</p>);
      lastHead = "";
      continue;
    }
    // "**맞는 이유** - 내용" 처럼 제목 뒤에 첫 항목이 붙어 오는 경우를 나눈다
    const head = line.match(/^(\*\*[^*]+\*\*)\s*[-–]\s+(.*)$/);
    if (head) {
      // 같은 제목이 줄마다 반복되면 하나의 목록으로 합친다
      if (head[1] !== lastHead) {
        flush();
        blocks.push(<p key={`p${blocks.length}`}>{inline(head[1])}</p>);
        lastHead = head[1];
      }
      items.push(head[2]);
    } else if (/^[-•·]\s+/.test(line)) {
      items.push(line.replace(/^[-•·]\s+/, ""));
    } else if (/^\*\*[^*]+\*\*$/.test(line)) {
      if (line !== lastHead) {
        flush();
        blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
        lastHead = line;
      }
    } else {
      flush();
      blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
      lastHead = "";
    }
  }
  flush();
  return <div className="report-body">{blocks}</div>;
}

// "형태/근무지: 내용" 처럼 짧은 라벨로 시작하는 항목은 라벨만 따로 보여 준다
function labeled(s: string): React.ReactNode {
  const m = s.match(/^([^:：*]{2,12})[:：]\s+(.*)$/);
  if (!m) return inline(s);
  return <><span className="md-label">{m[1]}</span>{inline(m[2])}</>;
}

function inline(s: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s)]+)/g).filter(Boolean).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part.startsWith("`") ? <strong key={i}>{part.slice(1, -1)}</strong>
    : /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" className="md-link">{new URL(part).hostname.replace(/^www\./, "")} ↗</a>
    : part,
  );
}
