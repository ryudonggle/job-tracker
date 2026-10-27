// 클라이언트 컴포넌트에서도 쓰는 값. db.ts(postgres)를 브라우저 번들에 끌어오지 않게 분리.
export type Status = "관심" | "지원 예정" | "지원 완료" | "서류 합격" | "탈락" | "패스";
export const STATUSES: Status[] = ["관심", "지원 예정", "지원 완료", "서류 합격", "탈락", "패스"];
