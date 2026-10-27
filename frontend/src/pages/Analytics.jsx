import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";

const navigation = [
  { to: "/dashboard", icon: "⌂", label: "Dashboard" },
  { to: "/tasks", icon: "✓", label: "Tasks" },
  { to: "/planner", icon: "▦", label: "Planner" },
  { to: "/habits", icon: "◉", label: "Habits" },
  { to: "/focus", icon: "◷", label: "Focus" },
  { to: "/goals", icon: "◇", label: "Goals" },
  { to: "/analytics", icon: "↗", label: "Analytics" },
  { to: "/notes", icon: "✎", label: "Notes" },
];

async function fetchCollection(path, email) {
  const query = email ? `?email=${encodeURIComponent(email)}` : "";
  const response = await apiFetch(`${path}${query}`);

  if (!response.ok) {
    let message = `Request failed (${response.status}) for ${path}`;

    try {
      const errorData = await response.json();
      if (typeof errorData.detail === "string") {
        message = errorData.detail;
      } else if (typeof errorData.message === "string") {
        message = errorData.message;
      }
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  const data = await response.json();

  if (Array.isArray(data)) return data;

  if (data?.success === false) {
    throw new Error(data.message || `Could not load ${path}`);
  }

  const possibleCollections = [
    "items",
    "tasks",
    "habits",
    "goals",
    "planner",
    "entries",
    "sessions",
  ];

  for (const key of possibleCollections) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

function Sidebar({ weeklyProductivity }) {
  return (
    <aside className="relative z-10 hidden lg:flex w-64 min-h-screen flex-col border-r border-white/10 bg-white/[0.025] backdrop-blur-xl">
      <div className="px-6 py-7 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <span className="font-bold text-lg">L</span>
        </div>
        <span className="text-xl font-semibold">LifeCue</span>
      </div>

      <nav className="px-4 mt-5 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-slate-600 px-3 mb-3">
          Workspace
        </p>

        {navigation.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
              item.to === "/analytics"
                ? "bg-gradient-to-r from-violet-600/20 to-blue-600/10 border border-violet-500/20 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>{item.icon}</span>
            <span
              className={
                item.to === "/analytics" ? "font-medium" : ""
              }
            >
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto p-4">
        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
          <p className="text-xs text-slate-500">Task completion</p>
          <p className="text-lg font-semibold mt-1">
            {weeklyProductivity}%
          </p>
          <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${weeklyProductivity}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  iconClass = "text-violet-300 bg-violet-500/10",
}) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{label}</p>
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconClass}`}
        >
          {icon}
        </span>
      </div>
      <p className="text-3xl font-bold mt-3">{value}</p>
      <p className="text-xs text-slate-500 mt-2">{detail}</p>
    </div>
  );
}

function ProgressRow({ label, value, colorClass, detail }) {
  const safeValue = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div>
      <div className="flex justify-between gap-3 text-sm mb-2">
        <span className="text-slate-400">{label}</span>
        <span>{safeValue}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
      {detail && (
        <p className="text-xs text-slate-600 mt-1">{detail}</p>
      )}
    </div>
  );
}

function getCompleted(item) {
  if (typeof item?.completed === "boolean") return item.completed;
  if (typeof item?.is_completed === "boolean") return item.is_completed;
  if (typeof item?.done === "boolean") return item.done;

  return false;
}

function getDateValue(item) {
  return (
    item?.completed_at ??
    item?.completedAt ??
    item?.created_at ??
    item?.createdAt ??
    item?.date ??
    item?.scheduled_date ??
    item?.scheduled_at ??
    item?.updated_at ??
    null
  );
}

function Analytics() {
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [goals, setGoals] = useState([]);
  const [planner, setPlanner] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  const user = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("lifecue_user") || "null"
      );
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setErrors([]);

      const email = user?.email;

      if (!email) {
        setErrors([
          "User details nahi mile. Please logout karke dobara login karo.",
        ]);
        setLoading(false);
        return;
      }

      const requests = [
        { key: "tasks", path: "/tasks", setter: setTasks },
        { key: "habits", path: "/habits", setter: setHabits },
        { key: "goals", path: "/goals", setter: setGoals },
        { key: "planner", path: "/planner", setter: setPlanner },
      ];

      const results = await Promise.all(
        requests.map(async (request) => {
          try {
            const items = await fetchCollection(
              request.path,
              email
            );

            if (!cancelled) {
              request.setter(items);
            }

            return null;
          } catch (error) {
            return `${request.key}: ${error.message}`;
          }
        })
      );

      if (!cancelled) {
        setErrors(results.filter(Boolean));
        setLoading(false);
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const completedTasks = tasks.filter(getCompleted).length;

  const taskRate = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  const completedHabits = habits.filter(getCompleted).length;

  const habitRate = habits.length
    ? Math.round((completedHabits / habits.length) * 100)
    : 0;

  // Goals are considered complete when progress reaches 100%.
  const completedGoals = goals.filter(
    (goal) => Number(goal.progress) >= 100 || getCompleted(goal)
  ).length;

  const goalRate = goals.length
    ? Math.round((completedGoals / goals.length) * 100)
    : 0;

  const completedPlanner = planner.filter(getCompleted).length;

  const plannerRate = planner.length
    ? Math.round((completedPlanner / planner.length) * 100)
    : 0;

  const productivity = useMemo(() => {
    const categories = [
      { total: tasks.length, rate: taskRate },
      { total: habits.length, rate: habitRate },
      { total: goals.length, rate: goalRate },
      { total: planner.length, rate: plannerRate },
    ].filter((category) => category.total > 0);

    if (!categories.length) return 0;

    return Math.round(
      categories.reduce((sum, category) => sum + category.rate, 0) /
        categories.length
    );
  }, [
    tasks.length,
    habits.length,
    goals.length,
    planner.length,
    taskRate,
    habitRate,
    goalRate,
    plannerRate,
  ]);

  const weeklyData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    const start = new Date(today);

    start.setDate(today.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      const dateKey = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      const sameDay = (item) => {
        const raw = getDateValue(item);
        if (!raw) return false;

        const parsed = new Date(raw);

        if (Number.isNaN(parsed.getTime())) {
          return String(raw).slice(0, 10) === dateKey;
        }

        return (
          parsed.getFullYear() === date.getFullYear() &&
          parsed.getMonth() === date.getMonth() &&
          parsed.getDate() === date.getDate()
        );
      };

      const dayTasks = tasks.filter(sameDay);
      const dayCompleted = dayTasks.filter(getCompleted).length;

      const dayHabits = habits.filter(sameDay);
      const dayHabitsDone = dayHabits.filter(getCompleted).length;

      return {
        day: days[date.getDay()],
        date: dateKey,
        tasks: dayTasks.length
          ? Math.round((dayCompleted / dayTasks.length) * 100)
          : 0,
        habits: dayHabits.length
          ? Math.round((dayHabitsDone / dayHabits.length) * 100)
          : 0,
      };
    });
  }, [tasks, habits]);

  const insight = useMemo(() => {
    const activeSources = [
      { label: "tasks", count: tasks.length, completed: completedTasks },
      { label: "habits", count: habits.length, completed: completedHabits },
      { label: "goals", count: goals.length, completed: completedGoals },
      {
        label: "planned items",
        count: planner.length,
        completed: completedPlanner,
      },
    ].filter((item) => item.count > 0);

    if (!activeSources.length) {
      return "Add tasks, habits, goals or plans to start building your personal productivity insights.";
    }

    const best = [...activeSources].sort(
      (a, b) =>
        b.completed / b.count - a.completed / a.count
    )[0];

    return `Your strongest completion area right now is ${best.label} (${Math.round(
      (best.completed / best.count) * 100
    )}%). Keep recording your progress to make these insights more useful.`;
  }, [
    tasks,
    habits,
    goals,
    planner,
    completedTasks,
    completedHabits,
    completedGoals,
    completedPlanner,
  ]);

  return (
    <div className="min-h-screen bg-[#080B18] text-white flex overflow-hidden">
      <div className="fixed top-[-180px] left-[250px] w-[450px] h-[450px] bg-violet-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="fixed bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

      <Sidebar weeklyProductivity={taskRate} />

      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto">
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Workspace</p>
            <h1 className="text-xl font-semibold mt-1">Analytics</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-400">
              {user?.name || "Your workspace"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-semibold">
              {(user?.name || "L").trim().charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="text-sm text-violet-400 font-medium mb-2">
              Review your progress
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold">
              Understand your productivity.
            </h2>
            <p className="text-slate-500 mt-2">
              Your overview is calculated from the items currently saved in
              your LifeCue workspace.
            </p>
          </div>

          {errors.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
              <p className="font-semibold mb-1">
                Some analytics data could not be loaded.
              </p>
              <p className="text-amber-100/80">
                Check that the backend is running and the corresponding API
                routes are available.
              </p>
              <ul className="mt-2 list-disc list-inside text-xs text-amber-100/70">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 underline"
              >
                Try again
              </button>
            </div>
          )}

          {loading && (
            <div className="mb-6 p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-sm text-slate-400">
              Loading your saved productivity data…
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              label="Tasks Completed"
              value={loading ? "—" : completedTasks}
              detail={`${tasks.length} total tasks saved`}
              icon="✓"
            />
            <MetricCard
              label="Task Completion"
              value={loading ? "—" : `${taskRate}%`}
              detail={`${Math.max(0, tasks.length - completedTasks)} tasks remaining`}
              icon="↗"
              iconClass="text-blue-300 bg-blue-500/10"
            />
            <MetricCard
              label="Habit Completion"
              value={loading ? "—" : `${habitRate}%`}
              detail={`${completedHabits} of ${habits.length} habits marked complete`}
              icon="◉"
              iconClass="text-emerald-300 bg-emerald-500/10"
            />
            <MetricCard
              label="Goal Completion"
              value={loading ? "—" : `${goalRate}%`}
              detail={`${completedGoals} of ${goals.length} goals marked complete`}
              icon="◇"
              iconClass="text-amber-300 bg-amber-500/10"
            />
          </div>

          <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-6 lg:p-8 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
              <div>
                <h3 className="text-xl font-semibold">Last 7 Days</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Daily task and habit completion, based on date fields returned
                  by your API.
                </p>
              </div>

              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                  Tasks
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Habits
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between gap-3 h-64">
              {weeklyData.map((item) => (
                <div
                  key={item.date}
                  className="flex-1 h-full flex flex-col items-center justify-end gap-3"
                >
                  <div className="w-full max-w-12 h-full flex items-end justify-center gap-1">
                    <div
                      className="w-1/2 rounded-t-lg bg-gradient-to-t from-violet-600 to-violet-400 transition-all"
                      style={{ height: `${item.tasks}%` }}
                      title={`${item.day} tasks: ${item.tasks}%`}
                    />
                    <div
                      className="w-1/2 rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 transition-all"
                      style={{ height: `${item.habits}%` }}
                      title={`${item.day} habits: ${item.habits}%`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{item.day}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-600 mt-4">
              A day with no dated records appears as 0%; older records without
              timestamps cannot be assigned to a specific day.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-white/[0.04] border border-white/10">
              <h3 className="text-xl font-semibold">
                Productivity Breakdown
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Completion rates for items in your workspace
              </p>

              <div className="space-y-5">
                <ProgressRow
                  label="Tasks"
                  value={taskRate}
                  colorClass="bg-violet-500"
                  detail={`${completedTasks}/${tasks.length} completed`}
                />
                <ProgressRow
                  label="Habits"
                  value={habitRate}
                  colorClass="bg-emerald-500"
                  detail={`${completedHabits}/${habits.length} completed`}
                />
                <ProgressRow
                  label="Goals"
                  value={goalRate}
                  colorClass="bg-amber-500"
                  detail={`${completedGoals}/${goals.length} completed`}
                />
                <ProgressRow
                  label="Planner items"
                  value={plannerRate}
                  colorClass="bg-blue-500"
                  detail={`${completedPlanner}/${planner.length} completed`}
                />
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-600/10 to-blue-600/10 border border-violet-500/10">
              <h3 className="text-xl font-semibold">Workspace Insights</h3>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                A summary based on your saved records
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <p className="text-sm font-medium">
                    📊 Current completion rate
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {loading
                      ? "Calculating…"
                      : `Your task completion rate is ${taskRate}%.`}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <p className="text-sm font-medium">🎯 Strongest area</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {loading ? "Reviewing your records…" : insight}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <p className="text-sm font-medium">🧭 Keep it accurate</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Mark items complete in their own pages so this dashboard
                    can reflect your updates.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-6 rounded-3xl bg-white/[0.04] border border-white/10">
            <div className="mb-6">
              <h3 className="text-xl font-semibold">
                Planned vs Completed
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Based on saved planner items. This is not a historical weekly
                comparison.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <p className="text-sm text-slate-500">Planned Items</p>
                <p className="text-2xl font-bold mt-2">
                  {loading ? "—" : planner.length}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <p className="text-sm text-slate-500">Completed</p>
                <p className="text-2xl font-bold mt-2">
                  {loading ? "—" : completedPlanner}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <p className="text-sm text-slate-500">Completion Rate</p>
                <p className="text-2xl font-bold mt-2">
                  {loading ? "—" : `${plannerRate}%`}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-4">
              Overall completion across available categories:{" "}
              {loading ? "—" : `${productivity}%`}. Categories with no saved
              records are excluded.
            </p>
          </div>

          <div className="text-center py-10">
            <p className="text-xs text-slate-600">
              LifeCue · Remember → Plan → Focus → Track → Review → Improve
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Analytics;