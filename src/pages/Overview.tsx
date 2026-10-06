import {
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Flag,
} from "lucide-react";
import type { Dashboard, User } from "../lib/types";
import { statuses } from "../lib/types";
import { ActivityList } from "../components/ActivityList";
import { Empty } from "../components/Feedback";
export function Overview({
  data,
  user,
  navigate,
  create,
}: {
  data: Dashboard;
  user: User;
  navigate: (path: string) => void;
  create: () => void;
}) {
  const completed = data.counts.DONE,
    percent = data.total ? Math.round((completed / data.total) * 100) : 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE OVERVIEW</span>
          <h1>A clear view, {user.name.split(" ")[0]}.</h1>
          <p>Your priorities, progress, and the next step forward.</p>
        </div>
        <button className="primary" onClick={create}>
          + Create work item
        </button>
      </div>
      <div className="metrics">
        {[
          {
            label: "Open work items",
            value: data.total - completed,
            detail: "Ready for your next move",
            Icon: CircleDashed,
          },
          {
            label: "In progress",
            value: data.counts.IN_PROGRESS,
            detail: "Work moving forward",
            Icon: Clock3,
          },
          {
            label: "Completed",
            value: completed,
            detail: "Details taken care of",
            Icon: CheckCircle2,
          },
          {
            label: "Overdue",
            value: data.overdue,
            detail: "Needs a closer look",
            Icon: Flag,
          },
        ].map(({ label, value, detail, Icon }) => (
          <article className="metric" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Work in motion</h2>
              <p>A live snapshot of your work items.</p>
            </div>
            <span className="subtle-pill">{data.total} total</span>
          </div>
          <div className="progress-content">
            <div
              className="progress-ring"
              style={{
                background: `conic-gradient(var(--green) ${percent}%,var(--border) 0)`,
              }}
              role="img"
              aria-label={`${percent}% of work items completed`}
            >
              <div>
                <strong>
                  {percent}
                  <small>%</small>
                </strong>
                <span>completed</span>
              </div>
            </div>
            <div className="status-breakdown">
              {Object.entries(statuses).map(([value, label]) => (
                <div key={value}>
                  <span className={"dot " + value} />
                  <span>{label}</span>
                  <strong>{data.counts[value as keyof typeof statuses]}</strong>
                </div>
              ))}
            </div>
          </div>
          <button className="panel-link" onClick={() => navigate("/tasks")}>
            View all work items <ArrowUpRight size={17} />
          </button>
        </section>
        <section className="focus-panel">
          <span className="eyebrow light">A LITTLE FOCUS GOES A LONG WAY</span>
          <h2>
            Make the next
            <br />
            step a clear one.
          </h2>
          <p>
            {data.counts.BLOCKED
              ? `${data.counts.BLOCKED} work item${data.counts.BLOCKED === 1 ? " is" : "s are"} blocked. A small conversation could get things moving again.`
              : "Keep descriptions useful, deadlines realistic, and work small enough to finish."}
          </p>
          <button onClick={() => navigate("/tasks")}>
            Review your work <ArrowRightIcon />
          </button>
          <div className="focus-decoration" aria-hidden="true">
            <div />
            <div />
            <div />
          </div>
        </section>
      </div>
      <section className="panel recent">
        <div className="section-head">
          <div>
            <h2>Latest activity</h2>
            <p>The small steps that move things forward.</p>
          </div>
          <button className="text-button" onClick={() => navigate("/activity")}>
            View activity <ArrowUpRight size={15} />
          </button>
        </div>
        {data.activity.length ? (
          <ActivityList items={data.activity.slice(0, 5)} />
        ) : (
          <Empty
            title="Your story starts here"
            description="Create a work item to see your workspace activity."
          />
        )}
      </section>
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={17} />;
}
