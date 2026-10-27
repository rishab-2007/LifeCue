import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";

const emptyGoal = {
  title: "",
  category: "Development",
  target: "",
  deadline: "",
};

function Goals() {
  const [goals, setGoals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newGoal, setNewGoal] = useState(emptyGoal);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingGoalId, setUpdatingGoalId] = useState(null);
  const [deletingGoalId, setDeletingGoalId] = useState(null);

  const getUserEmail = () => {
    try {
      const user = JSON.parse(
        localStorage.getItem("lifecue_user") || "null"
      );

      return user?.email || "";
    } catch {
      return "";
    }
  };

  const getErrorMessage = async (response) => {
    try {
      const data = await response.json();

      if (typeof data.detail === "string") return data.detail;
      if (typeof data.message === "string") return data.message;

      if (Array.isArray(data.detail)) {
        return data.detail
          .map((item) => item.msg || "Invalid input")
          .join(", ");
      }

      return `Request failed (${response.status}).`;
    } catch {
      return `Request failed (${response.status}).`;
    }
  };

  const loadGoals = useCallback(async () => {
    const email = getUserEmail();

    if (!email) {
      setError(
        "User details nahi mile. Please logout karke dobara login karo."
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/goals?email=${encodeURIComponent(email)}`
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.message || "Goals load nahi ho paaye.");
      }

      setGoals(
        (Array.isArray(data.goals) ? data.goals : []).map((goal) => ({
          ...goal,
          progress: Math.min(
            100,
            Math.max(0, Number(goal.progress) || 0)
          ),
        }))
      );
    } catch (err) {
      setError(
        err.message || "Backend se connect nahi ho paaya. Backend check karo."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const addGoal = async (event) => {
    event.preventDefault();

    if (!newGoal.title.trim()) {
      setError("Goal title enter karo.");
      return;
    }

    const email = getUserEmail();

    if (!email) {
      setError("User details nahi mile. Please dobara login karo.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const response = await apiFetch("/goals", {
        method: "POST",
        body: JSON.stringify({
          email,
          title: newGoal.title.trim(),
          category: newGoal.category,
          target: newGoal.target.trim() || "Complete this goal",
          deadline: newGoal.deadline.trim() || "No deadline",
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      if (data.success === false || !data.goal) {
        throw new Error(data.message || "Goal save nahi hua.");
      }

      const savedGoal = {
        ...data.goal,
        progress: Math.min(
          100,
          Math.max(0, Number(data.goal.progress) || 0)
        ),
      };

      setGoals((current) => [savedGoal, ...current]);
      setNewGoal(emptyGoal);
      setShowModal(false);
      setNotice("Goal successfully save ho gaya.");
    } catch (err) {
      setError(err.message || "Goal save nahi ho paaya.");
    } finally {
      setSaving(false);
    }
  };

  const increaseProgress = async (goal) => {
    if (updatingGoalId !== null || goal.progress >= 100) return;

    const email = getUserEmail();

    if (!email) {
      setError("User details nahi mile. Please dobara login karo.");
      return;
    }

    const progress = Math.min(
      100,
      Math.max(0, Number(goal.progress) || 0) + 10
    );

    try {
      setUpdatingGoalId(goal.id);
      setError("");
      setNotice("");

      const response = await apiFetch(
        `/goals/${encodeURIComponent(goal.id)}?email=${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ progress }),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      if (data.success === false || !data.goal) {
        throw new Error(data.message || "Progress update nahi hua.");
      }

      setGoals((current) =>
        current.map((item) =>
          item.id === goal.id
            ? {
                ...data.goal,
                progress: Math.min(
                  100,
                  Math.max(0, Number(data.goal.progress) || 0)
                ),
              }
            : item
        )
      );

      setNotice("Goal progress successfully update ho gaya.");
    } catch (err) {
      setError(err.message || "Progress update nahi ho paaya.");
    } finally {
      setUpdatingGoalId(null);
    }
  };

  const deleteGoal = async (goalId) => {
    if (deletingGoalId !== null) return;

    const email = getUserEmail();

    if (!email) {
      setError("User details nahi mile. Please dobara login karo.");
      return;
    }

    const confirmed = window.confirm(
      "Kya tum sach mein is goal ko delete karna chahte ho?"
    );

    if (!confirmed) return;

    try {
      setDeletingGoalId(goalId);
      setError("");
      setNotice("");

      const response = await apiFetch(
        `/goals/${encodeURIComponent(goalId)}?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.message || "Goal delete nahi hua.");
      }

      setGoals((current) =>
        current.filter((goal) => goal.id !== goalId)
      );

      setNotice("Goal successfully delete ho gaya.");
    } catch (err) {
      setError(err.message || "Goal delete nahi ho paaya.");
    } finally {
      setDeletingGoalId(null);
    }
  };

  const completedGoals = goals.filter(
    (goal) => Number(goal.progress) >= 100
  ).length;

  const averageProgress = goals.length
    ? Math.round(
        goals.reduce(
          (sum, goal) => sum + (Number(goal.progress) || 0),
          0
        ) / goals.length
      )
    : 0;

  const navClass =
    "flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition";

  const activeClass =
    "flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600/20 to-blue-600/10 border border-violet-500/20 text-white";

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
          <Link to="/dashboard" className={navClass}><span>⌂</span>Dashboard</Link>
          <Link to="/tasks" className={navClass}><span>✓</span>Tasks</Link>
          <Link to="/planner" className={navClass}><span>▦</span>Planner</Link>
          <Link to="/habits" className={navClass}><span>◉</span>Habits</Link>
          <Link to="/focus" className={navClass}><span>◷</span>Focus</Link>
          <Link to="/goals" className={activeClass}><span>◇</span><span className="font-medium">Goals</span></Link>
          <Link to="/analytics" className={navClass}><span>↗</span>Analytics</Link>
          <Link to="/notes" className={navClass}><span>✎</span>Notes</Link>
        </nav>

        <div className="mt-auto p-4">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
            <p className="text-xs text-slate-500">Goal progress</p>
            <p className="text-lg font-semibold mt-1">{averageProgress}%</p>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all"
                style={{ width: `${averageProgress}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto">
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Workspace</p>
            <h1 className="text-xl font-semibold mt-1">Goals</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-semibold">
              L
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
            <div>
              <p className="text-sm text-violet-400 font-medium mb-2">
                Think bigger
              </p>
              <h2 className="text-3xl lg:text-4xl font-bold">
                Turn plans into progress.
              </h2>
              <p className="text-slate-500 mt-2">
                Set meaningful goals and track how far you've come.
              </p>
            </div>

            <button
              onClick={() => {
                setError("");
                setNotice("");
                setShowModal(true);
              }}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-medium shadow-lg shadow-violet-600/20 transition"
            >
              + New Goal
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
              <button
                className="ml-3 underline"
                onClick={() => setError("")}
              >
                Dismiss
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
            >
              {notice}
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Total Goals</p>
              <p className="text-3xl font-bold mt-2">{goals.length}</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Completed</p>
              <p className="text-3xl font-bold mt-2 text-emerald-400">
                {completedGoals}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Average Progress</p>
              <p className="text-3xl font-bold mt-2 text-violet-300">
                {averageProgress}%
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400">
              Loading your goals…
            </div>
          ) : goals.length > 0 ? (
            <div className="space-y-4">
              {goals.map((goal) => {
                const progress = Math.min(
                  100,
                  Math.max(0, Number(goal.progress) || 0)
                );

                return (
                  <div
                    key={goal.id}
                    className="p-6 rounded-3xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.055] transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold">
                            {goal.title}
                          </h3>

                          <span className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs">
                            {goal.category}
                          </span>

                          {progress === 100 && (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                              Completed
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-slate-500 mt-2">
                          {goal.target}
                        </p>

                        <div className="mt-5">
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-slate-500">Progress</span>
                            <span className="text-slate-300">
                              {progress}%
                            </span>
                          </div>

                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:w-40 shrink-0">
                        <div className="text-sm text-slate-500">
                          Deadline
                          <span className="block text-white mt-1">
                            {goal.deadline || "No deadline"}
                          </span>
                        </div>

                        <button
                          onClick={() => increaseProgress(goal)}
                          disabled={
                            progress >= 100 || updatingGoalId !== null
                          }
                          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 disabled:opacity-40 transition"
                        >
                          {updatingGoalId === goal.id
                            ? "Updating…"
                            : "+10% Progress"}
                        </button>

                        <button
                          onClick={() => deleteGoal(goal.id)}
                          disabled={deletingGoalId !== null}
                          className="px-4 py-2 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400 text-sm hover:bg-red-500/10 disabled:opacity-40 transition"
                        >
                          {deletingGoalId === goal.id
                            ? "Deleting…"
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 rounded-3xl bg-white/[0.03] border border-white/10">
              <div className="text-4xl mb-4">◇</div>
              <h3 className="text-lg font-semibold">No goals yet</h3>
              <p className="text-sm text-slate-500 mt-2">
                Create your first goal and start making progress.
              </p>
            </div>
          )}

          <div className="text-center py-10">
            <p className="text-xs text-slate-600">
              LifeCue · Remember → Plan → Focus → Track → Review → Improve
            </p>
          </div>
        </div>
      </main>

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowModal(false);
            }
          }}
        >
          <form
            onSubmit={addGoal}
            className="w-full max-w-lg rounded-3xl bg-[#101426] border border-white/10 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold">Create New Goal</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Define something you want to achieve.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-lg bg-white/5 text-slate-400 hover:text-white disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  className="text-xs text-slate-400"
                  htmlFor="goal-title"
                >
                  Goal title
                </label>
                <input
                  id="goal-title"
                  type="text"
                  value={newGoal.title}
                  onChange={(event) =>
                    setNewGoal({
                      ...newGoal,
                      title: event.target.value,
                    })
                  }
                  placeholder="e.g. Learn React"
                  maxLength={200}
                  required
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 text-sm"
                />
              </div>

              <div>
                <label
                  className="text-xs text-slate-400"
                  htmlFor="goal-category"
                >
                  Category
                </label>
                <select
                  id="goal-category"
                  value={newGoal.category}
                  onChange={(event) =>
                    setNewGoal({
                      ...newGoal,
                      category: event.target.value,
                    })
                  }
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-[#15192b] border border-white/10 outline-none text-sm"
                >
                  <option>Development</option>
                  <option>Learning</option>
                  <option>Personal</option>
                  <option>Health</option>
                  <option>Career</option>
                </select>
              </div>

              <div>
                <label
                  className="text-xs text-slate-400"
                  htmlFor="goal-target"
                >
                  Target
                </label>
                <input
                  id="goal-target"
                  type="text"
                  value={newGoal.target}
                  onChange={(event) =>
                    setNewGoal({
                      ...newGoal,
                      target: event.target.value,
                    })
                  }
                  placeholder="e.g. Complete 3 projects"
                  maxLength={500}
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 text-sm"
                />
              </div>

              <div>
                <label
                  className="text-xs text-slate-400"
                  htmlFor="goal-deadline"
                >
                  Deadline
                </label>
                <input
                  id="goal-deadline"
                  type="text"
                  value={newGoal.deadline}
                  onChange={(event) =>
                    setNewGoal({
                      ...newGoal,
                      deadline: event.target.value,
                    })
                  }
                  placeholder="e.g. Oct 30"
                  maxLength={100}
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 font-medium text-sm disabled:opacity-50"
              >
                {saving ? "Saving…" : "Create Goal"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Goals;