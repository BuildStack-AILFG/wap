"use client";

import { useEffect, useMemo, useState } from "react";
import { Users2, Plus, X, Trash2 } from "lucide-react";
import { listContacts, ApiError, type ApiContact } from "@/lib/api";

const ACCENT = "#00926B";

type Segment = {
  id: string;
  name: string;
  tag: string;
};

const SEED_SEGMENTS: Segment[] = [
  { id: "1", name: "VIP Customers", tag: "vip-customers" },
  { id: "2", name: "Trial Users", tag: "trial" },
];

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>(SEED_SEGMENTS);
  const [contacts, setContacts] = useState<ApiContact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");

  useEffect(() => {
    listContacts()
      .then(setContacts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load contacts."));
  }, []);

  const countForTag = (t: string) => contacts.filter((c) => !c.opted_out && c.tags.includes(t)).length;

  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [contacts]);

  const handleCreate = () => {
    if (!name.trim() || !tag) return;
    setSegments((prev) => [{ id: crypto.randomUUID(), name: name.trim(), tag }, ...prev]);
    setShowForm(false);
    setName("");
    setTag("");
  };

  const handleDelete = (id: string) => setSegments((prev) => prev.filter((s) => s.id !== id));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
            <Users2 className="h-5 w-5" style={{ color: ACCENT }} />
          </span>
          <div>
            <h1 className="text-[20px] font-bold text-white">Segments</h1>
            <p className="text-[13.5px] text-white/50">Saved contact groups by tag, ready to target with a broadcast.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={allTags.length === 0}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus className="h-4 w-4" />
          New Segment
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}

      {showForm && (
        <div className="mt-5 rounded-2xl border p-4 backdrop-blur-xl" style={{ borderColor: `${ACCENT}4D`, backgroundColor: "rgba(255,255,255,0.03)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-white">New segment</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[12px] font-semibold text-white/50">Segment name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mumbai Leads"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-white/50">Contacts tagged with</label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none focus:border-[#00926B]"
              >
                <option value="" className="bg-black">Select a tag</option>
                {allTags.map((t) => (
                  <option key={t} value={t} className="bg-black">
                    {t}
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
              disabled={!name.trim() || !tag}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              Create segment
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {segments.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-white">{s.name}</h3>
                <p className="mt-0.5 text-[12.5px] text-white/50">
                  tag: <span className="font-mono">{s.tag}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-3 text-[24px] font-bold" style={{ color: ACCENT }}>{countForTag(s.tag)}</p>
            <p className="text-[11.5px] text-white/40">opted-in contacts</p>
          </div>
        ))}
      </div>

      {segments.length === 0 && (
        <p className="mt-10 text-center text-[13.5px] text-white/50">No segments yet — create one to target a broadcast.</p>
      )}
    </div>
  );
}
