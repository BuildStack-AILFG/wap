"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Sparkles, Workflow, Globe, FileText, ListChecks, ShoppingBag } from "lucide-react";
import { AI_AGENT_PERSONAS, type AiAgentPersona, type TrainingResourceKind } from "@/components/dashboard/aiAgentConfig";
import { getSettings, patchSettings, ApiError } from "@/lib/api";

const ACCENT = "#00926B";

const RESOURCE_ICON: Record<TrainingResourceKind, typeof Globe> = {
  website: Globe,
  documents: FileText,
  qualification_fields: ListChecks,
  catalog: ShoppingBag,
};

function PersonaCard({
  persona,
  enabled,
  onToggle,
  onConfigure,
}: {
  persona: AiAgentPersona;
  enabled: boolean;
  onToggle: (id: string) => void;
  onConfigure: (id: string) => void;
}) {
  const Icon = persona.icon;

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-shadow hover:bg-white/[0.05]">
      <div className="flex items-start justify-between">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${persona.accentColor}26` }}
        >
          <Icon className="h-5 w-5" style={{ color: persona.accentColor }} />
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(persona.id)}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: enabled ? ACCENT : "rgba(255,255,255,0.15)" }}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <h3 className="mt-3 text-[14.5px] font-bold text-white">{persona.name}</h3>
      <p className="mt-0.5 text-[12.5px] font-semibold text-white/50">{persona.tagline}</p>
      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/50">{persona.description}</p>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-white/30">Training resources</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {persona.trainingResources.map((resource) => {
          const ResourceIcon = RESOURCE_ICON[resource.kind];
          return (
            <span
              key={resource.kind}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-medium text-white/70"
            >
              <ResourceIcon className="h-3 w-3" />
              {resource.label}
            </span>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onConfigure(persona.id)}
        className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/5"
      >
        Configure
      </button>
    </div>
  );
}

export default function AiAgentPage() {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(({ settings }) => {
        const stored = (settings.ai_agents as Record<string, boolean>) ?? {};
        setEnabledIds(new Set(Object.entries(stored).filter(([, v]) => v).map(([k]) => k)));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load AI Agent settings."));
  }, []);

  const activeCount = useMemo(() => enabledIds.size, [enabledIds]);

  const handleToggle = async (id: string) => {
    const wasEnabled = enabledIds.has(id);
    const next = new Set(enabledIds);
    if (wasEnabled) next.delete(id); else next.add(id);
    setEnabledIds(next);

    const ai_agents = Object.fromEntries(AI_AGENT_PERSONAS.map((p) => [p.id, next.has(p.id)]));
    try {
      await patchSettings({ ai_agents });
    } catch {
      setEnabledIds(enabledIds);
      setError("Couldn't update that agent — reverted.");
    }
  };

  const handleConfigure = (id: string) => {
    const persona = AI_AGENT_PERSONAS.find((p) => p.id === id);
    setNotice(`Configuring the ${persona?.name} isn't wired up yet — training resources and prompts will live here.`);
    window.setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
          <Bot className="h-5 w-5" style={{ color: ACCENT }} />
        </span>
        <div>
          <h1 className="text-[20px] font-bold text-white">AI Agent</h1>
          <p className="text-[13.5px] text-white/50">
            Let AI qualify leads, answer support questions, and guide sales — as a backstop behind your own automations.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3.5">
        <Workflow className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
        <p className="text-[13px] leading-relaxed text-blue-200">
          <span className="font-semibold">Works alongside your existing automations.</span> Auto-Replies and Flow Builder
          always take priority — an AI agent only responds when nothing else matches, and never while a conversation is
          marked as taken over by a teammate.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
        <Sparkles className="h-4 w-4 text-white/40" />
        <p className="text-[13px] text-white/50">
          {activeCount === 0
            ? "No AI agents are enabled yet."
            : `${activeCount} of ${AI_AGENT_PERSONAS.length} agents enabled.`}{" "}
          Each agent trains on its own set of resources, so a Support Agent won't try to sell and a Sales Agent won't
          answer unrelated tickets.
        </p>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-300">{notice}</p>}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AI_AGENT_PERSONAS.map((persona) => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            enabled={enabledIds.has(persona.id)}
            onToggle={handleToggle}
            onConfigure={handleConfigure}
          />
        ))}
      </div>
    </div>
  );
}
