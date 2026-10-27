import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";

function Tasks() {

  // ================= TASK DATA =================

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("lifecue_user") || "null");
    } catch {
      return null;
    }
  })();
  const userEmail = savedUser?.email || "";

  const API_URL = "http://127.0.0.1:8000";

  // Load this user's tasks from MongoDB.
  useEffect(() => {
    const loadTasks = async () => {
      if (!userEmail) {
        setErrorMessage("Please sign in first to view your tasks.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");
        const response = await apiFetch(`/tasks?email=${encodeURIComponent(userEmail)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Could not load tasks.");
        }

        setTasks(data.tasks);
      } catch (error) {
        setErrorMessage(error.message || "Backend connection failed.");
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [userEmail]);

  useEffect(() => {
    if (!("Notification" in window)) {
      setNotificationStatus("This browser does not support notifications.");
      return;
    }
    setNotificationStatus(`Browser notifications: ${Notification.permission}`);
  }, []);

  const enableNotifications = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("This browser does not support push notifications.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const keyResponse = await apiFetch("/push/public-key");
      const keyData = await keyResponse.json();
      if (!keyData.success || !keyData.publicKey) {
        throw new Error("Backend VAPID keys are not configured yet. Follow SETUP.md.");
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
      const response = await apiFetch("/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.detail || "Could not enable push notifications.");
      setNotificationStatus("Push notifications enabled.");
      new Notification("LifeCue", { body: "Reminders are enabled on this browser." });
    } catch (error) {
      setNotificationStatus(error.message || "Could not enable notifications.");
    }
  };

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
  }

  // ================= MODAL =================

  const [showModal, setShowModal] = useState(false);


  // ================= FORM =================

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [category, setCategory] = useState("Personal");
  const [time, setTime] = useState("6:00 PM");
  const [dueDate, setDueDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [repeat, setRepeat] = useState("Never");
  const [notificationStatus, setNotificationStatus] = useState("");


  // ================= FILTER =================

  const [filter, setFilter] = useState("All");


  // ================= ADD TASK =================

  const addTask = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!title.trim()) return;
    if ((dueDate && !reminderTime) || (!dueDate && reminderTime)) {
      setErrorMessage("Reminder ke liye date aur time dono select karo.");
      return;
    }
    if (dueDate && reminderTime && new Date(`${dueDate}T${reminderTime}`).getTime() <= Date.now()) {
      setErrorMessage("Reminder ka time future mein hona chahiye.");
      return;
    }
    if (!userEmail) {
      setErrorMessage("Please sign in again before adding a task.");
      return;
    }

    try {
      const response = await apiFetch(`/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          title: title.trim(),
          description: description.trim(),
          priority,
          category,
          time,
          due_date: dueDate || null,
          reminder_at: reminderTime ? new Date(`${dueDate || new Date().toLocaleDateString("en-CA")}T${reminderTime}`).toISOString() : null,
          repeat,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not save the task.");
      }

      setTasks((previousTasks) => [data.task, ...previousTasks]);
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setCategory("Personal");
      setTime("6:00 PM");
      setDueDate("");
      setReminderTime("");
      setRepeat("Never");
      setShowModal(false);
      setSuccessMessage("Task saved successfully.");
    } catch (error) {
      setErrorMessage(error.message || "Backend connection failed.");
    }
  };

  // ================= COMPLETE TASK =================

  const toggleTask = async (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task || !userEmail) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await apiFetch(
        `/tasks/${encodeURIComponent(id)}?email=${encodeURIComponent(userEmail)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: !task.completed }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not update the task.");
      }

      setTasks((previousTasks) =>
        previousTasks.map((item) => item.id === id ? data.task : item)
      );
    } catch (error) {
      setErrorMessage(error.message || "Could not update the task.");
    }
  };

  // ================= DELETE TASK =================

  const deleteTask = async (id) => {
    if (!userEmail) return;
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await apiFetch(
        `/tasks/${encodeURIComponent(id)}?email=${encodeURIComponent(userEmail)}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not delete the task.");
      }

      setTasks((previousTasks) => previousTasks.filter((task) => task.id !== id));
      setSuccessMessage("Task deleted.");
    } catch (error) {
      setErrorMessage(error.message || "Could not delete the task.");
    }
  };


  // ================= FILTER TASKS =================

  const filteredTasks = tasks.filter((task) => {

    if (filter === "Completed") {
      return task.completed;
    }

    if (filter === "Pending") {
      return !task.completed;
    }

    return true;
  });


  // ================= COUNTS =================

  const totalTasks = tasks.length;

  const completedTasks = tasks.filter(
    (task) => task.completed
  ).length;

  const pendingTasks = tasks.filter(
    (task) => !task.completed
  ).length;


  return (

    <div className="min-h-screen bg-[#080B18] text-white flex overflow-hidden">

      {/* ================= BACKGROUND ================= */}

      <div className="fixed top-[-180px] left-[250px] w-[450px] h-[450px] bg-violet-600/10 rounded-full blur-[130px]" />

      <div className="fixed bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px]" />


      {/* ================= SIDEBAR ================= */}

      <aside className="relative z-10 hidden lg:flex w-64 min-h-screen flex-col border-r border-white/10 bg-white/[0.025] backdrop-blur-xl">

        {/* Logo */}

        <div className="px-6 py-7 flex items-center gap-3">

          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20">

            <span className="font-bold text-lg">
              L
            </span>

          </div>

          <span className="text-xl font-semibold">
            LifeCue
          </span>

        </div>


        {/* Navigation */}

        <nav className="px-4 mt-5 space-y-2">

          <p className="text-[11px] uppercase tracking-wider text-slate-600 px-3 mb-3">
            Workspace
          </p>


          <Link
            to="/dashboard"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>⌂</span>
            <span className="text-sm">
              Dashboard
            </span>
          </Link>


          {/* ACTIVE */}

          <Link
            to="/tasks"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600/20 to-blue-600/10 border border-violet-500/20 text-white"
          >
            <span>✓</span>
            <span className="text-sm font-medium">
              Tasks
            </span>
          </Link>


          <Link
            to="/planner"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>▦</span>
            <span className="text-sm">
              Planner
            </span>
          </Link>


          <Link
            to="/habits"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>◉</span>
            <span className="text-sm">
              Habits
            </span>
          </Link>


          <Link
            to="/focus"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>◷</span>
            <span className="text-sm">
              Focus
            </span>
          </Link>


          <Link
            to="/goals"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>◇</span>
            <span className="text-sm">
              Goals
            </span>
          </Link>


          <Link
            to="/analytics"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>↗</span>
            <span className="text-sm">
              Analytics
            </span>
          </Link>


          <Link
            to="/notes"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span>✎</span>
            <span className="text-sm">
              Notes
            </span>
          </Link>

        </nav>


        {/* Sidebar Bottom */}

        <div className="mt-auto p-4">

          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">

            <p className="text-xs text-slate-500">
              Today's progress
            </p>

            <p className="text-sm font-medium mt-1">
              {completedTasks} of {totalTasks} tasks completed
            </p>

            <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">

              <div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all"
                style={{
                  width:
                    totalTasks === 0
                      ? "0%"
                      : `${(completedTasks / totalTasks) * 100}%`,
                }}
              />

            </div>

          </div>

        </div>

      </aside>


      {/* ================= MAIN ================= */}

      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto">


        {/* TOPBAR */}

        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 lg:px-10">

          <div>

            <p className="text-sm text-slate-500">
              Workspace
            </p>

            <h1 className="text-xl font-semibold mt-1">
              Tasks
            </h1>

          </div>


          <div className="flex items-center gap-4">

            <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-white/10">
              ♢
            </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-semibold">
              R
            </div>

          </div>

        </header>


        {/* CONTENT */}

        <div className="p-6 lg:p-10 max-w-6xl mx-auto">


          {/* HEADER */}

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">

            <div>

              <p className="text-sm text-violet-400 font-medium mb-2">
                Stay organized
              </p>

              <h2 className="text-3xl lg:text-4xl font-bold">
                Get things done.
              </h2>

              <p className="text-slate-500 mt-2">
                Manage your tasks and keep your priorities moving.
              </p>

            </div>


            {/* ADD TASK */}

            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-semibold text-sm shadow-lg shadow-violet-600/20 transition"
            >
              + Add task
            </button>

          </div>


          {(errorMessage || successMessage) && (
            <div
              role="status"
              className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                errorMessage
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {errorMessage || successMessage}
            </div>
          )}

          {/* ================= STATS ================= */}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">


            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">

              <p className="text-sm text-slate-500">
                Total
              </p>

              <p className="text-3xl font-bold mt-2">
                {totalTasks}
              </p>

              <p className="text-xs text-slate-500 mt-2">
                All tasks
              </p>

            </div>


            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">

              <p className="text-sm text-slate-500">
                Completed
              </p>

              <p className="text-3xl font-bold mt-2 text-emerald-400">
                {completedTasks}
              </p>

              <p className="text-xs text-emerald-400/70 mt-2">
                Great progress
              </p>

            </div>


            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">

              <p className="text-sm text-slate-500">
                Pending
              </p>

              <p className="text-3xl font-bold mt-2 text-violet-400">
                {pendingTasks}
              </p>

              <p className="text-xs text-slate-500 mt-2">
                Remaining tasks
              </p>

            </div>

          </div>


          {/* ================= FILTERS ================= */}

          <div className="flex flex-wrap gap-2 mb-5">

            {["All", "Pending", "Completed"].map(
              (item) => (

                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`px-4 py-2 rounded-lg text-sm transition ${
                    filter === item
                      ? "bg-violet-500/15 border border-violet-500/20 text-violet-300"
                      : "text-slate-500 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item}
                </button>

              )
            )}

          </div>


          {/* ================= TASK LIST ================= */}

          <div className="space-y-3">

            {loading ? (
              <div className="p-10 rounded-2xl bg-white/[0.04] border border-white/10 text-center text-slate-400">
                Loading your tasks...
              </div>
            ) : filteredTasks.length === 0 ? (

              <div className="p-10 rounded-2xl bg-white/[0.04] border border-white/10 text-center">

                <div className="text-4xl mb-4">
                  ✓
                </div>

                <h3 className="font-semibold">
                  No tasks here
                </h3>

                <p className="text-sm text-slate-500 mt-2">
                  You're all caught up.
                </p>

              </div>

            ) : (

              filteredTasks.map((task) => (

                <div
                  key={task.id}
                  className={`group p-5 rounded-2xl bg-white/[0.04] border transition ${
                    task.completed
                      ? "border-emerald-500/10"
                      : "border-white/10 hover:border-violet-500/20"
                  }`}
                >

                  <div className="flex items-start gap-4">


                    {/* CHECKBOX */}

                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center text-xs transition ${
                        task.completed
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                          : "border border-slate-600 hover:border-violet-500"
                      }`}
                    >
                      {task.completed && "✓"}
                    </button>


                    {/* TASK CONTENT */}

                    <div className="flex-1 min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <h3
                          className={`font-medium ${
                            task.completed
                              ? "text-slate-500 line-through"
                              : ""
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


                      <p
                        className={`text-sm mt-2 ${
                          task.completed
                            ? "text-slate-600"
                            : "text-slate-500"
                        }`}
                      >
                        {task.description}
                      </p>


                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">

                        <span>
                          ◷ {task.time}
                        </span>

                        <span>
                          ◇ {task.category}
                        </span>

                        {task.completed && (
                          <span className="text-emerald-400">
                            ✓ Completed
                          </span>
                        )}

                      </div>

                    </div>


                    {/* DELETE */}

                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-50 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition px-2"
                      title="Delete task"
                    >
                      ×
                    </button>

                  </div>

                </div>

              ))

            )}

          </div>


          {/* ================= INFO ================= */}

          <div className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-violet-600/10 to-blue-600/10 border border-violet-500/10">

            <p className="text-sm font-medium">
              Keep your momentum going.
            </p>

            <p className="text-xs text-slate-500 mt-1">
              Complete your important tasks and keep building your streak.
            </p>

          </div>


          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><p className="text-sm font-semibold">Reminder notifications</p><p className="text-xs text-slate-400 mt-1">{notificationStatus || "Enable notifications for reminders."}</p></div>
            <button type="button" onClick={enableNotifications} className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold">Enable notifications</button>
          </div>

          {/* FOOTER */}

          <div className="text-center py-8">

            <p className="text-xs text-slate-600">
              LifeCue · Remember → Plan → Focus → Track → Review → Improve
            </p>

          </div>

        </div>

      </main>


      {/* ================================================= */}
      {/* ================= ADD TASK MODAL ================= */}
      {/* ================================================= */}

      {showModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">

          {/* Overlay */}

          <div
            onClick={() => setShowModal(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />


          {/* Modal */}

          <div className="relative w-full max-w-lg bg-[#101426] border border-white/10 rounded-3xl p-7 shadow-2xl">


            {/* Modal Header */}

            <div className="flex items-center justify-between mb-7">

              <div>

                <p className="text-sm text-violet-400 font-medium">
                  New task
                </p>

                <h2 className="text-2xl font-bold mt-1">
                  Create a task
                </h2>

              </div>


              <button
                onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
              >
                ×
              </button>

            </div>


            {/* FORM */}

            <form
              onSubmit={addTask}
              className="space-y-5"
            >


              {/* TITLE */}

              <div>

                <label className="block text-sm text-slate-300 mb-2">
                  Task title
                </label>

                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  placeholder="What do you need to do?"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 outline-none focus:border-violet-500/60 transition"
                  autoFocus
                  required
                />

              </div>


              {/* DESCRIPTION */}

              <div>

                <label className="block text-sm text-slate-300 mb-2">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add some details..."
                  rows="3"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 outline-none focus:border-violet-500/60 transition resize-none"
                />

              </div>


              {/* PRIORITY + CATEGORY */}

              <div className="grid grid-cols-2 gap-4">


                <div>

                  <label className="block text-sm text-slate-300 mb-2">
                    Priority
                  </label>

                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#15192b] border border-white/10 text-white outline-none focus:border-violet-500/60"
                  >

                    <option value="High">
                      High
                    </option>

                    <option value="Medium">
                      Medium
                    </option>

                    <option value="Low">
                      Low
                    </option>

                  </select>

                </div>


                <div>

                  <label className="block text-sm text-slate-300 mb-2">
                    Category
                  </label>

                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#15192b] border border-white/10 text-white outline-none focus:border-violet-500/60"
                  >

                    <option value="Personal">
                      Personal
                    </option>

                    <option value="Learning">
                      Learning
                    </option>

                    <option value="Development">
                      Development
                    </option>

                    <option value="Work">
                      Work
                    </option>

                  </select>

                </div>

              </div>


              {/* TIME */}

              <div>

                <label className="block text-sm text-slate-300 mb-2">
                  Time
                </label>

                <input
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  type="text"
                  placeholder="e.g. 6:00 PM"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 outline-none focus:border-violet-500/60 transition"
                />

              </div>


              {/* REMINDER DATE AND TIME */}
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-4">
                <p className="text-sm font-semibold text-violet-300">Reminder</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Date</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toLocaleDateString("en-CA")} className="w-full min-w-0 px-3 py-3 rounded-xl bg-[#15192b] border border-white/10 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Notify at</label>
                    <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="w-full min-w-0 px-3 py-3 rounded-xl bg-[#15192b] border border-white/10 text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Repeat</label>
                  <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#15192b] border border-white/10 text-white">
                    <option value="Never">Never</option><option value="Daily">Daily</option><option value="Weekly">Weekly</option>
                  </select>
                </div>
                <p className="text-xs text-slate-500">Choose both date and time to schedule a notification.</p>
              </div>

              {/* BUTTONS */}

              <div className="flex gap-3 pt-2">

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition"
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-semibold transition shadow-lg shadow-violet-600/20"
                >
                  Add task
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default Tasks;