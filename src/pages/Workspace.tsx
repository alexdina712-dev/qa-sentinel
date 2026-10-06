import { useState, type FormEvent } from "react";
import { ShieldCheck, Database, LogOut } from "lucide-react";
import type { User } from "../lib/types";
import { api, json } from "../lib/api";
import { Modal } from "../components/Modal";
import { ErrorNotice } from "../components/Feedback";
export function Workspace({
  user,
  onDeleted,
  logout,
}: {
  user: User;
  onDeleted: () => void;
  logout: () => void;
}) {
  const [open, setOpen] = useState(false),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function remove(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/account", json("DELETE", { password }));
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SPACE, YOUR CONTROL</span>
          <h1>Workspace</h1>
          <p>Account details and straightforward privacy controls.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card">
          <ShieldCheck size={26} />
          <h2>{user.name}</h2>
          <p>{user.demo ? "Private demo workspace" : user.email}</p>
          <dl>
            <div>
              <dt>Workspace access</dt>
              <dd>Only this account</dd>
            </div>
            <div>
              <dt>Account type</dt>
              <dd>{user.demo ? "Temporary demo" : "Personal sandbox"}</dd>
            </div>
            {user.expires_at && (
              <div>
                <dt>Demo expiry</dt>
                <dd>
                  {new Date(user.expires_at * 1000).toLocaleString("en-GB")}
                </dd>
              </div>
            )}
          </dl>
          <button className="secondary" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </section>
        <section className="panel settings-card">
          <Database size={26} />
          <h2>Built for exploration</h2>
          <p>
            This portfolio sandbox uses fictional release work. Please avoid
            uploading personal or confidential information.
          </p>
          <p>
            Your local installation saves data between restarts. The free public
            demo uses temporary storage and can reset when the server restarts
            or deploys.
          </p>
          <p>
            Deleting your workspace removes the account, work items, activity,
            and all its sessions.
          </p>
          <button className="danger-outline" onClick={() => setOpen(true)}>
            Delete workspace
          </button>
        </section>
      </div>
      {open && (
        <Modal
          title="Delete your workspace?"
          onClose={() => setOpen(false)}
          busy={busy}
        >
          <form className="form" onSubmit={remove}>
            <p>
              This permanently deletes your account and all associated work.
              Note anything you need before continuing.
            </p>
            {error && <ErrorNotice message={error} />}
            <label>
              {user.demo
                ? "Type DELETE DEMO to confirm"
                : "Confirm your password"}
              <input
                type={user.demo ? "text" : "password"}
                value={password}
                required
                maxLength={128}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="danger" disabled={busy}>
                {busy ? "Deleting…" : "Permanently delete workspace"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
