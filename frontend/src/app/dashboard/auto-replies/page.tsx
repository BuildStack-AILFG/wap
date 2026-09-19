"use client";

import { useEffect, useState } from "react";
import { MessageSquareReply, Sunrise, MoonStar, Clock3 } from "lucide-react";
import { getSettings, patchSettings, ApiError } from "@/lib/api";

const ACCENT = "#00926B";

type AutoReplyKind = {
  id: "welcome" | "away" | "delayed";
  title: string;
  description: string;
  icon: typeof Sunrise;
  placeholder: string;
};

const KINDS: AutoReplyKind[] = [
  {
    id: "welcome",
    title: "Welcome message",
    description: "Sent automatically the first time a new contact messages you.",
    icon: Sunrise,
    placeholder: "Hey! Thanks for reaching out — how can we help today?",
  },
  {
    id: "away",
    title: "Away message",
    description: "Sent outside your business hours, so contacts know when to expect a reply.",
    icon: MoonStar,
    placeholder: "We're offline right now, but we'll get back to you first thing tomorrow.",
  },
  {
    id: "delayed",
    title: "Delayed reply",
    description: "Sent if nobody on your team replies within a set number of minutes.",
    icon: Clock3,
    placeholder: "Thanks for your patience — a teammate will be with you shortly.",
  },
];

type EntryState = { enabled: boolean; message: string };
type State = Record<AutoReplyKind["id"], EntryState>;

const EMPTY_STATE: State = {
  welcome: { enabled: false, message: "" },
  away: { enabled: false, message: "" },
  delayed: { enabled: false, message: "" },
};

export default function AutoRepliesPage() {
  const [state, setState] = useState<State>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(({ settings }) => {
        const stored = (settings.auto_replies as Partial<State>) ?? {};
        setState({
          welcome: { ...EMPTY_STATE.welcome, ...stored.welcome },
          away: { ...EMPTY_STATE.away, ...stored.away },
          delayed: { ...EMPTY_STATE.delayed, ...stored.delayed },
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load auto-replies."))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (id: AutoReplyKind["id"]) => {
    const next = { ...state, [id]: { ...state[id], enabled: !state[id].enabled } };
    setState(next);
    try {
      await patchSettings({ auto_replies: next });
    } catch {
      setState(state);
      setError("Couldn't update that setting — reverted.");
    }
  };

  const updateMessage = (id: AutoReplyKind["id"], message: string) => {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], message } }));
  };

  const handleSave = async (id: AutoReplyKind["id"], title: string) => {
    try {
      await patchSettings({ auto_replies: state });
      setSavedNotice(`${title} saved.`);
      window.setTimeout(() => setSavedNotice(null), 2500);
    } catch {
      setError("Couldn't save this message.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
          <MessageSquareReply className="h-5 w-5" style={{ color: ACCENT }} />
        </span>
        <div>
          <h1 className="text-[20px] font-bold text-white">Auto-Replies</h1>
          <p className="text-[13.5px] text-white/50">Simple, always-on replies for welcome, away, and delayed-response moments.</p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}
      {savedNotice && (
        <p className="mt-4 rounded-lg px-3 py-2 text-[12.5px]" style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}>
          {savedNotice}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-center text-[13.5px] text-white/50">Loading…</p>
      ) : (
        <div className="mt-5 space-y-4">
          {KINDS.map((kind) => {
            const value = state[kind.id];
            return (
              <div key={kind.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <kind.icon className="h-4 w-4 text-white/60" />
                    </span>
                    <div>
                      <h3 className="text-[14px] font-bold text-white">{kind.title}</h3>
                      <p className="mt-0.5 text-[12.5px] text-white/50">{kind.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={value.enabled}
                    onClick={() => toggle(kind.id)}
                    className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                    style={{ backgroundColor: value.enabled ? ACCENT : "rgba(255,255,255,0.15)" }}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        value.enabled ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {value.enabled && (
                  <div className="mt-4">
                    <textarea
                      value={value.message}
                      onChange={(e) => updateMessage(kind.id, e.target.value)}
                      placeholder={kind.placeholder}
                      rows={2}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B]"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSave(kind.id, kind.title)}
                        className="rounded-lg px-4 py-1.5 text-[12.5px] font-semibold text-white"
                        style={{ backgroundColor: ACCENT }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
