import type { FlowGraph, FlowNode } from "@/lib/api";

export const TRIGGERS = [
  { id: "incoming_message", label: "Any incoming message", hint: "Runs the first time a contact writes (once per cooldown)." },
  { id: "keyword", label: "Keyword message", hint: "Runs when a message contains or equals one of your keywords." },
  { id: "contact_created", label: "New contact messages first", hint: "Runs on a new contact's very first message." },
  { id: "campaign_reply", label: "Reply to a campaign", hint: "Runs when someone who got a broadcast in the last 72h writes back." },
  { id: "event", label: "Event (API / integrations)", hint: "Runs when an event with this name is received, e.g. order_placed." },
  { id: "manual", label: "Manual / API only", hint: "Started from the dashboard's Test run or the API." },
] as const;

export type StepType =
  | "send_message" | "send_media" | "send_buttons" | "send_list" | "send_template" | "ask_question" | "condition" | "delay"
  | "add_tag" | "remove_tag" | "set_trait" | "assign_agent" | "webhook" | "ai_reply" | "handoff" | "end";

export const STEP_META: Record<string, { label: string; group: "Messages" | "Logic" | "Contact" | "Advanced"; color: string; description: string }> = {
  start: { label: "Start", group: "Logic", color: "#00926B", description: "Where the flow begins" },
  send_message: { label: "Send message", group: "Messages", color: "#2563EB", description: "A text message" },
  send_media: { label: "Send media", group: "Messages", color: "#2563EB", description: "Image, video, audio or file" },
  send_buttons: { label: "Buttons", group: "Messages", color: "#7C3AED", description: "Up to 3 quick-reply buttons; branch on the tap" },
  send_list: { label: "List menu", group: "Messages", color: "#7C3AED", description: "Up to 10 options in a menu" },
  send_template: { label: "Send template", group: "Messages", color: "#2563EB", description: "Approved template (works outside 24h)" },
  ask_question: { label: "Ask a question", group: "Messages", color: "#D97706", description: "Wait for a reply, validate and save it" },
  condition: { label: "Condition", group: "Logic", color: "#DB2777", description: "Branch yes / no" },
  delay: { label: "Wait", group: "Logic", color: "#6B7280", description: "Pause for minutes, hours or days" },
  add_tag: { label: "Add tag", group: "Contact", color: "#0891B2", description: "Tag the contact" },
  remove_tag: { label: "Remove tag", group: "Contact", color: "#0891B2", description: "Remove a tag" },
  set_trait: { label: "Set detail", group: "Contact", color: "#0891B2", description: "Save a custom field" },
  assign_agent: { label: "Assign agent", group: "Contact", color: "#0891B2", description: "Assign the chat to a teammate" },
  webhook: { label: "Call webhook", group: "Advanced", color: "#475569", description: "HTTP request to your system" },
  ai_reply: { label: "AI reply", group: "Advanced", color: "#9333EA", description: "Answer from your knowledge base" },
  handoff: { label: "Hand over to human", group: "Advanced", color: "#DC2626", description: "Stop automation, notify the team" },
  end: { label: "End", group: "Logic", color: "#6B7280", description: "Finish the flow" },
};

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

export function defaultData(type: string): Record<string, unknown> {
  switch (type) {
    case "send_message": return { text: "" };
    case "send_media": return { media_type: "image", url: "", caption: "" };
    case "send_buttons": return { body: "", buttons: [{ id: uid("b"), title: "Yes" }, { id: uid("b"), title: "No" }] };
    case "send_list": return { body: "", button_text: "Choose", sections: [{ title: "Options", rows: [{ id: uid("r"), title: "Option 1", description: "" }, { id: uid("r"), title: "Option 2", description: "" }] }] };
    case "send_template": return { template_id: "", variables: { body: [] } };
    case "ask_question": return { question: "", key: "", save_as: "trait", validation: "text", max_retries: 3, retry_message: "Sorry, that doesn't look right. Please try again." };
    case "condition": return { match: "all", rules: [{ left: "tag", op: "eq", right: "" }] };
    case "delay": return { amount: 10, unit: "minutes" };
    case "add_tag": case "remove_tag": return { tag: "" };
    case "set_trait": return { key: "", value: "" };
    case "webhook": return { url: "", method: "POST" };
    case "ai_reply": return { instructions: "" };
    case "handoff": return { message: "Connecting you with a teammate — they'll reply here shortly." };
    default: return {};
  }
}

const n = (id: string, type: string, x: number, y: number, data: Record<string, unknown> = {}): FlowNode => ({ id, type, position: { x, y }, data });
const e = (source: string, target: string, sourceHandle = "next") => ({ id: `${source}-${sourceHandle}-${target}`, source, target, sourceHandle });

export const PRESETS: { id: string; label: string; description: string; trigger: string; graph: () => FlowGraph }[] = [
  { id: "blank", label: "Blank canvas", description: "Just a Start step — build it yourself.", trigger: "incoming_message", graph: () => ({ nodes: [n("start", "start", 60, 160, { label: "Start", cooldown_hours: 24 })], edges: [] }) },
  {
    id: "lead", label: "Lead qualification", trigger: "keyword", description: "Triggered by the word “demo”: greets, asks for an email (validated), asks which plan they want, tags them and hands hot leads to your team.",
    graph: () => ({
      nodes: [n("start", "start", 40, 180, { label: "Start", keywords: ["demo", "pricing"], match: "contains" }),
        n("hello", "send_message", 300, 180, { text: "Great to hear from you {{first_name}}! Let me grab a couple of details." }),
        n("email", "ask_question", 560, 180, { question: "What's your work email?", key: "email", save_as: "trait", validation: "email", max_retries: 2, retry_message: "That doesn't look like an email — could you try again?" }),
        n("plan", "send_buttons", 840, 180, { body: "Which plan are you interested in?", buttons: [{ id: "starter", title: "Starter" }, { id: "growth", title: "Growth" }] }),
        n("tag1", "add_tag", 1140, 100, { tag: "interest-starter" }), n("tag2", "add_tag", 1140, 280, { tag: "interest-growth" }),
        n("hand", "handoff", 1420, 280, { message: "Thanks! A specialist will reach out shortly." }), n("bye", "end", 1420, 100)],
      edges: [e("start", "hello"), e("hello", "email"), e("email", "plan", "success"), e("plan", "tag1", "starter"), e("plan", "tag2", "growth"), e("tag1", "bye"), e("tag2", "hand")],
    }),
  },
  {
    id: "menu", label: "Support menu", trigger: "keyword", description: "Triggered by “menu” or “help”: shows a list of topics and answers each one, or hands over to an agent.",
    graph: () => ({
      nodes: [n("start", "start", 40, 200, { label: "Start", keywords: ["menu", "help"], match: "contains" }),
        n("list", "send_list", 300, 200, { body: "How can we help you today?", button_text: "Choose a topic", sections: [{ title: "Topics", rows: [{ id: "hours", title: "Opening hours", description: "" }, { id: "orders", title: "Track my order", description: "" }, { id: "agent", title: "Talk to a person", description: "" }] }] }),
        n("hours", "send_message", 640, 60, { text: "We're open Monday–Saturday, 9am–7pm." }), n("orders", "send_message", 640, 220, { text: "Please share your order number and we'll look it up." }),
        n("agent", "handoff", 640, 380, { message: "Sure — connecting you to a teammate now." }), n("end", "end", 940, 140)],
      edges: [e("start", "list"), e("list", "hours", "hours"), e("list", "orders", "orders"), e("list", "agent", "agent"), e("hours", "end"), e("orders", "end")],
    }),
  },
  {
    id: "followup", label: "Follow-up after silence", trigger: "incoming_message", description: "Sends a thank-you, waits a day, then checks in with a template (works after the 24-hour window).",
    graph: () => ({
      nodes: [n("start", "start", 40, 160, { label: "Start", cooldown_hours: 72 }), n("thanks", "send_message", 300, 160, { text: "Thanks for reaching out! We'll get back to you soon." }),
        n("wait", "delay", 560, 160, { amount: 1, unit: "days" }), n("tpl", "send_template", 820, 160, { template_id: "", variables: { body: ["{{first_name}}"] } }), n("end", "end", 1080, 160)],
      edges: [e("start", "thanks"), e("thanks", "wait"), e("wait", "tpl"), e("tpl", "end")],
    }),
  },
];

/** Outputs a step exposes: [handleId, label]. */
export function outputsFor(node: { type: string; data: Record<string, unknown> }): [string, string][] {
  const d = node.data;
  switch (node.type) {
    case "condition": return [["true", "Yes"], ["false", "No"]];
    case "ask_question": return [["success", "Answered"], ["failed", "Failed"]];
    case "send_buttons": return [...((d.buttons as { id: string; title: string }[]) ?? []).map((b) => [b.id, b.title || "Button"] as [string, string]), ["default", "Other reply"]];
    case "send_list": return [...(((d.sections as { rows: { id: string; title: string }[] }[]) ?? []).flatMap((s) => s.rows).map((r) => [r.id, r.title || "Option"] as [string, string])), ["default", "Other reply"]];
    case "webhook": return [["next", "Success"], ["error", "Error"]];
    case "end": case "handoff": return [];
    default: return [["next", ""]];
  }
}

export function summarize(node: { type: string; data: Record<string, unknown> }): string {
  const d = node.data;
  const s = (v: unknown) => String(v ?? "").slice(0, 70);
  switch (node.type) {
    case "start": return d.keywords ? `Keywords: ${(d.keywords as string[]).join(", ")}` : d.event ? `Event: ${s(d.event)}` : "Flow begins here";
    case "send_message": return s(d.text) || "Empty message";
    case "send_media": return `${s(d.media_type)}: ${s(d.url) || "no URL yet"}`;
    case "send_buttons": case "send_list": return s(d.body) || "No text yet";
    case "send_template": return d.template_id ? "Template selected" : "Choose a template";
    case "ask_question": return `${s(d.question) || "No question yet"} → ${s(d.key) || "?"}`;
    case "condition": return `${(d.rules as unknown[] | undefined)?.length ?? 0} rule(s)`;
    case "delay": return `Wait ${s(d.amount)} ${s(d.unit)}`;
    case "add_tag": case "remove_tag": return s(d.tag) || "No tag yet";
    case "set_trait": return `${s(d.key) || "?"} = ${s(d.value)}`;
    case "assign_agent": return d.user_id ? "Specific teammate" : "By workspace rules";
    case "webhook": return `${s(d.method)} ${s(d.url) || "no URL yet"}`;
    case "ai_reply": return "Answers from your knowledge base";
    case "handoff": return s(d.message) || "Notifies your team";
    default: return "";
  }
}
