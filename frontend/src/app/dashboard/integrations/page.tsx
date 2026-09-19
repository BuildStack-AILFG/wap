"use client";

import { useMemo, useState } from "react";
import { Search, Plug, CheckCircle2, AlertTriangle, LayoutGrid } from "lucide-react";
import { INTEGRATIONS, type Integration } from "@/components/dashboard/integrationsConfig";

const ACCENT = "#00926B";

const CATEGORIES: { id: Integration["category"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "messaging", label: "Messaging" },
  { id: "commerce", label: "Commerce" },
  { id: "payments", label: "Payments" },
  { id: "productivity", label: "Productivity" },
  { id: "automation", label: "Automation" },
];

function IntegrationCard({ integration, onConnect }: { integration: Integration; onConnect: (id: string) => void }) {
  const Icon = integration.icon;
  const connected = integration.status === "connected";

  return (
    <div
      className="flex flex-col rounded-2xl border bg-white/[0.03] p-5 backdrop-blur-xl transition-shadow hover:bg-white/[0.05]"
      style={{ borderColor: integration.primary ? `${ACCENT}4D` : "rgba(255,255,255,0.1)" }}
    >
      <div className="flex items-start justify-between">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: integration.iconColor ? `${integration.iconColor}26` : "rgba(255,255,255,0.1)" }}
        >
          <Icon className="h-5 w-5" style={integration.iconColor ? { color: integration.iconColor } : undefined} />
        </span>
        {connected ? (
          <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}>
            <CheckCircle2 className="h-3 w-3" /> Connected
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 text-[14.5px] font-bold text-white">{integration.name}</h3>
      <p className="mt-1 flex-1 text-[13px] leading-relaxed text-white/50">{integration.description}</p>

      <button
        type="button"
        onClick={() => onConnect(integration.id)}
        className="mt-4 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors"
        style={
          connected
            ? { border: "1px solid rgba(255,255,255,0.15)", color: "#FFFFFF" }
            : { backgroundColor: ACCENT, color: "#FFFFFF" }
        }
      >
        {connected ? "Manage" : "Connect"}
      </button>
    </div>
  );
}

export default function IntegrationsPage() {
  const [category, setCategory] = useState<Integration["category"] | "all">("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return INTEGRATIONS.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (query && !i.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (a.primary ? -1 : b.primary ? 1 : 0));
  }, [category, query]);

  const stats = useMemo(() => {
    const connected = INTEGRATIONS.filter((i) => i.status === "connected").length;
    const needsAttention = INTEGRATIONS.filter((i) => i.status === "needs_attention").length;
    return { available: INTEGRATIONS.length, connected, healthy: connected - needsAttention, needsAttention };
  }, []);

  const handleConnect = (id: string) => {
    const integration = INTEGRATIONS.find((i) => i.id === id);
    setNotice(
      integration?.id === "whatsapp"
        ? "Connecting a real WhatsApp Business number isn't wired up yet — this is where that flow will live."
        : `Connecting ${integration?.name} isn't wired up yet — coming soon.`
    );
    window.setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-[20px] font-bold text-white">Integrations</h1>
      <p className="mt-1 text-[13.5px] text-white/50">
        Connect WhatsApp and the tools you already use — no code required.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Available", value: stats.available, icon: LayoutGrid, color: ACCENT },
          { label: "Connected", value: stats.connected, icon: CheckCircle2, color: ACCENT },
          { label: "Healthy", value: stats.healthy, icon: Plug, color: "#60A5FA" },
          { label: "Needs attention", value: stats.needsAttention, icon: AlertTriangle, color: "#F59E0B" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${s.color}26` }}>
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
            </span>
            <p className="mt-2 text-[22px] font-bold text-white">{s.value}</p>
            <p className="text-[12px] text-white/50">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={
                category === c.id
                  ? { backgroundColor: ACCENT, color: "#FFFFFF" }
                  : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur-xl sm:w-64">
          <Search className="h-4 w-4 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search integrations"
            className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
          />
        </div>
      </div>

      {notice && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-300">{notice}</p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} onConnect={handleConnect} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-10 text-center text-[13.5px] text-white/50">No integrations match your search.</p>
      )}
    </div>
  );
}
