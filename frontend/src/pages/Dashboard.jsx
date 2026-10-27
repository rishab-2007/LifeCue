import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: "⌂" },
  { label: "Tasks", path: "/tasks", icon: "✓" },
  { label: "Planner", path: "/planner", icon: "▦" },
  { label: "Habits", path: "/habits", icon: "◉" },
  { label: "Focus", path: "/focus", icon: "◷" },
  { label: "Goals", path: "/goals", icon: "◇" },
  { label: "Analytics", path: "/analytics", icon: "↗" },
  { label: "Notes", path: "/notes", icon: "✎" },
];

function Dashboard() {
  const navigate = useNavigate();

  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lifecue_user") || "null");
    } catch {
      return null;
    }
  });

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");
  const [focusStarted, setFocusStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      const email = user?.email;

      if (!email) {
        setTasks([]);
        setTasksLoading(false);
        setTasksError("Please sign in again to load your tasks.");
        return;
      }

      try {
        setTasksLoading(true);
        setTasksError("");

        const response = await apiFetch(
          `/tasks?email=${encodeURIComponent(email)}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "Could not load tasks."
          );
        }

        if (!cancelled) {
          setTasks(Array.isArray(data.tasks) ? data.tasks : []);
        }
      } catch (error) {
        if (!cancelled) {
          setTasksError(
            error.message || "Could not connect to the LifeCue backend."
          );
        }
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const now = new Date();

  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hour = now.getHours();

  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
      ? "Good afternoon"
      : "Good evening";

  const name = user?.name?.trim() || "there";
  const initial = name.charAt(0).toUpperCase();

  const taskCount = tasks.length;

  const completedTaskCount = tasks.filter(
    (task) => task.completed
  ).length;

  const pendingTaskCount = taskCount - completedTaskCount;

  const taskItems = useMemo(
    () => tasks.slice(0, 4),
    [tasks]
  );

  function signOut() {
    localStorage.removeItem("lifecue_token");
    localStorage.removeItem("lifecue_user");
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#080B18] text-white flex overflow-hidden">
      {/* Background glows */}
      <div className="fixed top-[-180px] left-[250px] w-[450px] h-[450px] bg-violet-600/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="fixed bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Sidebar */}
      <aside className="relative z-10 hidden lg:flex w-64 min-h-screen flex-col border-r border-white/10 bg-white/[0.025] backdrop-blur-xl shrink-0">
        <Link
          to="/dashboard"
          className="px-6 py-7 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="font-bold text-lg">L</span>
          </div>

          <span className="text-xl font-semibold tracking-tight">
            LifeCue
          </span>
        </Link>

        <nav className="px-4 mt-5 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-600 px-3 mb-3">
            Workspace
          </p>

          {navigation.map((item) => {
            const active = item.path === "/dashboard";

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active
                    ? "bg-gradient-to-r from-violet-600/20 to-blue-600/10 border border-violet-500/20 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
                }`}
              >
                <span className="w-5 text-center">{item.icon}</span>

                <span
                  className={`text-sm ${
                    active ? "font-medium" : ""
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
            <p className="text-xs text-slate-500">
              A little reminder
            </p>

            <p className="text-sm font-medium mt-1">
              Small steps count.
            </p>

            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Keep showing up. Progress grows with consistency.
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto">
        <header className="min-h-20 border-b border-white/10 flex items-center justify-between gap-4 px-5 sm:px-6 lg:px-10 py-4">
          <div>
            <p className="text-sm text-slate-500">
              {dateLabel}
            </p>

            <h1 className="text-xl font-semibold mt-1">
              {greeting} 👋
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-slate-500">
                Personal workspace
              </p>
            </div>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-semibold">
              {initial}
            </div>

            <button
              type="button"
              onClick={signOut}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-slate-300 hover:bg-white/10 transition"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="p-5 sm:p-6 lg:p-10 max-w-7xl mx-auto">
          {/* Welcome */}
          <div className="mb-8">
            <p className="text-sm text-violet-400 font-medium mb-2">
              YOUR DAY AT A GLANCE
            </p>

            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Make today count, {name.split(" ")[0]}.
            </h2>

            <p className="text-slate-500 mt-2">
              A little progress today adds up to something great.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <Link
              to="/tasks"
              className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-violet-500/30 transition"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-sm text-slate-500">
                    Total tasks
                  </p>

                  <p className="text-3xl font-bold mt-2">
                    {tasksLoading ? "—" : taskCount}
                  </p>

                  <p className="text-xs text-emerald-400 mt-2">
                    {tasksLoading
                      ? "Loading tasks..."
                      : `${completedTaskCount} completed · ${pendingTaskCount} pending`}
                  </p>
                </div>

                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                  ✓
                </div>
              </div>
            </Link>

            <Link
              to="/focus"
              className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-blue-500/30 transition"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-sm text-slate-500">
                    Focus mode
                  </p>

                  <p className="text-3xl font-bold mt-2">
                    50 min
                  </p>

                  <p className="text-xs text-blue-400 mt-2">
                    Deep work session
                  </p>
                </div>

                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  ◷
                </div>
              </div>
            </Link>

            <Link
              to="/habits"
              className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-emerald-500/30 transition"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-sm text-slate-500">
                    Habits
                  </p>

                  <p className="text-3xl font-bold mt-2">—</p>

                  <p className="text-xs text-slate-500 mt-2">
                    Database connection pending
                  </p>
                </div>

                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  ◉
                </div>
              </div>
            </Link>

            <Link
              to="/goals"
              className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-orange-500/30 transition"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-sm text-slate-500">
                    Goals
                  </p>

                  <p className="text-3xl font-bold mt-2">—</p>

                  <p className="text-xs text-slate-500 mt-2">
                    Database connection pending
                  </p>
                </div>

                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                  ◇
                </div>
              </div>
            </Link>
          </div>

          {/* Main grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-lg font-semibold">
                    Your tasks
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Live data from your LifeCue account.
                  </p>
                </div>

                <Link
                  to="/tasks"
                  className="text-sm text-violet-400 hover:text-violet-300 whitespace-nowrap"
                >
                  View tasks →
                </Link>
              </div>

              {tasksLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Loading your tasks…
                </div>
              ) : tasksError ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">
                  <p>{tasksError}</p>

                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-3 underline hover:text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : taskItems.length === 0 ? (
                <div className="py-10 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10">
                  <p className="text-sm text-slate-300">
                    No tasks yet
                  </p>

                  <p className="text-xs text-slate-500 mt-2">
                    Add your first task to see it here.
                  </p>

                  <Link
                    to="/tasks"
                    className="inline-block mt-4 text-sm text-violet-400 hover:text-violet-300"
                  >
                    Create a task →
                  </Link>
                </div>
              ) : (
                taskItems.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 sm:gap-4 p-4 rounded-2xl border mb-3 transition ${
                      task.completed
                        ? "bg-emerald-500/[0.04] border-emerald-500/10"
                        : "bg-white/[0.03] border-white/5 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-xs ${
                        task.completed
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-slate-600"
                      }`}
                    >
                      {task.completed ? "✓" : ""}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          task.completed
                            ? "text-slate-500 line-through"
                            : ""
                        }`}
                      >
                        {task.title}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        {task.category || "Personal"} ·{" "}
                        {task.time || "No time set"}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] ${
                        task.priority === "High"
                          ? "bg-rose-500/10 text-rose-400"
                          : task.priority === "Medium"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-slate-500/10 text-slate-400"
                      }`}
                    >
                      {task.priority || "Medium"}
                    </span>
                  </div>
                ))
              )}

              {!tasksLoading &&
                !tasksError &&
                taskItems.length > 0 &&
                taskCount > taskItems.length && (
                  <p className="text-xs text-slate-500 mt-3">
                    Showing {taskItems.length} of {taskCount} tasks.
                  </p>
                )}
            </section>

            {/* Focus card */}
            <section className="p-6 rounded-3xl bg-gradient-to-br from-violet-600/15 to-blue-600/10 border border-violet-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-violet-300">
                    Focus mode
                  </p>

                  <h3 className="text-xl font-semibold mt-1">
                    Ready to focus?
                  </h3>
                </div>

                <div className="w-11 h-11 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-300">
                  ◷
                </div>
              </div>

              <div className="mt-8 text-center">
                <div className="text-5xl font-bold tracking-tight">
                  50:00
                </div>

                <p className="text-sm text-slate-500 mt-2">
                  Deep Work Session
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFocusStarted(true);
                  navigate("/focus");
                }}
                className="w-full mt-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-semibold transition shadow-lg shadow-violet-600/20"
              >
                {focusStarted
                  ? "Continue focus session →"
                  : "Start focus session →"}
              </button>

              <p className="text-center text-xs text-slate-500 mt-4">
                50 min focus · 10 min break
              </p>
            </section>

            {/* Habits */}
            <section className="p-6 rounded-3xl bg-white/[0.04] border border-white/10">
              <div className="flex justify-between items-center mb-5 gap-2">
                <div>
                  <h3 className="text-lg font-semibold">
                    Today's habits
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    Build your daily routine.
                  </p>
                </div>

                <span className="text-sm text-slate-500">
                  Not connected
                </span>
              </div>

              <div className="rounded-2xl bg-white/[0.02] border border-dashed border-white/10 p-5">
                <p className="text-sm text-slate-300">
                  Habit tracking is not connected to the database yet.
                </p>

                <p className="text-xs text-slate-500 mt-2">
                  Your real habit progress will appear here once we
                  connect the Habits page.
                </p>
              </div>

              <Link
                to="/habits"
                className="inline-block text-sm text-violet-400 mt-5 hover:text-violet-300"
              >
                Open habits →
              </Link>
            </section>

            {/* Goals */}
            <section className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white/[0.04] border border-white/10">
              <div className="flex justify-between items-center mb-6 gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    Active goals
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Keep the bigger picture in sight.
                  </p>
                </div>

                <Link
                  to="/goals"
                  className="text-sm text-violet-400 hover:text-violet-300 whitespace-nowrap"
                >
                  View goals →
                </Link>
              </div>

              <div className="rounded-2xl bg-white/[0.02] border border-dashed border-white/10 p-6">
                <p className="text-sm text-slate-300">
                  Your saved goals will appear here.
                </p>

                <p className="text-xs text-slate-500 mt-2">
                  Goal data is not connected to the dashboard yet, so
                  we are not showing example numbers.
                </p>

                <Link
                  to="/goals"
                  className="inline-block mt-4 text-sm text-violet-400 hover:text-violet-300"
                >
                  Manage goals →
                </Link>
              </div>
            </section>
          </div>

          <div className="text-center py-8">
            <p className="text-xs text-slate-600">
              LifeCue · Remember → Plan → Focus → Track → Review → Improve
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;