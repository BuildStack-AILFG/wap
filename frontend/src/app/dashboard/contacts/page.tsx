"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus, X, Search } from "lucide-react";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  ApiError,
  type ApiContact,
} from "@/lib/api";

const ACCENT = "#00926B";

function emptyDraft() {
  return { name: "", phone: "", tags: "" };
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ApiContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listContacts()
      .then(setContacts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load contacts."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [contacts, query]);

  const handleAdd = async () => {
    if (!draft.name.trim() || !draft.phone.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createContact({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        tags: draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setContacts((prev) => [created, ...prev]);
      setShowForm(false);
      setDraft(emptyDraft());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add this contact.");
    } finally {
      setSaving(false);
    }
  };

  const toggleOptOut = async (contact: ApiContact) => {
    const next = !contact.opted_out;
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, opted_out: next } : c)));
    try {
      await updateContact(contact.id, { opted_out: next });
    } catch {
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, opted_out: !next } : c)));
      setError("Couldn't update that contact — reverted.");
    }
  };

  const handleDelete = async (id: string) => {
    const prev = contacts;
    setContacts((cur) => cur.filter((c) => c.id !== id));
    try {
      await deleteContact(id);
    } catch {
      setContacts(prev);
      setError("Couldn't delete that contact.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
            <ClipboardCheck className="h-5 w-5" style={{ color: ACCENT }} />
          </span>
          <div>
            <h1 className="text-[20px] font-bold text-white">Contacts</h1>
            <p className="text-[13.5px] text-white/50">Everyone who's messaged you or come in through an integration.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus className="h-4 w-4" />
          Add Contact
        </button>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur-xl sm:w-80">
        <Search className="h-4 w-4 text-white/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or tag"
          className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
        />
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}

      {showForm && (
        <div className="mt-4 rounded-2xl border p-4 backdrop-blur-xl" style={{ borderColor: `${ACCENT}4D`, backgroundColor: "rgba(255,255,255,0.03)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-white">New contact</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Full name"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
            />
            <input
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
            />
            <input
              value={draft.tags}
              onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
              placeholder="Tags (comma separated)"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
            />
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
              onClick={handleAdd}
              disabled={!draft.name.trim() || !draft.phone.trim() || saving}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {saving ? "Adding…" : "Add contact"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-[11.5px] font-semibold uppercase tracking-wide text-white/40">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                <td className="px-4 py-3 text-white/50">{c.phone}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.length === 0 ? (
                      <span className="text-white/30">—</span>
                    ) : (
                      c.tags.map((t) => (
                        <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70">
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-white/50 capitalize">{c.source.replace("_", " ")}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleOptOut(c)}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                      c.opted_out ? "bg-red-500/10 text-red-400" : ""
                    }`}
                    style={!c.opted_out ? { backgroundColor: `${ACCENT}26`, color: ACCENT } : undefined}
                  >
                    {c.opted_out ? "Opted out" : "Opted in"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-[12px] font-semibold text-white/50 hover:text-red-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-[13.5px] text-white/50">
            {contacts.length === 0 ? "No contacts yet — add your first one." : "No contacts match your search."}
          </p>
        )}
        {loading && <p className="px-4 py-10 text-center text-[13.5px] text-white/50">Loading contacts…</p>}
      </div>
    </div>
  );
}
