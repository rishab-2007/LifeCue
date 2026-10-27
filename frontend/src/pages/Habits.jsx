import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";

function Habits() {
  const days = [
    { short: "M", name: "Mon" },
    { short: "T", name: "Tue" },
    { short: "W", name: "Wed" },
    { short: "T", name: "Thu" },
    { short: "F", name: "Fri" },
    { short: "S", name: "Sat" },
    { short: "S", name: "Sun" },
  ];

  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem("lifecue_user") || "null");
    } catch {
      return null;
    }
  };

  const currentUser = getStoredUser();
  const email = currentUser?.email;

  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [habitName, setHabitName] = useState("");
  const [category, setCategory] = useState("Personal");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

  const showNotice = (message, type = "success") => {
    setNotice(message);
    setNoticeType(type);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const normalizeHabit = (habit) => ({
    ...habit,
    id: habit.id || habit._id,
    completed: Array.isArray(habit.completed)
      ? [...habit.completed, false, false, false, false, false, false].slice(
          0,
          7
        )
      : [false, false, false, false, false, false, false],
    streak: Number(habit.streak || 0),
  });

  // ================= LOAD HABITS =================

  useEffect(() => {
    let cancelled = false;

    const loadHabits = async () => {
      if (!email) {
        setLoading(false);
        showNotice("Please log in first to use your habits.", "error");
        return;
      }

      try {
        const response = await apiFetch(
          `/habits?email=${encodeURIComponent(email)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.detail || data.message || "Could not load habits."
          );
        }

        if (!cancelled) {
          setHabits((data.habits || []).map(normalizeHabit));
        }
      } catch (error) {
        if (!cancelled) {
          showNotice(
            error.message || "Backend se connect nahi ho paaya.",
            "error"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadHabits();

    return () => {
      cancelled = true;
    };
  }, [email]);

  // ================= ADD HABIT =================

  const addHabit = async (e) => {
    e.preventDefault();

    const trimmedName = habitName.trim();

    if (!trimmedName) {
      showNotice("Please enter a habit name.", "error");
      return;
    }

    if (!email) {
      showNotice("Please log in first to save habits.", "error");
      return;
    }

    setSaving(true);

    try {
      const response = await apiFetch("/habits", {
        method: "POST",
        body: JSON.stringify({
          email,
          name: trimmedName,
          category,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail || data.message || "Could not create habit."
        );
      }

      setHabits((previous) => [
        normalizeHabit(data.habit),
        ...previous,
      ]);

      setHabitName("");
      setCategory("Personal");
      setShowModal(false);

      showNotice("Habit saved successfully!");
    } catch (error) {
      showNotice(error.message || "Habit save nahi hua.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ================= TOGGLE DAY =================

  const toggleDay = async (habitId, dayIndex) => {
    const habit = habits.find((item) => item.id === habitId);

    if (!habit || !email) {
      showNotice("Please log in to update habits.", "error");
      return;
    }

    const updatedDays = [...habit.completed];
    updatedDays[dayIndex] = !updatedDays[dayIndex];

    const updatedHabit = {
      ...habit,
      completed: updatedDays,
      streak: updatedDays.filter(Boolean).length,
    };

    // Update UI immediately.
    setHabits((previous) =>
      previous.map((item) =>
        item.id === habitId ? updatedHabit : item
      )
    );

    try {
      const response = await apiFetch(
        `/habits/${encodeURIComponent(habitId)}?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            completed: updatedDays,
            streak: updatedHabit.streak,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail || data.message || "Could not update habit."
        );
      }

      // Keep UI synchronized with the saved database response.
      if (data.habit) {
        setHabits((previous) =>
          previous.map((item) =>
            item.id === habitId
              ? normalizeHabit(data.habit)
              : item
          )
        );
      }
    } catch (error) {
      // Revert the optimistic update if saving fails.
      setHabits((previous) =>
        previous.map((item) =>
          item.id === habitId ? habit : item
        )
      );

      showNotice(error.message || "Habit update nahi hua.", "error");
    }
  };

  // ================= DELETE HABIT =================

  const deleteHabit = async (habitId) => {
    if (!email) {
      showNotice("Please log in first.", "error");
      return;
    }

    const shouldDelete = window.confirm(
      "Are you sure you want to delete this habit?"
    );

    if (!shouldDelete) return;

    const previousHabits = habits;

    setHabits((previous) =>
      previous.filter((habit) => habit.id !== habitId)
    );

    try {
      const response = await apiFetch(
        `/habits/${encodeURIComponent(habitId)}?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail || data.message || "Could not delete habit."
        );
      }

      showNotice("Habit deleted successfully.");
    } catch (error) {
      setHabits(previousHabits);

      showNotice(error.message || "Habit delete nahi hua.", "error");
    }
  };

  // ================= STATS =================

  const totalHabits = habits.length;

  // JavaScript: Sunday = 0, Monday = 1, ... Saturday = 6.
  // Convert to Monday-based weekly index.
  const todayIndex = (new Date().getDay() + 6) % 7;

  const completedToday = habits.filter(
    (habit) => habit.completed[todayIndex]
  ).length;

  const totalCompleted = habits.reduce(
    (total, habit) =>
      total + habit.completed.filter(Boolean).length,
    0
  );

  const totalPossible = habits.length * 7;

  const weeklyPercentage =
    totalPossible === 0
      ? 0
      : Math.round((totalCompleted / totalPossible) * 100);

  // ================= UI =================

  return (
    <div className="min-h-screen bg-[#080B18] text-white flex overflow-hidden">
      {/* BACKGROUND */}

      <div className="fixed top-[-180px] left-[250px] w-[450px] h-[450px] bg-violet-600/10 rounded-full blur-[130px]" />

      <div className="fixed bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px]" />

      {/* SIDEBAR */}

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

          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>⌂</span>
            Dashboard
          </Link>

          <Link
            to="/tasks"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>✓</span>
            Tasks
          </Link>

          <Link
            to="/planner"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>▦</span>
            Planner
          </Link>

          <Link
            to="/habits"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600/20 to-blue-600/10 border border-violet-500/20 text-white"
          >
            <span>◉</span>
            <span className="font-medium">Habits</span>
          </Link>

          <Link
            to="/focus"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>◷</span>
            Focus
          </Link>

          <Link
            to="/goals"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>◇</span>
            Goals
          </Link>

          <Link
            to="/analytics"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>↗</span>
            Analytics
          </Link>

          <Link
            to="/notes"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>✎</span>
            Notes
          </Link>
        </nav>

        {/* SIDEBAR BOTTOM */}

        <div className="mt-auto p-4">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
            <p className="text-xs text-slate-500">Weekly consistency</p>

            <p className="text-sm font-medium mt-1">
              {weeklyPercentage}% complete
            </p>

            <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all"
                style={{ width: `${weeklyPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto">
        {/* TOPBAR */}

        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Workspace</p>

            <h1 className="text-xl font-semibold mt-1">Habits</h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Notifications"
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-white/10"
            >
              ♢
            </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-semibold">
              {(currentUser?.name || "R").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* CONTENT */}

        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          {notice && (
            <div
              role="status"
              className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                noticeType === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {notice}
            </div>
          )}

          {loading && (
            <div className="mb-5 text-sm text-slate-400">
              Loading your habits from database...
            </div>
          )}

          {/* HEADER */}

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
            <div>
              <p className="text-sm text-violet-400 font-medium mb-2">
                Build consistency
              </p>

              <h2 className="text-3xl lg:text-4xl font-bold">
                Small actions. Big change.
              </h2>

              <p className="text-slate-500 mt-2">
                Track the habits that move you forward.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-semibold text-sm shadow-lg shadow-violet-600/20 transition"
            >
              + New habit
            </button>
          </div>

          {/* STATS */}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Active habits</p>

              <p className="text-3xl font-bold mt-2">{totalHabits}</p>

              <p className="text-xs text-slate-500 mt-2">Building daily</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Today</p>

              <p className="text-3xl font-bold mt-2 text-emerald-400">
                {completedToday}
              </p>

              <p className="text-xs text-slate-500 mt-2">Completed</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Weekly</p>

              <p className="text-3xl font-bold mt-2 text-violet-400">
                {weeklyPercentage}%
              </p>

              <p className="text-xs text-slate-500 mt-2">Consistency</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Best streak</p>

              <p className="text-3xl font-bold mt-2">
                {Math.max(0, ...habits.map((habit) => habit.streak))}
              </p>

              <p className="text-xs text-slate-500 mt-2">Days</p>
            </div>
          </div>

          {/* HABITS TABLE */}

          <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Your habits</h3>

                <p className="text-xs text-slate-500 mt-1">
                  Track your weekly consistency
                </p>
              </div>

              <span className="text-xs text-slate-500">This week</span>
            </div>

            <div className="divide-y divide-white/5">
              {habits.map((habit) => (
                <div
                  key={habit.id}
                  className="p-5 hover:bg-white/[0.02] transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                    {/* HABIT INFO */}

                    <div className="lg:w-64 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/10 flex items-center justify-center">
                          ◉
                        </div>

                        <div>
                          <h4 className="font-medium">{habit.name}</h4>

                          <p className="text-xs text-slate-500 mt-1">
                            {habit.category}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* DAYS */}

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {days.map((day, index) => (
                          <div
                            key={`${habit.id}-${index}`}
                            className="flex-1 text-center"
                          >
                            <p className="text-[10px] text-slate-600 mb-2">
                              {day.short}
                            </p>

                            <button
                              type="button"
                              aria-label={`${habit.name}: ${day.name}`}
                              aria-pressed={habit.completed[index]}
                              onClick={() => toggleDay(habit.id, index)}
                              className={`mx-auto w-9 h-9 rounded-xl flex items-center justify-center text-xs transition ${
                                habit.completed[index]
                                  ? "bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-500/10"
                                  : "bg-white/5 border border-white/10 text-slate-600 hover:border-violet-500/40"
                              }`}
                            >
                              {habit.completed[index] ? "✓" : ""}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* STREAK */}

                    <div className="lg:w-24 shrink-0 text-center">
                      <div className="text-lg">🔥</div>

                      <p className="text-sm font-semibold">{habit.streak}</p>

                      <p className="text-[10px] text-slate-600">streak</p>
                    </div>

                    {/* DELETE */}

                    <button
                      type="button"
                      onClick={() => deleteHabit(habit.id)}
                      className="text-slate-600 hover:text-red-400 transition"
                      title="Delete habit"
                      aria-label={`Delete ${habit.name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}

              {!loading && habits.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-4">◉</div>

                  <h3 className="font-semibold">No habits yet</h3>

                  <p className="text-sm text-slate-500 mt-2">
                    Start with one small habit.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* MOTIVATION */}

          <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-violet-600/10 to-blue-600/10 border border-violet-500/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  Consistency beats intensity.
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  Focus on showing up every day. Progress follows.
                </p>
              </div>

              <div className="text-2xl">🔥</div>
            </div>
          </div>

          {/* FOOTER */}

          <div className="text-center py-10">
            <p className="text-xs text-slate-600">
              LifeCue · Remember → Plan → Focus → Track → Review → Improve
            </p>
          </div>
        </div>
      </main>

      {/* ADD HABIT MODAL */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            onClick={() => !saving && setShowModal(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md bg-[#101426] border border-white/10 rounded-3xl p-7 shadow-2xl">
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between mb-7">
              <div>
                <p className="text-sm text-violet-400 font-medium">
                  Habit tracker
                </p>

                <h2 className="text-2xl font-bold mt-1">Create a habit</h2>
              </div>

              <button
                type="button"
                onClick={() => !saving && setShowModal(false)}
                disabled={saving}
                className="w-9 h-9 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {/* FORM */}

            <form onSubmit={addHabit} className="space-y-5">
              <div>
                <label
                  htmlFor="habitName"
                  className="block text-sm text-slate-300 mb-2"
                >
                  Habit name
                </label>

                <input
                  id="habitName"
                  type="text"
                  value={habitName}
                  onChange={(e) => setHabitName(e.target.value)}
                  placeholder="e.g. Read for 20 minutes"
                  maxLength={120}
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 outline-none focus:border-violet-500/60"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="habitCategory"
                  className="block text-sm text-slate-300 mb-2"
                >
                  Category
                </label>

                <select
                  id="habitCategory"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#15192b] border border-white/10 text-white outline-none focus:border-violet-500/60"
                >
                  <option value="Personal">Personal</option>
                  <option value="Learning">Learning</option>
                  <option value="Health">Health</option>
                  <option value="Development">Development</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !saving && setShowModal(false)}
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-semibold shadow-lg shadow-violet-600/20 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Create habit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Habits;