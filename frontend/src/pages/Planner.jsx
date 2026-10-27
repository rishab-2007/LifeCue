import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";

const days = [
  { name: "Mon", date: "1" },
  { name: "Tue", date: "2" },
  { name: "Wed", date: "3" },
  { name: "Thu", date: "4" },
  { name: "Fri", date: "5" },
  { name: "Sat", date: "6" },
  { name: "Sun", date: "7" },
];

const emptyForm = {
  title: "",
  time: "6:00 PM",
  category: "Personal",
  priority: "Medium",
};

function Planner() {
  const [plannedTasks, setPlannedTasks] = useState([]);
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const getEmail = () => {
    try {
      const user = JSON.parse(
        localStorage.getItem("lifecue_user") || "null"
      );
      return user?.email || "";
    } catch {
      return "";
    }
  };

  const loadTasks = useCallback(async () => {
    const email = getEmail();

    if (!email) {
      setError("Login session nahi mili. Please dobara login karo.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/planner?email=${encodeURIComponent(email)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Planner load nahi ho paya."
        );
      }

      setPlannedTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch (err) {
      setError(err.message || "Planner load nahi ho paya.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const addTask = async (e) => {
    e.preventDefault();

    const email = getEmail();

    if (!email) {
      setError("Login session nahi mili. Please dobara login karo.");
      return;
    }

    if (!form.title.trim()) return;

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const response = await apiFetch("/planner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          title: form.title.trim(),
          day: selectedDay,
          time: form.time,
          category: form.category,
          priority: form.priority,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Task save nahi hua."
        );
      }

      if (data.task) {
        setPlannedTasks((old) => [data.task, ...old]);
      } else {
        await loadTasks();
      }

      setForm(emptyForm);
      setShowModal(false);
      setNotice("Plan successfully save ho gaya!");
    } catch (err) {
      setError(err.message || "Task save nahi hua.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (task) => {
    const email = getEmail();

    if (!email) {
      setError("Login session nahi mili. Please dobara login karo.");
      return;
    }

    const next = !task.completed;

    setError("");
    setNotice("");

    try {
      const response = await apiFetch(
        `/planner/${encodeURIComponent(task.id)}?email=${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            completed: next,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Task update nahi hua."
        );
      }

      if (data.task) {
        setPlannedTasks((old) =>
          old.map((item) =>
            item.id === task.id ? data.task : item
          )
        );
      } else {
        await loadTasks();
      }
    } catch (err) {
      setError(err.message || "Task update nahi hua.");
    }
  };

  const deleteTask = async (taskId) => {
    const email = getEmail();

    if (!email) {
      setError("Login session nahi mili. Please dobara login karo.");
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await apiFetch(
        `/planner/${encodeURIComponent(taskId)}?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Task delete nahi hua."
        );
      }

      setPlannedTasks((old) =>
        old.filter((task) => task.id !== taskId)
      );

      setNotice("Plan delete ho gaya.");
    } catch (err) {
      setError(err.message || "Task delete nahi hua.");
    }
  };

  const currentDayTasks = useMemo(
    () => plannedTasks.filter((task) => task.day === selectedDay),
    [plannedTasks, selectedDay]
  );

  const totalTasks = plannedTasks.length;
  const completedTasks = plannedTasks.filter(
    (task) => task.completed
  ).length;
  const pendingTasks = totalTasks - completedTasks;

  const percent = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  const nav = [
    ["⌂", "Dashboard", "/dashboard"],
    ["✓", "Tasks", "/tasks"],
    ["▦", "Planner", "/planner"],
    ["◉", "Habits", "/habits"],
    ["◷", "Focus", "/focus"],
    ["◇", "Goals", "/goals"],
    ["↗", "Analytics", "/analytics"],
    ["✎", "Notes", "/notes"],
  ];

  return (
    <div className="min-h-screen bg-[#080B18] text-white flex overflow-hidden">
      <div className="fixed top-[-180px] left-[250px] w-[450px] h-[450px] bg-violet-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="fixed bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

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

          {nav.map(([icon, label, path]) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                path === "/planner"
                  ? "bg-gradient-to-r from-violet-600/20 to-blue-600/10 border border-violet-500/20 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>{icon}</span>
              <span className={path === "/planner" ? "font-medium" : ""}>
                {label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-4">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
            <p className="text-xs text-slate-500">Weekly progress</p>
            <p className="text-sm font-medium mt-1">
              {completedTasks} / {totalTasks} tasks complete
            </p>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto">
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Workspace</p>
            <h1 className="text-xl font-semibold mt-1">Planner</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-semibold">
              L
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
            <div>
              <p className="text-sm text-violet-400 font-medium mb-2">
                Plan your week
              </p>
              <h2 className="text-3xl lg:text-4xl font-bold">
                Make time for what matters.
              </h2>
              <p className="text-slate-500 mt-2">
                Organize your tasks and create a realistic weekly plan.
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-semibold text-sm shadow-lg shadow-violet-600/20 transition"
            >
              + Add to planner
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm"
            >
              {error}
              <button onClick={loadTasks} className="ml-3 underline">
                Retry
              </button>
            </div>
          )}

          {notice && (
            <div className="mb-4 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-sm">
              {notice}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Planned", value: totalTasks, sub: "This week", cls: "" },
              {
                label: "Completed",
                value: completedTasks,
                sub: "Keep going",
                cls: "text-emerald-400",
              },
              {
                label: "Remaining",
                value: pendingTasks,
                sub: "To be completed",
                cls: "text-violet-400",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-5 rounded-2xl bg-white/[0.04] border border-white/10"
              >
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className={`text-3xl font-bold mt-2 ${stat.cls}`}>
                  {loading ? "—" : stat.value}
                </p>
                <p className="text-xs text-slate-500 mt-2">{stat.sub}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 mb-6 overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {days.map((day) => (
                <button
                  key={day.name}
                  onClick={() => setSelectedDay(day.name)}
                  className={`min-w-[90px] px-4 py-3 rounded-xl transition ${
                    selectedDay === day.name
                      ? "bg-gradient-to-br from-violet-600/30 to-blue-600/20 border border-violet-500/30"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <p
                    className={`text-xs ${
                      selectedDay === day.name
                        ? "text-violet-300"
                        : "text-slate-500"
                    }`}
                  >
                    {day.name}
                  </p>
                  <p className="text-lg font-semibold mt-1">{day.date}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold">
                {selectedDay}'s schedule
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {currentDayTasks.length} planned task
                {currentDayTasks.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="text-sm text-violet-400 hover:text-violet-300"
            >
              + Add task
            </button>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="p-10 rounded-2xl bg-white/[0.04] border border-white/10 text-center text-slate-400">
                Loading planner...
              </div>
            ) : currentDayTasks.length === 0 ? (
              <div className="p-10 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
                <div className="text-4xl mb-4">📅</div>
                <h3 className="font-semibold">Nothing planned yet</h3>
                <p className="text-sm text-slate-500 mt-2">
                  Give this day some direction.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-5 px-4 py-2.5 rounded-lg bg-violet-600/20 text-violet-300 text-sm hover:bg-violet-600/30"
                >
                  + Add task
                </button>
              </div>
            ) : (
              currentDayTasks.map((task) => (
                <div
                  key={task.id}
                  className={`group p-5 rounded-2xl bg-white/[0.04] border transition ${
                    task.completed
                      ? "border-emerald-500/10"
                      : "border-white/10 hover:border-violet-500/20"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      aria-label={
                        task.completed ? "Mark incomplete" : "Mark complete"
                      }
                      onClick={() => toggleTask(task)}
                      className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center text-xs transition ${
                        task.completed
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                          : "border border-slate-600 hover:border-violet-500"
                      }`}
                    >
                      {task.completed && "✓"}
                    </button>

                    <div className="w-20 shrink-0">
                      <p className="text-sm font-medium text-slate-300">
                        {task.time}
                      </p>
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`font-medium ${
                            task.completed ? "text-slate-500 line-through" : ""
                          }`}
                        >
                          {task.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${
                            task.priority === "High"
                              ? "bg-violet-500/10 text-violet-400"
                              : task.priority === "Medium"
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {task.category}
                      </p>
                    </div>

                    <button
                      aria-label="Delete task"
                      onClick={() => deleteTask(task.id)}
                      className="opacity-60 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Weekly overview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {days.map((day) => {
                const dayTasks = plannedTasks.filter(
                  (task) => task.day === day.name
                );
                const completed = dayTasks.filter(
                  (task) => task.completed
                ).length;

                return (
                  <button
                    key={day.name}
                    onClick={() => setSelectedDay(day.name)}
                    className={`p-4 rounded-2xl bg-white/[0.04] border text-left transition ${
                      selectedDay === day.name
                        ? "border-violet-500/30"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">
                        {day.name}
                      </span>
                      <span className="text-xs text-slate-600">
                        {day.date}
                      </span>
                    </div>
                    <p className="text-2xl font-bold mt-3">
                      {dayTasks.length}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {completed} completed
                    </p>
                    <div className="w-full h-1 bg-white/10 rounded-full mt-3">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                        style={{
                          width: dayTasks.length
                            ? `${(completed / dayTasks.length) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-center py-10">
            <p className="text-xs text-slate-600">
              LifeCue · Remember → Plan → Focus → Track → Review → Improve
            </p>
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            onClick={() => !saving && setShowModal(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-lg bg-[#101426] border border-white/10 rounded-3xl p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-7">
              <div>
                <p className="text-sm text-violet-400 font-medium">
                  Weekly planner
                </p>
                <h2 className="text-2xl font-bold mt-1">
                  Add to {selectedDay}
                </h2>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
              >
                ×
              </button>
            </div>

            <form onSubmit={addTask} className="space-y-5">
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Task title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                  placeholder="What do you want to do?"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 outline-none focus:border-violet-500/60"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Day
                </label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#15192b] border border-white/10 text-white outline-none focus:border-violet-500/60"
                >
                  {days.map((day) => (
                    <option key={day.name} value={day.name}>
                      {day.name} — {day.date}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Time
                </label>
                <input
                  type="text"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  placeholder="e.g. 6:00 PM"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 outline-none focus:border-violet-500/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-[#15192b] border border-white/10 text-white outline-none"
                  >
                    <option>Personal</option>
                    <option>Learning</option>
                    <option>Development</option>
                    <option>Work</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-[#15192b] border border-white/10 text-white outline-none"
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-semibold shadow-lg shadow-violet-600/20 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Planner;