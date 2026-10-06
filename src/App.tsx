import { useEffect, useState } from "react";
import {
  ShieldCheck,
  LayoutDashboard,
  ListTodo,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  RefreshCw,
} from "lucide-react";
import { api, json, ApiError } from "./lib/api";
import type { User, Dashboard, Task } from "./lib/types";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Tasks } from "./pages/Tasks";
import { Workspace } from "./pages/Workspace";
import { TaskEditor } from "./components/TaskEditor";
import { ActivityList } from "./components/ActivityList";
import { ErrorNotice, Loading, Empty } from "./components/Feedback";
const nav = [
  { path: "/overview", label: "Overview", Icon: LayoutDashboard },
  { path: "/tasks", label: "Work items", Icon: ListTodo },
  { path: "/activity", label: "Activity", Icon: Activity },
  { path: "/workspace", label: "Workspace", Icon: Settings },
];
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [initial, setInitial] = useState(true),
    [initialError, setInitialError] = useState(""),
    [path, setPath] = useState(window.location.pathname),
    [mobile, setMobile] = useState(false),
    [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(""),
    [epoch, setEpoch] = useState(0),
    [editor, setEditor] = useState<{ task: Task | null } | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  function navigate(next: string) {
    history.pushState({}, "", next);
    setPath(next);
    setMobile(false);
    setNotice("");
  }
  function signedOut() {
    setUser(null);
    setEditor(null);
    setData(null);
    navigate("/login");
  }
  function signedIn(next: User) {
    setUser(next);
    setData(null);
    setError("");
    navigate("/overview");
  }
  async function session() {
    setInitial(true);
    setInitialError("");
    try {
      const u = await api<User>("/auth/me");
      setUser(u);
      if (!nav.some((n) => n.path === location.pathname)) {
        history.replaceState({}, "", "/overview");
        setPath("/overview");
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        history.replaceState({}, "", "/login");
        setPath("/login");
      } else setInitialError((e as Error).message);
    } finally {
      setInitial(false);
    }
  }
  useEffect(() => {
    void session();
    const pop = () => setPath(location.pathname);
    const expired = () => {
      signedOut();
      setNotice("Your session ended. Sign in to continue.");
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("sentinel-session-expired", expired);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("sentinel-session-expired", expired);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setError("");
    api<Dashboard>("/dashboard")
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user, epoch]);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", json("POST"));
      signedOut();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (initial) return <Loading />;
  if (initialError)
    return (
      <div className="initial-error">
        <ShieldCheck size={36} />
        <h1>Let’s reconnect.</h1>
        <ErrorNotice message={initialError} retry={() => void session()} />
      </div>
    );
  if (!user)
    return (
      <>
        {notice && (
          <div className="session-notice" role="status">
            {notice}
          </div>
        )}
        <Login onLogin={signedIn} />
      </>
    );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation overlay"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="/overview"
          onClick={(e) => {
            e.preventDefault();
            navigate("/overview");
          }}
        >
          <span className="brand-mark">
            <ShieldCheck size={24} />
          </span>
          <span>
            QA Sentinel<small>RELEASE WORKBENCH</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-badge">
          <span className="workspace-icon">{user.name[0]}</span>
          <div>
            <strong>{user.demo ? "Northstar studio" : user.name}</strong>
            <small>{user.demo ? "Private demo" : "Personal workspace"}</small>
          </div>
          <span className="live-dot" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {nav.map(({ path: href, label, Icon }) => (
            <a
              href={href}
              key={href}
              aria-current={path === href ? "page" : undefined}
              className={path === href ? "active" : ""}
              onClick={(e) => {
                e.preventDefault();
                navigate(href);
              }}
            >
              <Icon size={19} />
              {label}
              {href === "/tasks" && data && <span>{data.total}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={22} />
          <strong>A space to try things.</strong>
          <p>
            {user.demo
              ? "This demo belongs only to you. Explore, edit, and make yourself at home."
              : "Your work items are private to this account."}
          </p>
          <button onClick={() => navigate("/workspace")}>
            Workspace details →
          </button>
        </div>
        <div className="sidebar-user">
          <span className="avatar">
            {user.name
              .split(" ")
              .map((v) => v[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.demo ? "Demo workspace" : "Workspace owner"}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={logout}
            disabled={busy}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>
              Workspace <b>/</b>{" "}
              {nav.find((n) => n.path === path)?.label || "Overview"}
            </span>
          </div>
          <div>
            <span className="today">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              onClick={() => setEpoch((v) => v + 1)}
            >
              <RefreshCw size={17} />
            </button>
            <span className="top-avatar">{user.name[0]}</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {error && (
            <ErrorNotice message={error} retry={() => setEpoch((v) => v + 1)} />
          )}{" "}
          {notice && (
            <div role="status" className="success-notice">
              {notice}
            </div>
          )}
          {path === "/tasks" ? (
            <Tasks
              epoch={epoch}
              edit={(task) => setEditor({ task })}
              create={() => setEditor({ task: null })}
              changed={() => setEpoch((v) => v + 1)}
            />
          ) : path === "/workspace" ? (
            <Workspace user={user} onDeleted={signedOut} logout={logout} />
          ) : !data ? (
            <Loading />
          ) : path === "/activity" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">EVERY STEP COUNTS</span>
                  <h1>Activity</h1>
                  <p>The latest 30 changes in your workspace.</p>
                </div>
              </div>
              <section className="panel">
                {data.activity.length ? (
                  <ActivityList items={data.activity} />
                ) : (
                  <Empty
                    title="No activity yet"
                    description="Your work item changes will appear here."
                  />
                )}
              </section>
            </>
          ) : (
            <Overview
              data={data}
              user={user}
              navigate={navigate}
              create={() => setEditor({ task: null })}
            />
          )}
          <footer>
            QA Sentinel <span>•</span> A focused workbench for thoughtful
            releases.
          </footer>
        </main>
      </div>
      {editor && (
        <TaskEditor
          task={editor.task}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setNotice(
              editor.task ? "Work item updated." : "Work item created.",
            );
            setEditor(null);
            setEpoch((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
