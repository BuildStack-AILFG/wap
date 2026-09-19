"use client";

import { useEffect, useState } from "react";
import { MessageSquareReply, Plus, Pencil, Trash2, X } from "lucide-react";
import {
  listCustomReplies,
  createCustomReply,
  updateCustomReply,
  deleteCustomReply,
  getSettings,
  patchSettings,
  ApiError,
  type ApiCustomReply,
} from "@/lib/api";

const ACCENT = "#00926B";

function emptyDraft() {
  return { trigger: "", replyText: "" };
}

export default function CustomRepliesPage() {
  const [replies, setReplies] = useState<ApiCustomReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [masterEnabled, setMasterEnabled] = useState(true);

  useEffect(() => {
    listCustomReplies()
      .then(setReplies)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load custom replies."))
      .finally(() => setLoading(false));
    getSettings()
      .then(({ settings }) => setMasterEnabled((settings.custom_replies_enabled as boolean | undefined) ?? true))
      .catch(() => {});
  }, []);

  const toggleMaster = async () => {
    const next = !masterEnabled;
    setMasterEnabled(next);
    try {
      await patchSettings({ custom_replies_enabled: next });
    } catch {
      setMasterEnabled(!next);
      setError("Couldn't update that setting — reverted.");
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setError(null);
    setShowForm(true);
  };

  const openEdit = (reply: ApiCustomReply) => {
    setEditingId(reply.id);
    setDraft({ trigger: reply.trigger, replyText: reply.reply_text });
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const handleSave = async () => {
    if (!draft.trigger.trim() || !draft.replyText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await updateCustomReply(editingId, { trigger: draft.trigger, reply_text: draft.replyText });
        setReplies((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await createCustomReply({ trigger: draft.trigger, reply_text: draft.replyText });
        setReplies((prev) => [created, ...prev]);
      }
      closeForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this reply.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = replies;
    setReplies((cur) => cur.filter((r) => r.id !== id));
    try {
      await deleteCustomReply(id);
    } catch {
      setReplies(prev);
      setError("Couldn't delete that reply.");
    }
  };

  const handleToggleRow = async (reply: ApiCustomReply) => {
    const next = !reply.enabled;
    setReplies((prev) => prev.map((r) => (r.id === reply.id ? { ...r, enabled: next } : r)));
    try {
      await updateCustomReply(reply.id, { enabled: next });
    } catch {
      setReplies((prev) => prev.map((r) => (r.id === reply.id ? { ...r, enabled: !next } : r)));
      setError("Couldn't update that reply — reverted.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
            <MessageSquareReply className="h-5 w-5" style={{ color: ACCENT }} />
          </span>
          <div>
            <h1 className="text-[20px] font-bold text-white">Custom Replies</h1>
            <p className="text-[13.5px] text-white/50">
              Match keywords or phrases in an incoming message and send an instant reply.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus className="h-4 w-4" />
          Add New Reply
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-xl">
        <div>
          <p className="text-[13.5px] font-semibold text-white">
            Custom Replies are {masterEnabled ? "switched on" : "switched off"}
          </p>
          <p className="text-[12.5px] text-white/50">
            When off, none of the replies below will fire, even if individually enabled.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={masterEnabled}
          onClick={toggleMaster}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: masterEnabled ? ACCENT : "rgba(255,255,255,0.15)" }}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              masterEnabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}

      {showForm && (
        <div className="mt-4 rounded-2xl border p-4 backdrop-blur-xl" style={{ borderColor: `${ACCENT}4D`, backgroundColor: "rgba(255,255,255,0.03)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-white">
              {editingId ? "Edit reply" : "New custom reply"}
            </h2>
            <button type="button" onClick={closeForm} className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[12px] font-semibold text-white/50">Trigger keywords (comma separated)</label>
              <input
                value={draft.trigger}
                onChange={(e) => setDraft((d) => ({ ...d, trigger: e.target.value }))}
                placeholder="e.g. pricing, cost, how much"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-white/50">Reply message</label>
              <textarea
                value={draft.replyText}
                onChange={(e) => setDraft((d) => ({ ...d, replyText: e.target.value }))}
                rows={3}
                placeholder="What should we send back?"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!draft.trigger.trim() || !draft.replyText.trim() || saving}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {saving ? "Saving…" : "Save reply"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-[11.5px] font-semibold uppercase tracking-wide text-white/40">
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Reply preview</th>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {replies.map((reply) => (
              <tr key={reply.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="max-w-[200px] px-4 py-3 font-medium text-white">{reply.trigger}</td>
                <td className="max-w-[320px] truncate px-4 py-3 text-white/50">{reply.reply_text}</td>
                <td className="px-4 py-3 text-white/50">{reply.conversations_sent}</td>
                <td className="px-4 py-3 text-white/50">{reply.updated_at.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleToggleRow(reply)}
                    className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                    style={
                      reply.enabled
                        ? { backgroundColor: `${ACCENT}26`, color: ACCENT }
                        : { backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
                    }
                  >
                    {reply.enabled ? "Enabled" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(reply)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(reply.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && replies.length === 0 && (
          <p className="px-4 py-10 text-center text-[13.5px] text-white/50">
            No custom replies yet — add one to get started.
          </p>
        )}
        {loading && <p className="px-4 py-10 text-center text-[13.5px] text-white/50">Loading custom replies…</p>}
      </div>
    </div>
  );
}
