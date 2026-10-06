import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import type { Activity } from "../lib/types";
export function ActivityList({ items }: { items: Activity[] }) {
  return (
    <ul className="activity-list">
      {items.map((item) => {
        const Icon =
          item.action === "completed"
            ? Check
            : item.action === "created"
              ? Plus
              : item.action === "deleted"
                ? Trash2
                : Pencil;
        return (
          <li key={item.id}>
            <span className={"event-icon " + item.action}>
              <Icon size={15} />
            </span>
            <div>
              <strong>{item.subject}</strong>
              <p>Work item {item.action}</p>
            </div>
            <time dateTime={new Date(item.created_at * 1000).toISOString()}>
              {new Date(item.created_at * 1000).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
