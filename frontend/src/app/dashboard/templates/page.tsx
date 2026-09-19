"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, X, Trash2 } from "lucide-react";
import { listTemplates, createTemplate, deleteTemplate, ApiError, type ApiTemplate } from "@/lib/api";

const ACCENT = "#00926B";

type Category = "MARKETING" | "UTILITY" | "AUTHENTICATION";

const CATEGORY_LABELS: Record<Category, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utility",
  AUTHENTICATION: "Authentication",
};

const STATUS_STYLES: Record<ApiTemplate["status"], string> = {
  draft: "bg-white/10 text-white/50",
  pending: "bg-amber-500/15 text-amber-300",
  approved: "text-[#00926B]",
  rejected: "bg-red-500/10 text-red-400",
};

const LANGUAGES = ["en", "en_US", "hi", "es", "pt_BR"];

function emptyDraft() {
  return { name: "", category: "UTILITY" as Category, language: "en", body: "" };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load templates."))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setDraft(emptyDraft());
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!draft.name.trim() || !draft.body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createTemplate(draft);
      setTemplates((prev) => [created, ...prev]);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this template.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = templates;
    setTemplates((cur) => cur.filter((t) => t.id !== id));
    try {
      await deleteTemplate(id);
    } catch {
      setTemplates(prev);
      setError("Couldn't delete this template.");
    }
  };

  const placeholderCount = (draft.body.match(/\{\{\d+\}\}/g) ?? []).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
            <FileText className="h-5 w-5" style={{ color: ACCENT }} />
          </span>
          <div>
            <h1 className="text-[20px] font-bold text-white">Templates</h1>
            <p className="text-[13.5px] text-white/50">Pre-approved WhatsApp message templates, required for messages outside the 24-hour window.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus className="h-4 w-4" />
          Create Template
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}

      {showForm && (
        <div className="mt-5 rounded-2xl border p-4 backdrop-blur-xl" style={{ borderColor: `${ACCENT}4D`, backgroundColor: "rgba(255,255,255,0.03)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-white">New template</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[12px] font-semibold text-white/50">Template name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="order_confirmation"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-white/50">Language</label>
              <select
                value={draft.language}
                onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none focus:border-[#00926B]"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang} className="bg-black">
                    {lang}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[12px] font-semibold text-white/50">Category</label>
              <div className="mt-1 flex gap-2">
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, category: cat }))}
                    className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors"
                    style={
                      draft.category === cat
                        ? { backgroundColor: ACCENT, color: "#FFFFFF" }
                        : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }
                    }
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[12px] font-semibold text-white/50">
                Body — use {"{{1}}"}, {"{{2}}"} for variables
              </label>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                rows={3}
                placeholder="Hi {{1}}, your order #{{2}} has shipped."
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
              />
              <p className="mt-1 text-[11.5px] text-white/40">{placeholderCount} variable{placeholderCount === 1 ? "" : "s"} detected</p>
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
              onClick={handleSubmit}
              disabled={!draft.name.trim() || !draft.body.trim() || saving}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {saving ? "Submitting…" : "Submit for approval"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-[11.5px] font-semibold uppercase tracking-wide text-white/40">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Language</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-[12.5px] font-medium text-white">{t.name}</td>
                <td className="px-4 py-3 text-white/50">{CATEGORY_LABELS[t.category]}</td>
                <td className="px-4 py-3 text-white/50">{t.language}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${STATUS_STYLES[t.status]}`}
                    style={t.status === "approved" ? { backgroundColor: `${ACCENT}26` } : undefined}
                  >
                    {t.status[0].toUpperCase() + t.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
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

        {!loading && templates.length === 0 && (
          <p className="px-4 py-10 text-center text-[13.5px] text-white/50">No templates yet — create one to get started.</p>
        )}
        {loading && <p className="px-4 py-10 text-center text-[13.5px] text-white/50">Loading templates…</p>}
      </div>
    </div>
  );
}
