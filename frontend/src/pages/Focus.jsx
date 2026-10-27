import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
const FOCUS_GUARD_EXTENSION_ID =
  "nnlcnofkhdkbccgbplaobbmcdbkndoee";

function sendToFocusGuard(message) {
  return new Promise((resolve) => {
    const runtime = globalThis.chrome?.runtime;

    if (typeof runtime?.sendMessage !== "function") {
      resolve({
        ok: false,
        error: "Chrome extension API is unavailable on this page.",
      });
      return;
    }

    try {
      runtime.sendMessage(
        FOCUS_GUARD_EXTENSION_ID,
        message,
        (response) => {
          const error = runtime.lastError;

          if (error) {
            resolve({
              ok: false,
              error: error.message,
            });
            return;
          }

          if (!response) {
            resolve({
              ok: false,
              error: "Focus Guard returned no response.",
            });
            return;
          }

          resolve(response);
        }
      );
    } catch (error) {
      resolve({
        ok: false,
        error: error.message || "Focus Guard connection failed.",
      });
    }
  });
}

async function saveFocusGuardSettings(selectedDomains, customSites) {
  const response = await sendToFocusGuard({
    type: "SAVE_SETTINGS",
    selectedDomains,
    customSites,
  });

  if (!response?.ok) {
    console.error(
      "Focus Guard settings save failed:",
      response?.error || "Extension not connected"
    );
    return false;
  }

  return true;
}

const USER_STORAGE_KEY = "lifecue_user";

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getLocalDateKey(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function Focus() {
  const [user] = useState(getStoredUser);
  const email = user?.email || "";

  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  const [blockedDomains, setBlockedDomains] = useState([]);
  const [customSites, setCustomSites] = useState([]);
const [newSite, setNewSite] = useState("");

const [extensionStatus, setExtensionStatus] = useState(
  "Checking extension..."
);

  const [completedSessions, setCompletedSessions] = useState(0);
  const [focusMinutes, setFocusMinutes] = useState(0);
  const [sessions, setSessions] = useState([]);

  const [loadingStats, setLoadingStats] = useState(true);
  const [savingSession, setSavingSession] = useState(false);
  const [apiError, setApiError] = useState("");
  const [notice, setNotice] = useState("");
  const [customMinutes, setCustomMinutes] = useState("30");

  const [completionPending, setCompletionPending] = useState(false);

  const sessionStartedAtRef = useRef(null);
  const completionHandledRef = useRef(false);
  const savingRef = useRef(false);

  // ================= LOAD FOCUS SESSIONS =================

  const loadSessions = useCallback(async () => {
    if (!email) {
      setApiError("Login details nahi mile. Please dobara login karo.");
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);

    try {
      const response = await apiFetch(
        `/focus-sessions?email=${encodeURIComponent(email)}`
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || `Server error (${response.status})`
        );
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.sessions)
          ? data.sessions
          : [];

      setSessions(list);

      const todayKey = getLocalDateKey(new Date());

      const todaysSessions = list.filter((session) => {
        if (!session.completed) return false;

        const completedAt =
          session.completed_at || session.completedAt || session.date;

        return getLocalDateKey(completedAt) === todayKey;
      });

      setCompletedSessions(todaysSessions.length);

      const totalMinutes = todaysSessions.reduce((sum, session) => {
        const duration = Number(
          session.duration_minutes ?? session.minutes ?? 0
        );

        return sum + (Number.isFinite(duration) ? duration : 0);
      }, 0);

      setFocusMinutes(totalMinutes);
      setApiError("");
    } catch (error) {
      console.error("Load focus sessions failed:", error);

      setApiError(
        error.message ||
          "Focus sessions load nahi ho paaye. Backend check karo."
      );
    } finally {
      setLoadingStats(false);
    }
  }, [email]);

  useEffect(() => {
  let cancelled = false;

  async function checkExtension() {
  const response = await sendToFocusGuard({
    type: "GET_STATE",
  });

  if (cancelled) return;

  if (!response?.ok) {
    setExtensionStatus("Focus Guard not connected");
    return;
  }

  const session = response.session;

  if (session?.active && Array.isArray(session.domains)) {
    setBlockedDomains(session.domains);
    setExtensionStatus("Focus Guard session active");
  } else {
    setExtensionStatus("Focus Guard connected");
  }

  const settings = await sendToFocusGuard({
    type: "GET_SETTINGS",
  });

  if (settings?.ok) {
  setCustomSites(
    Array.isArray(settings.customSites)
      ? settings.customSites
      : []
  );

  // Active session ke selected domains ko preserve karo.
  if (!session?.active) {
    setBlockedDomains(
      Array.isArray(settings.selectedDomains)
        ? settings.selectedDomains
        : []
    );
  }
}
}

  checkExtension();

  return () => {
    cancelled = true;
  };
}, []);

  // ================= TIMER =================

  useEffect(() => {
    if (!isRunning) return undefined;

    const timerId = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timerId);

          setIsRunning(false);
          setCompletionPending(true);
          setNotice("Session complete! Saving your focus time...");

          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isRunning]);

  // ================= SAVE COMPLETED SESSION =================

  const saveCompletedSession = useCallback(async () => {
    if (!email) {
      setApiError("Login details nahi mile. Please dobara login karo.");
      setNotice("");
      return;
    }

    // Prevent duplicate requests for the same completion.
    if (completionHandledRef.current || savingRef.current) {
      return;
    }

    completionHandledRef.current = true;
    savingRef.current = true;

    setSavingSession(true);
    setApiError("");
    setNotice("Session complete! Saving your focus time...");

    try {
      const response = await apiFetch("/focus-sessions", {
        method: "POST",
        body: JSON.stringify({
          email,
          duration_minutes: selectedMinutes,
          completed: true,
          started_at: sessionStartedAtRef.current,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || `Server error (${response.status})`
        );
      }

      setNotice("Focus session saved successfully! 🎉");

      // Read back saved data from the backend.
      await loadSessions();
    } catch (error) {
      console.error("Save focus session failed:", error);

      setApiError(
        error.message ||
          "Session database mein save nahi hua. Backend check karo."
      );

      setNotice("");
    } finally {
      savingRef.current = false;
      setSavingSession(false);
      setCompletionPending(false);
    }
  }, [email, selectedMinutes, loadSessions]);

  useEffect(() => {
    if (secondsLeft === 0 && completionPending && !savingSession) {
      saveCompletedSession();
    }
  }, [
    secondsLeft,
    completionPending,
    savingSession,
    saveCompletedSession,
  ]);

  // ================= TIMER CONTROLS =================

  const changeSession = (value) => {
    const newMinutes = Number(value);

    if (
      !Number.isInteger(newMinutes) ||
      newMinutes < 1 ||
      newMinutes > 180
    ) {
      return;
    }

    if (savingRef.current) return;

    setIsRunning(false);
    setCompletionPending(false);
    setSelectedMinutes(newMinutes);
    setSecondsLeft(newMinutes * 60);

    sessionStartedAtRef.current = null;
    completionHandledRef.current = false;

    setNotice("");
    setApiError("");
  };

  const resetTimer = () => {
    if (savingRef.current) return;

    setIsRunning(false);
    setCompletionPending(false);
    setSecondsLeft(selectedMinutes * 60);

    sessionStartedAtRef.current = null;
    completionHandledRef.current = false;

    setNotice("");
    setApiError("");
  };

  const toggleTimer = async () => {
  if (savingRef.current || completionPending) return;

  if (secondsLeft === 0) {
    setSecondsLeft(selectedMinutes * 60);
    completionHandledRef.current = false;
    sessionStartedAtRef.current = null;
    setNotice("");
    setApiError("");
    return;
  }

  // Pause the website timer and stop extension blocking.
  if (isRunning) {
    const response = await sendToFocusGuard({
      type: "STOP_SESSION"
    });

    setIsRunning(false);

    if (response?.ok) {
      setExtensionStatus("Focus Guard connected");
      setNotice("Focus timer paused. Website blocking stopped.");
    } else {
      setExtensionStatus("Focus Guard connection issue");
      setNotice(
        "Timer paused, but extension blocking may still be active. " +
        (response?.error || "")
      );
    }

    return;
  }

  // Require at least one website when starting a new session.
  if (blockedDomains.length === 0) {
    setNotice("Select at least one website to block.");
    return;
  }

  const durationMinutes = Math.max(
    1,
    Math.ceil(secondsLeft / 60)
  );

  const response = await sendToFocusGuard({
    type: "START_SESSION",
    durationMinutes,
    domains: blockedDomains
  });

  if (!response?.ok) {
    setExtensionStatus("Focus Guard not connected");
    setNotice(
      "Could not start website blocking. " +
      (response?.error || "Check that the extension is installed and enabled.")
    );
    return;
  }

  if (!sessionStartedAtRef.current) {
    sessionStartedAtRef.current = new Date().toISOString();
  }

  setExtensionStatus("Focus Guard session active");
  setNotice("Focus session started. Selected websites are being blocked.");
  setIsRunning(true);
};

  const applyCustomMinutes = () => {
    const value = Number(customMinutes);

    if (!Number.isInteger(value) || value < 1 || value > 180) {
      setNotice("Custom duration 1 se 180 minutes ke beech rakho.");
      return;
    }

    changeSession(value);
  };

  // ================= DISPLAY VALUES =================

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");

  const totalSeconds = selectedMinutes * 60;

  const progress =
    totalSeconds === 0
      ? 0
      : ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  const todayGoalProgress = Math.min((focusMinutes / 120) * 100, 100);

  // ================= UI =================

  return (
    <div className="min-h-screen bg-[#080B18] text-white flex overflow-hidden">
      <div className="fixed top-[-180px] left-[250px] w-[450px] h-[450px] bg-violet-600/10 rounded-full blur-[130px]" />
      <div className="fixed bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px]" />

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

          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>⌂</span>Dashboard
          </Link>

          <Link to="/tasks" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>✓</span>Tasks
          </Link>

          <Link to="/planner" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>▦</span>Planner
          </Link>

          <Link to="/habits" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>◉</span>Habits
          </Link>

          <Link to="/focus" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600/20 to-blue-600/10 border border-violet-500/20 text-white">
            <span>◷</span>
            <span className="font-medium">Focus</span>
          </Link>

          <Link to="/goals" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>◇</span>Goals
          </Link>

          <Link to="/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>↗</span>Analytics
          </Link>

          <Link to="/notes" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>✎</span>Notes
          </Link>
        </nav>

        <div className="mt-auto p-4">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
            <p className="text-xs text-slate-500">Today's focus</p>
            <p className="text-lg font-semibold mt-1">
              {focusMinutes} min
            </p>

            <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                style={{ width: `${todayGoalProgress}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto">
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Workspace</p>
            <h1 className="text-xl font-semibold mt-1">Focus</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm text-slate-300">
                {user?.name || "LifeCue User"}
              </p>
              <p className="text-xs text-slate-600">Focus workspace</p>
            </div>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-semibold">
              {(user?.name || "R").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="text-sm text-violet-400 font-medium mb-2">
              Deep work mode
            </p>

            <h2 className="text-3xl lg:text-4xl font-bold">
              Protect your attention.
            </h2>

            <p className="text-slate-500 mt-2">
              Focus on one thing. Let LifeCue handle the time.
            </p>
          </div>
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
  <h3 className="text-lg font-semibold">
    Focus Guard
  </h3>

  <p className="mt-2 text-sm text-slate-400">
    Choose the websites you want blocked during your focus session.
  </p>

  <p className="mt-2 text-xs text-violet-300">
    {extensionStatus}
  </p>

 <div className="mt-4 flex flex-wrap gap-4">
  {[
    { label: "YouTube", domain: "youtube.com" },
    { label: "Instagram", domain: "instagram.com" },
    { label: "Facebook", domain: "facebook.com" },
    { label: "Reddit", domain: "reddit.com" },
    { label: "X", domain: "x.com" },
    { label: "TikTok", domain: "tiktok.com" },
    ...customSites.map((domain) => ({
      label: domain,
      domain: domain,
      isCustom: true,
    })),
  ].map((site) => (
    <div
      key={site.domain}
      className="flex items-center gap-2"
    >
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={blockedDomains.includes(site.domain)}
          disabled={isRunning}
          onChange={async (event) => {
            const updatedDomains = event.target.checked
              ? [...new Set([...blockedDomains, site.domain])]
              : blockedDomains.filter(
                  (domain) => domain !== site.domain
                );

            setBlockedDomains(updatedDomains);

            const saved = await saveFocusGuardSettings(
              updatedDomains,
              customSites
            );

            setExtensionStatus(
              saved
                ? "Focus Guard settings synced"
                : "Could not sync Focus Guard settings"
            );
          }}
          className="accent-violet-500"
        />

        {site.label}
      </label>

      {site.isCustom && (
        <button
          type="button"
          disabled={isRunning}
          onClick={async () => {
            const updatedCustomSites = customSites.filter(
              (domain) => domain !== site.domain
            );

            const updatedDomains = blockedDomains.filter(
              (domain) => domain !== site.domain
            );

            const saved = await saveFocusGuardSettings(
              updatedDomains,
              updatedCustomSites
            );

            if (saved) {
              setCustomSites(updatedCustomSites);
              setBlockedDomains(updatedDomains);
              setExtensionStatus("Custom website deleted");
            } else {
              setExtensionStatus(
                "Could not delete website: extension not connected"
              );
            }
          }}
          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
  ))}
</div>
    <div className="mt-5 border-t border-white/10 pt-4">
  <label className="mb-2 block text-sm font-medium text-slate-300">
    Add a custom website
  </label>

  <div className="flex flex-wrap gap-2">
    <input
      type="text"
      value={newSite}
      onChange={(event) => setNewSite(event.target.value)}
      placeholder="example.com"
      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
    />

    <button
      type="button"
      onClick={async () => {
        const input = newSite.trim();

        if (!input) return;

        let domain;

        try {
          const url = new URL(
            /^https?:\/\//i.test(input)
              ? input
              : `https://${input}`
          );

          domain = url.hostname.toLowerCase().replace(/^www\./, "");

          if (
            !domain.includes(".") ||
            !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)
          ) {
            throw new Error("Invalid domain");
          }
        } catch {
          setExtensionStatus("Enter a valid domain, e.g. example.com");
          return;
        }

        const updatedCustomSites = [
          ...new Set([...customSites, domain]),
        ];

        setCustomSites(updatedCustomSites);

        const saved = await saveFocusGuardSettings(
          blockedDomains,
          updatedCustomSites
        );

        setExtensionStatus(
          saved
            ? "Custom website saved"
            : "Could not sync custom website"
        );

        setNewSite("");
      }}
      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
    >
      Add
    </button>
  </div>
</div>
  </div>

          {apiError && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {apiError}
              <button
                onClick={loadSessions}
                className="ml-3 underline hover:text-white"
              >
                Retry
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-200"
            >
              {notice}
            </div>
          )}

          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
            <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-8 lg:p-12 relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px]" />

              <div className="relative text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs mb-10">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRunning
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-slate-500"
                    }`}
                  />

                  {isRunning
                    ? "Focus session active"
                    : secondsLeft === 0
                      ? "Session completed"
                      : "Ready to focus"}
                </div>

                <div className="text-7xl sm:text-8xl lg:text-9xl font-bold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                  {formattedMinutes}
                  <span className="text-violet-400">:</span>
                  {formattedSeconds}
                </div>

                <div className="max-w-md mx-auto mt-10">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-center items-center gap-4 mt-10">
                  <button
                    onClick={resetTimer}
                    disabled={savingSession}
                    className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
                    title="Reset"
                    aria-label="Reset timer"
                  >
                    ↻
                  </button>

                  <button
                    onClick={toggleTimer}
                    disabled={savingSession || completionPending}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 flex items-center justify-center text-xl shadow-xl shadow-violet-600/20 transition disabled:opacity-50"
                    aria-label={isRunning ? "Pause timer" : "Start timer"}
                  >
                    {isRunning ? "Ⅱ" : "▶"}
                  </button>

                  <div className="w-12 h-12" />
                </div>

                <div className="flex flex-wrap justify-center gap-2 mt-8">
                  {[15, 25, 45, 60].map((option) => (
                    <button
                      key={option}
                      onClick={() => changeSession(option)}
                      disabled={savingSession}
                      className={`px-4 py-2 rounded-lg text-xs transition ${
                        selectedMinutes === option
                          ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                          : "bg-white/5 border border-transparent text-slate-500 hover:text-white"
                      } disabled:opacity-50`}
                    >
                      {option} min
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mt-4">
                  <label
                    htmlFor="custom-minutes"
                    className="text-xs text-slate-500"
                  >
                    Custom (1–180 min)
                  </label>

                  <input
                    id="custom-minutes"
                    type="number"
                    min="1"
                    max="180"
                    value={customMinutes}
                    onChange={(event) =>
                      setCustomMinutes(event.target.value)
                    }
                    className="w-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  />

                  <button
                    onClick={applyCustomMinutes}
                    disabled={savingSession}
                    className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-white/[0.04] border border-white/10">
                <p className="text-sm text-slate-500">Today's focus</p>

                <div className="flex items-end gap-2 mt-3">
                  <span className="text-4xl font-bold">
                    {focusMinutes}
                  </span>
                  <span className="text-slate-500 mb-1">minutes</span>
                </div>

                <div className="h-2 bg-white/10 rounded-full mt-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                    style={{ width: `${todayGoalProgress}%` }}
                  />
                </div>

                <p className="text-xs text-slate-600 mt-3">
                  Goal: 120 minutes
                </p>

                {loadingStats && (
                  <p className="text-xs text-slate-500 mt-2">
                    Loading focus stats...
                  </p>
                )}
              </div>

              <div className="p-6 rounded-3xl bg-white/[0.04] border border-white/10">
                <p className="text-sm text-slate-500">
                  Completed sessions
                </p>

                <div className="flex items-center gap-4 mt-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center text-emerald-400">
                    ✓
                  </div>

                  <div>
                    <p className="text-2xl font-bold">
                      {completedSessions}
                    </p>
                    <p className="text-xs text-slate-600">sessions today</p>
                  </div>
                </div>

                <button
                  onClick={loadSessions}
                  disabled={loadingStats}
                  className="mt-3 text-xs text-violet-300 hover:text-violet-200 disabled:opacity-50"
                >
                  {loadingStats ? "Refreshing..." : "Refresh stats"}
                </button>
              </div>

              <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-600/10 to-blue-600/10 border border-violet-500/10">
                <p className="text-sm font-medium">Focus tip</p>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Put your phone away and work on only one task until the
                  timer ends.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">
              Your focus routine
            </h3>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4">
                  1
                </div>
                <h4 className="font-medium">Choose a session</h4>
                <p className="text-sm text-slate-500 mt-2">
                  Pick a preset or choose a custom duration.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                  2
                </div>
                <h4 className="font-medium">Start focusing</h4>
                <p className="text-sm text-slate-500 mt-2">
                  Start the timer and give your attention to one thing.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                  3
                </div>
                <h4 className="font-medium">Review progress</h4>
                <p className="text-sm text-slate-500 mt-2">
                  Completed sessions contribute to your daily focus time.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default Focus;
