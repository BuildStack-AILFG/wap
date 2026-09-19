"use client";

import { useEffect, useState } from "react";
import { Workflow, Plus, X, GitBranch } from "lucide-react";
import { listFlows, createFlow, ApiError, type ApiFlow } from "@/lib/api";

const ACCENT = "#00926B";

const STATUS_STYLES: Record<ApiFlow["status"], string> = {
  draft: "bg-white/10 text-white/50",
  published: "text-[#00926B]",
  archived: "bg-amber-500/15 text-amber-300",
};

const TRIGGER_LABELS: Record<string, string> = {
  incoming_message: "Any incoming message",
  keyword: "Keyword match",
  contact_created: "New contact created",
  manual: "Manual start",
  webhook: "Webhook",
};

const TRIGGER_OPTIONS = Object.keys(TRIGGER_LABELS);

export default function FlowBuilderPage() {
  const [flows, setFlows] = useState<ApiFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState(TRIGGER_OPTIONS[0]);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    listFlows()
      .then(setFlows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load workflows."))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setName("");
    setTriggerType(TRIGGER_OPTIONS[0]);
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createFlow({ name: name.trim(), trigger_type: triggerType });
      setFlows((prev) => [created, ...prev]);
      setShowForm(false);
      setNotice(`"${created.name}" was created as a draft. The visual canvas to wire up steps isn't built yet — this is where it will open.`);
      window.setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this workflow.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
            <Workflow className="h-5 w-5" style={{ color: ACCENT }} />
          </span>
          <div>
            <h1 className="text-[20px] font-bold text-white">Flow Builder</h1>
            <p className="text-[13.5px] text-white/50">Build multi-step chatbot flows that run automatically on WhatsApp.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus className="h-4 w-4" />
          New Workflow
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-300">{notice}</p>}

      {showForm && (
        <div className="mt-5 rounded-2xl border p-4 backdrop-blur-xl" style={{ borderColor: `${ACCENT}4D`, backgroundColor: "rgba(255,255,255,0.03)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-white">New workflow</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[12px] font-semibold text-white/50">Workflow name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Book a Demo"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-white/50">Starts when</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none focus:border-[#00926B]"
              >
                {TRIGGER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-black">
                    {TRIGGER_LABELS[opt]}
                  </option>
                ))}
              </select>
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
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {creating ? "Creating…" : "Create draft"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-[11.5px] font-semibold uppercase tracking-wide text-white/40">
              <th className="px-4 py-3">Workflow name</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Conversations sent</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((flow) => (
              <tr key={flow.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-white">
                    <GitBranch className="h-3.5 w-3.5 text-white/40" />
                    {flow.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-white/50">{TRIGGER_LABELS[flow.trigger_type] ?? flow.trigger_type}</td>
                <td className="px-4 py-3 text-white/50">{flow.conversations_sent}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${STATUS_STYLES[flow.status]}`}
                    style={flow.status === "published" ? { backgroundColor: `${ACCENT}26` } : undefined}
                  >
                    {flow.status[0].toUpperCase() + flow.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/50">{flow.updated_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && flows.length === 0 && (
          <p className="px-4 py-10 text-center text-[13.5px] text-white/50">
            No workflows yet — create one to build your first automated flow.
          </p>
        )}
        {loading && <p className="px-4 py-10 text-center text-[13.5px] text-white/50">Loading workflows…</p>}
      </div>
    </div>
  );
}
