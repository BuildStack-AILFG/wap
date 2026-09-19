"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/kit";
import type { Member, Template } from "@/lib/api";
import { STEP_META, uid } from "./model";

type D = Record<string, unknown>;
type Props = { type: string; data: D; onChange: (d: D) => void; onDelete: () => void; templates: Template[]; members: Member[]; trigger: string };

const str = (v: unknown) => (v == null ? "" : String(v));
const HINT = "Merge fields: {{first_name}}, {{name}}, {{phone}}, {{trait.city}}, {{var.answer}}";

export default function Inspector({ type, data, onChange, onDelete, templates, members, trigger }: Props) {
  const set = (patch: D) => onChange({ ...data, ...patch });
  const meta = STEP_META[type];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div><div className="text-[14px] font-semibold text-white">{meta?.label ?? type}</div><div className="text-[12px] text-white/45">{meta?.description}</div></div>
        {type !== "start" && <Button size="sm" variant="danger" onClick={onDelete} aria-label="Delete step"><Trash2 size={13} /></Button>}
      </div>

      {type === "start" && (
        <>
          {trigger === "keyword" && <>
            <Field label="Keywords" hint="Comma separated. The flow starts when a message contains (or equals) one of them."><Input value={((data.keywords as string[]) ?? []).join(", ")} onChange={(e) => set({ keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })} placeholder="demo, pricing" /></Field>
            <Field label="Match"><Select value={str(data.match) || "contains"} onChange={(e) => set({ match: e.target.value })}><option value="contains">Message contains keyword</option><option value="exact">Message equals keyword</option></Select></Field></>}
          {trigger === "event" && <Field label="Event name" hint="Started when this event arrives via the API or an integration."><Input value={str(data.event)} onChange={(e) => set({ event: e.target.value.trim() })} placeholder="order_placed" /></Field>}
          {["incoming_message", "contact_created"].includes(trigger) && <Field label="Don't re-run for the same contact within (hours)"><Input type="number" min={0} value={str(data.cooldown_hours ?? 24)} onChange={(e) => set({ cooldown_hours: Number(e.target.value) })} /></Field>}
          {trigger === "manual" && <p className="text-[12.5px] text-white/50">Start this flow from “Test run” or with the API.</p>}
        </>
      )}

      {type === "send_message" && <Field label="Message" hint={HINT}><Textarea value={str(data.text)} onChange={(e) => set({ text: e.target.value })} maxLength={4096} /></Field>}

      {type === "send_media" && <>
        <Field label="Type"><Select value={str(data.media_type) || "image"} onChange={(e) => set({ media_type: e.target.value })}><option value="image">Image</option><option value="video">Video</option><option value="audio">Audio</option><option value="document">Document</option></Select></Field>
        <Field label="Public file URL" hint="https link WhatsApp can download"><Input value={str(data.url)} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" /></Field>
        {["image", "video", "document"].includes(str(data.media_type) || "image") && <Field label="Caption (optional)"><Input value={str(data.caption)} onChange={(e) => set({ caption: e.target.value })} /></Field>}
        {data.media_type === "document" && <Field label="File name"><Input value={str(data.filename)} onChange={(e) => set({ filename: e.target.value })} placeholder="brochure.pdf" /></Field>}
      </>}

      {type === "send_buttons" && (() => {
        const buttons = (data.buttons as { id: string; title: string }[]) ?? [];
        return <>
          <Field label="Message" hint={HINT}><Textarea value={str(data.body)} onChange={(e) => set({ body: e.target.value })} maxLength={1024} /></Field>
          <Field label="Header (optional)"><Input value={str(data.header)} onChange={(e) => set({ header: e.target.value })} maxLength={60} /></Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="text-[12.5px] font-medium text-white/70">Buttons ({buttons.length}/3)</span>{buttons.length < 3 && <Button size="sm" variant="ghost" onClick={() => set({ buttons: [...buttons, { id: uid("b"), title: "" }] })}><Plus size={12} /> Add</Button>}</div>
            {buttons.map((b, i) => <div key={b.id} className="mb-2 flex gap-2"><Input value={b.title} maxLength={20} onChange={(e) => set({ buttons: buttons.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Button text (max 20)" />
              {buttons.length > 1 && <button onClick={() => set({ buttons: buttons.filter((_, j) => j !== i) })} className="px-1 text-white/40 hover:text-red-300" aria-label="Remove button"><X size={15} /></button>}</div>)}
            <p className="text-[11.5px] text-white/40">Each button gets its own output — connect it to the next step.</p>
          </div>
        </>;
      })()}

      {type === "send_list" && (() => {
        const rows = ((data.sections as { title: string; rows: { id: string; title: string; description?: string }[] }[]) ?? [])[0]?.rows ?? [];
        const setRows = (r: typeof rows) => set({ sections: [{ title: "Options", rows: r }] });
        return <>
          <Field label="Message" hint={HINT}><Textarea value={str(data.body)} onChange={(e) => set({ body: e.target.value })} maxLength={1024} /></Field>
          <Field label="Menu button label"><Input value={str(data.button_text)} maxLength={20} onChange={(e) => set({ button_text: e.target.value })} /></Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="text-[12.5px] font-medium text-white/70">Options ({rows.length}/10)</span>{rows.length < 10 && <Button size="sm" variant="ghost" onClick={() => setRows([...rows, { id: uid("r"), title: "", description: "" }])}><Plus size={12} /> Add</Button>}</div>
            {rows.map((r, i) => <div key={r.id} className="mb-2 space-y-1 rounded-lg border border-white/10 p-2"><div className="flex gap-2"><Input value={r.title} maxLength={24} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Title (max 24)" />
              {rows.length > 1 && <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="px-1 text-white/40 hover:text-red-300" aria-label="Remove option"><X size={15} /></button>}</div>
              <Input value={r.description ?? ""} maxLength={72} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Description (optional)" /></div>)}
          </div>
        </>;
      })()}

      {type === "send_template" && (() => {
        const tpl = templates.find((t) => t.id === data.template_id);
        const v = (data.variables as { body?: string[]; header_text?: string; header_media?: string; buttons?: Record<string, string> }) ?? {};
        const setV = (p: Partial<typeof v>) => set({ variables: { ...v, ...p } });
        return <>
          <Field label="Template" hint="Only approved templates are listed"><Select value={str(data.template_id)} onChange={(e) => set({ template_id: e.target.value, variables: { body: [] } })}><option value="">Choose…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          {tpl && <div className="rounded-lg bg-[#005c4b]/30 p-2.5 text-[12.5px] whitespace-pre-wrap text-white/80">{tpl.body}</div>}
          {tpl?.requires.header_text && <Field label="Header value"><Input value={str(v.header_text)} onChange={(e) => setV({ header_text: e.target.value })} /></Field>}
          {tpl?.requires.header_media && <Field label={`Header ${tpl.requires.header_media} URL`}><Input value={str(v.header_media)} onChange={(e) => setV({ header_media: e.target.value })} /></Field>}
          {tpl?.requires.body.map((n, i) => <Field key={n} label={`Variable {{${n}}}`} hint={i === 0 ? HINT : undefined}><Input value={v.body?.[i] ?? ""} onChange={(e) => { const b = [...(v.body ?? [])]; b[i] = e.target.value; setV({ body: b }); }} /></Field>)}
          {tpl?.requires.buttons.map((i) => <Field key={i} label={`Button ${i + 1} URL value`}><Input value={v.buttons?.[String(i)] ?? ""} onChange={(e) => setV({ buttons: { ...(v.buttons ?? {}), [String(i)]: e.target.value } })} /></Field>)}
        </>;
      })()}

      {type === "ask_question" && <>
        <Field label="Question" hint={HINT}><Textarea value={str(data.question)} onChange={(e) => set({ question: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Save answer as"><Input value={str(data.key)} onChange={(e) => set({ key: e.target.value.trim().replace(/\s+/g, "_") })} placeholder="email" /></Field>
          <Field label="Save to"><Select value={str(data.save_as) || "trait"} onChange={(e) => set({ save_as: e.target.value })}><option value="trait">Contact detail (permanent)</option><option value="var">Flow variable (temporary)</option></Select></Field>
        </div>
        <Field label="Accept"><Select value={str(data.validation) || "text"} onChange={(e) => set({ validation: e.target.value })}><option value="text">Any text</option><option value="email">Email address</option><option value="phone">Phone number</option><option value="number">Number</option><option value="date">Date</option><option value="choice">One of these choices</option></Select></Field>
        {data.validation === "choice" && <Field label="Choices (one per line)"><Textarea value={((data.options as string[]) ?? []).join("\n")} onChange={(e) => set({ options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean) })} /></Field>}
        <div className="grid grid-cols-2 gap-3"><Field label="Max retries"><Input type="number" min={1} max={10} value={str(data.max_retries ?? 3)} onChange={(e) => set({ max_retries: Number(e.target.value) })} /></Field></div>
        <Field label="Message when invalid"><Input value={str(data.retry_message)} onChange={(e) => set({ retry_message: e.target.value })} /></Field>
        <p className="text-[11.5px] text-white/40">Outputs: <b>Answered</b> continues the flow. <b>Failed</b> runs after max retries — leave it unconnected to hand the chat to a human.</p>
      </>}

      {type === "condition" && (() => {
        const rules = (data.rules as { left: string; op: string; right: string }[]) ?? [];
        const setRules = (r: typeof rules) => set({ rules: r });
        return <>
          <Field label="Yes when"><Select value={str(data.match) || "all"} onChange={(e) => set({ match: e.target.value })}><option value="all">all rules match</option><option value="any">any rule matches</option></Select></Field>
          {rules.map((r, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-white/10 p-2">
              <div className="flex gap-2"><Select value={r.left.startsWith("var:") ? "var" : r.left.startsWith("trait:") ? "trait" : r.left} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, left: e.target.value === "var" ? "var:" : e.target.value === "trait" ? "trait:" : e.target.value } : x)))}>
                <option value="tag">Contact has tag</option><option value="last_message">Last message</option><option value="name">Name</option><option value="email">Email</option><option value="trait">Contact detail…</option><option value="var">Flow variable…</option></Select>
                <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="px-1 text-white/40 hover:text-red-300" aria-label="Remove rule"><X size={15} /></button></div>
              {(r.left.startsWith("var:") || r.left.startsWith("trait:")) && <Input value={r.left.split(":")[1]} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, left: `${r.left.split(":")[0]}:${e.target.value}` } : x)))} placeholder="field name" />}
              {r.left !== "tag" && <Select value={r.op} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}><option value="eq">is</option><option value="neq">is not</option><option value="contains">contains</option><option value="not_contains">doesn&apos;t contain</option><option value="gt">greater than</option><option value="lt">less than</option><option value="exists">is set</option><option value="not_exists">is empty</option></Select>}
              {!["exists", "not_exists"].includes(r.op) && <Input value={r.right} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} placeholder={r.left === "tag" ? "tag name" : "value"} />}
            </div>))}
          <Button size="sm" variant="ghost" onClick={() => setRules([...rules, { left: "tag", op: "eq", right: "" }])}><Plus size={12} /> Add rule</Button>
        </>;
      })()}

      {type === "delay" && <div className="grid grid-cols-2 gap-3"><Field label="Wait for"><Input type="number" min={1} value={str(data.amount)} onChange={(e) => set({ amount: Number(e.target.value) })} /></Field>
        <Field label="Unit"><Select value={str(data.unit) || "minutes"} onChange={(e) => set({ unit: e.target.value })}><option value="minutes">minutes</option><option value="hours">hours</option><option value="days">days</option></Select></Field></div>}

      {(type === "add_tag" || type === "remove_tag") && <Field label="Tag"><Input value={str(data.tag)} onChange={(e) => set({ tag: e.target.value })} placeholder="hot-lead" /></Field>}
      {type === "set_trait" && <><Field label="Detail name"><Input value={str(data.key)} onChange={(e) => set({ key: e.target.value.trim() })} placeholder="stage" /></Field><Field label="Value" hint={HINT}><Input value={str(data.value)} onChange={(e) => set({ value: e.target.value })} /></Field></>}
      {type === "assign_agent" && <Field label="Assign to"><Select value={str(data.user_id)} onChange={(e) => set({ user_id: e.target.value })}><option value="">By workspace assignment rules</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>)}</Select></Field>}
      {type === "webhook" && <>
        <Field label="URL" hint="Receives the contact + flow variables as JSON. Response fields become {{var.field}}."><Input value={str(data.url)} onChange={(e) => set({ url: e.target.value })} placeholder="https://api.example.com/lead" /></Field>
        <Field label="Method"><Select value={str(data.method) || "POST"} onChange={(e) => set({ method: e.target.value })}><option>POST</option><option>PUT</option><option>PATCH</option><option>GET</option></Select></Field>
        <p className="text-[11.5px] text-white/40">Private/internal addresses are blocked. Connect the <b>Error</b> output for failures.</p></>}
      {type === "ai_reply" && <Field label="Extra instructions (optional)" hint="Added to your AI agent's settings for this step only"><Textarea value={str(data.instructions)} onChange={(e) => set({ instructions: e.target.value })} /></Field>}
      {type === "handoff" && <Field label="Message to the customer (optional)"><Textarea value={str(data.message)} onChange={(e) => set({ message: e.target.value })} /></Field>}
      {type === "end" && <p className="text-[12.5px] text-white/50">The flow finishes here.</p>}
    </div>
  );
}
