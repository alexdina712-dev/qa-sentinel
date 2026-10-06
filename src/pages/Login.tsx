import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Check,
  LockKeyhole,
  Workflow,
} from "lucide-react";
import { api, json } from "../lib/api";
import { loginSchema, registerSchema } from "../lib/validation";
import type { User } from "../lib/types";
import { ErrorNotice } from "../components/Feedback";
export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = (register ? registerSchema : loginSchema).safeParse({
      name,
      email,
      password,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      onLogin(
        await api<User>(
          "/auth/" + (register ? "register" : "login"),
          json("POST", parsed.data),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    setError("");
    try {
      onLogin(await api<User>("/auth/demo", json("POST")));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <a className="brand" href="/login">
          <span className="brand-mark">
            <ShieldCheck size={25} />
          </span>
          <span>
            QA Sentinel<small>RELEASE WORKBENCH</small>
          </span>
        </a>
        <div className="story-content">
          <span className="eyebrow light">SMALL DETAILS. BETTER RELEASES.</span>
          <h1>
            Clear work.
            <br />
            Confident delivery.
          </h1>
          <p>
            A focused place to track the work behind a release. Make progress
            visible, keep priorities clear, and give every detail a home.
          </p>
          <div className="story-card">
            <div className="story-card-head">
              <Workflow size={19} />
              <span>Release checklist</span>
              <span className="mini-label">WORK IN FOCUS</span>
            </div>
            {[
              "Review acceptance criteria",
              "Verify critical workflows",
              "Close the loop on feedback",
            ].map((x, i) => (
              <div className="story-row" key={x}>
                <span className={i < 2 ? "story-check done" : "story-check"}>
                  {i < 2 && <Check size={14} />}
                </span>
                {x}
              </div>
            ))}
          </div>
          <div className="story-foot">
            <LockKeyhole size={16} /> Your workspace. Your work.
          </div>
        </div>
        <p className="auth-caption">
          A working demo built around observable, testable behavior.
        </p>
      </section>
      <section className="auth-form">
        <div>
          <span className="eyebrow">YOUR NEXT GOOD RELEASE</span>
          <h2>{register ? "Create your workspace." : "Welcome back."}</h2>
          <p className="muted">
            {register
              ? "Start with a clean workspace and make it your own."
              : "Sign in to pick up where you left off."}
          </p>
          <form onSubmit={submit} className="form">
            {error && <ErrorNotice message={error} />}
            <fieldset disabled={busy}>
              {register && (
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={register ? 10 : 1}
                  maxLength={128}
                  required
                  placeholder={
                    register ? "At least 10 characters" : "Your password"
                  }
                />
              </label>
              <button className="primary wide">
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
                <ArrowRight size={17} />
              </button>
            </fieldset>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New here?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
              disabled={busy}
            >
              {register ? "Sign in instead" : "Create an account"}
            </button>
          </p>
          <div className="separator">
            <span>JUST EXPLORING?</span>
          </div>
          <button className="secondary wide" onClick={demo} disabled={busy}>
            Explore a private demo
            <ArrowRight size={17} />
          </button>
          <p className="fine-print">
            No signup required. Eight fictional work items, in a workspace only
            you can access. Demo data expires after 24 hours.
          </p>
          <p className="fine-print">
            Portfolio sandbox: use fictional information. The free hosted demo
            resets when its service restarts.
          </p>
        </div>
      </section>
    </div>
  );
}
