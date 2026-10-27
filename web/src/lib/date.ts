// 모든 날짜는 KST 기준 'YYYY-MM-DD' 문자열로 다룬다.
export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export function addDays(d: string, n: number) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string) {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400e3);
}

/** 마감까지 남은 날: D-3, D-DAY, 상시 */
export function dday(deadline: string | null, today = todayKST()) {
  if (!deadline) return { label: "상시", n: null as number | null, urgent: false };
  const n = diffDays(deadline, today);
  return { label: n === 0 ? "D-DAY" : n > 0 ? `D-${n}` : `D+${-n}`, n, urgent: n >= 0 && n <= 3 };
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export const dow = (d: string) => DOW[new Date(`${d}T00:00:00Z`).getUTCDay()];
export const fmtDate = (d: string | null) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${dow(d)})` : "상시");
