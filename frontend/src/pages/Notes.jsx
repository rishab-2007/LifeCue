import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";

function Notes() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
    category: "General",
  });

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("lifecue_user") || "null");
    } catch {
      return null;
    }
  }, []);

  const email = user?.email;

  const request = async (path, options = {}) => {
    const response = await apiFetch(path, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail || data.message || `Request failed (${response.status})`
      );
    }

    return data;
  };

  const getNoteId = (note) => note?.id ?? note?._id;

  const normalizeNote = (note) => ({
    ...note,
    id: String(getNoteId(note) ?? ""),
    title: note?.title || "",
    content: note?.content || "",
    category: note?.category || "General",
    pinned: Boolean(note?.pinned),
  });

  const loadNotes = useCallback(async () => {
    if (!email) {
      setError("User session nahi mili. Please dobara login karo.");
      setLoading(false);
      return;
    }

    try {
      setError("");

      const data = await request(
        `/notes?email=${encodeURIComponent(email)}`
      );

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.notes)
          ? data.notes
          : [];

      setNotes(list.map(normalizeNote));
    } catch (err) {
      setError(err.message || "Notes load nahi ho paaye.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const openAddModal = () => {
    setError("");
    setNotice("");
    setEditingId(null);
    setNewNote({
      title: "",
      content: "",
      category: "General",
    });
    setShowModal(true);
  };

  const openEditModal = (note) => {
    setError("");
    setNotice("");
    setEditingId(note.id);

    setNewNote({
      title: note.title || "",
      content: note.content || "",
      category: note.category || "General",
    });

    setShowModal(true);
  };

  const resetForm = () => {
    if (saving) return;

    setShowModal(false);
    setEditingId(null);
    setNewNote({
      title: "",
      content: "",
      category: "General",
    });
  };

  const saveNote = async () => {
    const title = newNote.title.trim();

    if (!title) {
      setNotice("");
      setError("Note ka title likhna zaroori hai.");
      return;
    }

    if (!email) {
      setError("User session nahi mili. Please dobara login karo.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        title,
        content: newNote.content.trim(),
        category: newNote.category,
      };

      if (editingId !== null) {
        const updated = await request(
          `/notes/${encodeURIComponent(editingId)}?email=${encodeURIComponent(email)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );

        const updatedNote = normalizeNote(
          updated?.note || updated
        );

        setNotes((current) =>
          current.map((note) =>
            note.id === editingId
              ? {
                  ...note,
                  ...updatedNote,
                  id: editingId,
                }
              : note
          )
        );

        setNotice("Note update ho gaya.");
      } else {
        const created = await request("/notes", {
          method: "POST",
          body: JSON.stringify({
            email,
            ...payload,
          }),
        });

        const createdNote = normalizeNote(
          created?.note || created
        );

        if (!createdNote.id) {
          await loadNotes();
        } else {
          setNotes((current) => [createdNote, ...current]);
        }

        setNotice("Note save ho gaya.");
      }

      setShowModal(false);
      setEditingId(null);
      setNewNote({
        title: "",
        content: "",
        category: "General",
      });
    } catch (err) {
      setError(err.message || "Note save nahi ho paaya.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id) => {
    if (!email) {
      setError("User session nahi mili. Please dobara login karo.");
      return;
    }

    if (!window.confirm("Kya tum ye note delete karna chahte ho?")) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(
        `/notes/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      setNotes((current) =>
        current.filter((note) => note.id !== id)
      );

      setNotice("Note delete ho gaya.");
    } catch (err) {
      setError(err.message || "Note delete nahi ho paaya.");
    }
  };

  const togglePin = async (note) => {
    if (!email) {
      setError("User session nahi mili. Please dobara login karo.");
      return;
    }

    setError("");
    setNotice("");

    try {
      const updated = await request(
        `/notes/${encodeURIComponent(note.id)}?email=${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            pinned: !note.pinned,
          }),
        }
      );

      const updatedNote = normalizeNote(
        updated?.note || updated
      );

      setNotes((current) =>
        current.map((item) =>
          item.id === note.id
            ? {
                ...item,
                ...updatedNote,
                id: note.id,
                pinned:
                  typeof (updated?.note || updated)?.pinned === "boolean"
                    ? (updated?.note || updated).pinned
                    : !note.pinned,
              }
            : item
        )
      );

      setNotice(note.pinned ? "Note unpinned." : "Note pinned.");
    } catch (err) {
      setError(err.message || "Pin update nahi ho paaya.");
    }
  };

  const filteredNotes = notes.filter((note) => {
    const term = search.toLowerCase();

    return (
      note.title.toLowerCase().includes(term) ||
      note.content.toLowerCase().includes(term) ||
      note.category.toLowerCase().includes(term)
    );
  });

  const sortedNotes = [...filteredNotes].sort(
    (a, b) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
  );

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

          {[
            ["/dashboard", "⌂", "Dashboard"],
            ["/tasks", "✓", "Tasks"],
            ["/planner", "▦", "Planner"],
            ["/habits", "◉", "Habits"],
            ["/focus", "◷", "Focus"],
            ["/goals", "◇", "Goals"],
            ["/analytics", "↗", "Analytics"],
          ].map(([to, icon, label]) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition"
            >
              <span>{icon}</span>
              {label}
            </Link>
          ))}

          <Link
            to="/notes"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600/20 to-blue-600/10 border border-violet-500/20 text-white"
          >
            <span>✎</span>
            <span className="font-medium">Notes</span>
          </Link>
        </nav>

        <div className="mt-auto p-4">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
            <p className="text-xs text-slate-500">Total notes</p>
            <p className="text-lg font-semibold mt-1">{notes.length}</p>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto">
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Workspace</p>
            <h1 className="text-xl font-semibold mt-1">Notes</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">
                {user?.name || "LifeCue User"}
              </p>
              <p className="text-xs text-slate-500">{email || ""}</p>
            </div>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-semibold">
              {(user?.name || "R").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
            <div>
              <p className="text-sm text-violet-400 font-medium mb-2">
                Capture your thoughts
              </p>
              <h2 className="text-3xl lg:text-4xl font-bold">
                Your ideas, organized.
              </h2>
              <p className="text-slate-500 mt-2">
                Keep important thoughts, ideas and learning in one place.
              </p>
            </div>

            <button
              onClick={openAddModal}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-medium shadow-lg shadow-violet-600/20 transition"
            >
              + New Note
            </button>
          </div>

          {(error || notice) && (
            <div
              className={`mb-5 p-4 rounded-xl border text-sm ${
                error
                  ? "bg-red-500/10 border-red-500/30 text-red-300"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              }`}
            >
              {error || notice}
            </div>
          )}

          <div className="relative mb-8">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              ⌕
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full px-11 py-4 rounded-2xl bg-white/[0.04] border border-white/10 outline-none focus:border-violet-500/40 text-sm placeholder:text-slate-600"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Total Notes</p>
              <p className="text-3xl font-bold mt-2">{notes.length}</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Pinned</p>
              <p className="text-3xl font-bold mt-2">
                {notes.filter((note) => note.pinned).length}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-sm text-slate-500">Showing</p>
              <p className="text-3xl font-bold mt-2">
                {sortedNotes.length}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 rounded-3xl bg-white/[0.03] border border-white/10 text-slate-400">
              Loading notes...
            </div>
          ) : sortedNotes.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedNotes.map((note) => (
                <div
                  key={note.id}
                  className="group p-6 rounded-3xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] hover:border-violet-500/20 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">✎</span>
                      <span className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs">
                        {note.category}
                      </span>
                    </div>

                    <button
                      onClick={() => togglePin(note)}
                      className={`text-lg transition ${
                        note.pinned
                          ? "text-amber-400"
                          : "text-slate-600 hover:text-slate-300"
                      }`}
                      title={note.pinned ? "Unpin note" : "Pin note"}
                    >
                      {note.pinned ? "★" : "☆"}
                    </button>
                  </div>

                  <h3 className="text-lg font-semibold mt-5 break-words">
                    {note.title}
                  </h3>

                  <p className="text-sm text-slate-500 mt-3 leading-relaxed min-h-20 whitespace-pre-wrap break-words">
                    {note.content}
                  </p>

                  <div className="flex gap-2 mt-6 pt-4 border-t border-white/5">
                    <button
                      onClick={() => openEditModal(note)}
                      className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => deleteNote(note.id)}
                      className="px-4 py-2 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400 text-sm hover:bg-red-500/10 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 rounded-3xl bg-white/[0.03] border border-white/10">
              <div className="text-4xl mb-4">✎</div>
              <h3 className="text-lg font-semibold">No notes found</h3>
              <p className="text-sm text-slate-500 mt-2">
                {search
                  ? "Try another search or clear the search."
                  : "Create your first note to get started."}
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#101426] border border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold">
                  {editingId !== null ? "Edit Note" : "Create New Note"}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {editingId !== null
                    ? "Update your note."
                    : "Capture an idea or important thought."}
                </p>
              </div>

              <button
                onClick={resetForm}
                disabled={saving}
                className="w-9 h-9 rounded-lg bg-white/5 text-slate-400 hover:text-white disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Title</label>
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) =>
                    setNewNote({ ...newNote, title: e.target.value })
                  }
                  placeholder="e.g. React concepts"
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Category</label>
                <select
                  value={newNote.category}
                  onChange={(e) =>
                    setNewNote({ ...newNote, category: e.target.value })
                  }
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-[#171c31] border border-white/10 outline-none text-sm"
                >
                  {["General", "Learning", "Project", "DSA", "Personal", "Ideas"].map(
                    (category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Note</label>
                <textarea
                  value={newNote.content}
                  onChange={(e) =>
                    setNewNote({ ...newNote, content: e.target.value })
                  }
                  placeholder="Write your note here..."
                  rows="5"
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500/50 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={resetForm}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={saveNote}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 font-medium text-sm disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "Create Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notes;