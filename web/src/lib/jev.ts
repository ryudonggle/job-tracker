import type { FitLevel, Job } from "./db";

const LEVELS: FitLevel[] = ["하", "중", "상"];

export type JevResult = {
  fit_level: FitLevel;
  fit_score: number;
  fit_confidence: number;
  fit_probs: Record<string, number>;
  is_data_role: number;
  newcomer_ok: number;
  needs_masters: number;
};

const NEEDS_MASTERS = {
  type: "noul",
  instructions:
    "Does `posting` REQUIRE (not merely prefer) a master's degree or higher, current enrollment in a master's/PhD program, or 전문연구요원 (specialized research personnel) eligibility as a mandatory qualification? Answer no if the master's degree only appears as preferred (우대) or 산업기능요원/보충역 is accepted.",
};

const clip = (s: string | null, n = 2500) => (s ?? "").slice(0, n);

const posting = (job: Job) => ({
  company: job.company,
  title: job.title,
  main_tasks: clip(job.main_tasks),
  requirements: clip(job.requirements),
  preferred: clip(job.preferred, 1500),
  tech_stacks: (job.tech_stacks ?? []).join(", "),
});

async function ask(state: object, questions: object) {
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "jev-latest", state, questions }),
  });
  if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).answers;
}

/** 이미 채점된 공고에 석사 요건만 따로 물을 때 */
export async function checkMasters(job: Job): Promise<number> {
  const a = await ask({ posting: posting(job) }, { needs_masters: NEEDS_MASTERS });
  return a.needs_masters.noul;
}

export async function scoreJob(profile: string, job: Job): Promise<JevResult> {
  const a = await ask(
    { candidate: profile, posting: posting(job) },
    {
      fit: {
        type: "score",
        instructions:
          "How well does `candidate`'s actual project experience and skills match `posting`'s main tasks and requirements, judged for a new-grad hire?",
        criteria: [
          "하: The candidate's projects and skills barely overlap with the posting's main tasks — a different job family, or core stack/domain experience is missing.",
          "중: Some tasks or skills overlap (e.g. Python/SQL analysis or pipelines), but core task experience or part of the required qualifications is missing.",
          "상: The candidate has directly done most of the posting's main tasks in their projects and meets the required qualifications.",
        ],
      },
      is_data_role: {
        type: "noul",
        instructions:
          "Is `posting` primarily a data analyst, data engineer, data scientist, or ML/AI data role (not general software, sales, or operations)?",
      },
      newcomer_ok: {
        type: "noul",
        instructions:
          "Can a new graduate with no full-time work experience apply to `posting` and meet its required qualifications?",
      },
      needs_masters: NEEDS_MASTERS,
    },
  );

  const score: number = a.fit.score;
  return {
    fit_level: LEVELS[Math.max(0, Math.min(2, Math.round(score)))],
    fit_score: score,
    fit_confidence: a.fit.confidence,
    fit_probs: a.fit.probabilities,
    is_data_role: a.is_data_role.noul,
    newcomer_ok: a.newcomer_ok.noul,
    needs_masters: a.needs_masters.noul,
  };
}
