"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, X, Users, Tag } from "lucide-react";
import { listBroadcasts, createBroadcast, listTemplates, ApiError, type ApiBroadcast, type ApiTemplate } from "@/lib/api";

const ACCENT = "#00926B";

const STATUS_STYLES: Record<ApiBroadcast["status"], string> = {
  draft: "bg-white/10 text-white/50",
  scheduled: "bg-blue-500/15 text-blue-300",
  sending: "bg-amber-500/15 text-amber-300",
  completed: "text-[#00926B]",
};

type AudienceType = "all_contacts" | "tag";

function emptyDraft(templateId: string) {
  return { name: "", templateId, audienceType: "all_contacts" as AudienceType, audienceTag: "" };
}

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<ApiBroadcast[]>([]);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft(""));
  const [sending, setSending] = useState(false);

  const approvedTemplates = templates.filter((t) => t.status === "approved");

  useEffect(() => {
    Promise.all([listBroadcasts(), listTemplates()])
      .then(([b, t]) => {
        setBroadcasts(b);
        setTemplates(t);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load broadcasts."))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setDraft(emptyDraft(approvedTemplates[0]?.id ?? ""));
    setError(null);
    setShowForm(true);
  };

  const handleSend = async () => {
    if (!draft.name.trim() || !draft.templateId) return;
    setSending(true);
    setError(null);
    try {
      const created = await createBroadcast({
        name: draft.name.trim(),
        template_id: draft.templateId,
        audience_type: draft.audienceType,
        audience_tag: draft.audienceType === "tag" ? draft.audienceTag.trim() : undefined,
      });
      setBroadcasts((prev) => [created, ...prev]);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send this broadcast.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
            <Megaphone className="h-5 w-5" style={{ color: ACCENT }} />
          </span>
          <div>
            <h1 className="text-[20px] font-bold text-white">Broadcasts</h1>
            <p className="text-[13.5px] text-white/50">Send an approved template to your whole audience or a tagged segment.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={loading || approvedTemplates.length === 0}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus className="h-4 w-4" />
          New Broadcast
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}

      {!loading && approvedTemplates.length === 0 && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-300">
          You need at least one approved template before sending a broadcast. New templates start as "Pending" until Meta approves them.
        </p>
      )}

      {showForm && (
        <div className="mt-5 rounded-2xl border p-4 backdrop-blur-xl" style={{ borderColor: `${ACCENT}4D`, backgroundColor: "rgba(255,255,255,0.03)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-white">New broadcast</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[12px] font-semibold text-white/50">Broadcast name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. September Sale Announcement"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-white/50">Template</label>
              <select
                value={draft.templateId}
                onChange={(e) => setDraft((d) => ({ ...d, templateId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none focus:border-[#00926B]"
              >
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id} className="bg-black">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-white/50">Audience</label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, audienceType: "all_contacts" }))}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                  style={
                    draft.audienceType === "all_contacts"
                      ? { backgroundColor: ACCENT, color: "#FFFFFF" }
                      : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  <Users className="h-3.5 w-3.5" />
                  All contacts
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, audienceType: "tag" }))}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                  style={
                    draft.audienceType === "tag"
                      ? { backgroundColor: ACCENT, color: "#FFFFFF" }
                      : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  <Tag className="h-3.5 w-3.5" />
                  By tag
                </button>
              </div>
              {draft.audienceType === "tag" && (
                <input
                  value={draft.audienceTag}
                  onChange={(e) => setDraft((d) => ({ ...d, audienceTag: e.target.value }))}
                  placeholder="e.g. vip-customers"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
                />
              )}
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.name.trim() || (draft.audienceType === "tag" && !draft.audienceTag.trim()) || sending}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {sending ? "Sending…" : "Send broadcast"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-[11.5px] font-semibold uppercase tracking-wide text-white/40">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sent / Delivered / Failed</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => (
              <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-white">{b.name}</td>
                <td className="px-4 py-3 text-white/50">
                  {b.audience.type === "all_contacts" ? "All contacts" : `Tag: ${b.audience.tag}`}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${STATUS_STYLES[b.status]}`}
                    style={b.status === "completed" ? { backgroundColor: `${ACCENT}26` } : undefined}
                  >
                    {b.status[0].toUpperCase() + b.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/50">{b.sent} / {b.delivered} / {b.failed}</td>
                <td className="px-4 py-3 text-white/50">{b.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && broadcasts.length === 0 && (
          <p className="px-4 py-10 text-center text-[13.5px] text-white/50">No broadcasts sent yet.</p>
        )}
        {loading && <p className="px-4 py-10 text-center text-[13.5px] text-white/50">Loading broadcasts…</p>}
      </div>
    </div>
  );
}
