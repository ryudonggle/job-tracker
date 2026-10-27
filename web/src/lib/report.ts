import OpenAI from "openai";
import type { Job } from "./db";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

const INSTRUCTIONS = `너는 신입 데이터 분석가·엔지니어 지원자의 취업 코치다.
지원자 경험과 공고를 비교해 한국어로 짧은 적합도 리포트를 쓴다.
반드시 아래 형식 그대로, 각 제목은 한 번만 쓰고 항목은 '- '로 시작한다. 다른 말은 붙이지 않는다.

**맞는 이유**
- 공고 업무와 직접 겹치는 지원자 프로젝트·기술 (프로젝트 이름을 구체적으로, 2~3개)
**부족한 점**
- 요건 중 경험이 없거나 약한 것 (1~2개)
**자소서 포인트**
- 어떤 경험을 어떤 각도로 쓰면 좋은지 (1~2개)

지원자 경험에 없는 내용은 지어내지 않는다. 각 항목은 한 문장으로 짧게.`;

export async function writeReport(profile: string, job: Job): Promise<string> {
  const posting = [
    `회사: ${job.company}`,
    `직무: ${job.title}`,
    `주요 업무:\n${job.main_tasks ?? ""}`,
    `자격 요건:\n${job.requirements ?? ""}`,
    `우대 사항:\n${job.preferred ?? ""}`,
    `기술 스택: ${(job.tech_stacks ?? []).join(", ")}`,
    `Jev 적합도: ${job.fit_level} (점수 ${job.fit_score?.toFixed(2)} / 0~2)`,
  ].join("\n\n");

  const r = await openai().responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
    instructions: INSTRUCTIONS,
    input: `## 지원자 경험\n${profile}\n\n## 공고\n${posting}`,
  });
  return r.output_text.trim();
}
