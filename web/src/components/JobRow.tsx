import Link from "next/link";
import type { Job } from "@/lib/db";
import { fmtDate } from "@/lib/date";
import { DDay, FitChip, SOURCE_LABEL } from "./bits";

export default function JobRow({ job, today }: { job: Job; today: string }) {
  return (
    <Link href={`/jobs/${job.id}`} className="row">
      <DDay deadline={job.deadline} today={today} />
      <div style={{ minWidth: 0 }}>
        <div className="t">{job.title}</div>
        <div className="s">
          {job.company} · {fmtDate(job.deadline)}
          {job.deadline_time ? ` ${job.deadline_time}` : ""} · {SOURCE_LABEL[job.source]}
        </div>
      </div>
      <div className="tags">
        <FitChip level={job.fit_level} />
        {job.status !== "관심" && <span className="chip status">{job.status}</span>}
      </div>
    </Link>
  );
}
