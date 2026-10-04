"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Download, FileUp, Plus, Trash2, Workflow } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Page, PageHeader, Select, Spinner, statusTone, Textarea, timeAgo, useUi } from "@/components/ui/kit";
import { errorMessage, flows as api, type FlowGraph, type FlowSummary } from "@/lib/api";
import { PRESETS, TRIGGERS } from "@/components/flow/model";

export default function FlowsPage() {
  const router = useRouter();
  const { toast, confirm } = useUi();
  const [list, setList] = useState<FlowSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState("blank");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [json, setJson] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [importErr, setImportErr] = useState<string | null>(null);

  const load = useCallback(async () => { try { setList(await api.list()); } catch (e) { setError(errorMessage(e, "Couldn't load flows.")); } }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const p = PRESETS.find((x) => x.id === preset)!;
      const f = await api.create({ name: name.trim(), trigger_type: p.trigger, graph: p.graph() as FlowGraph });
      router.push(`/dashboard/flow-builder/${f.id}`);
    } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };

  /** Accepts an exported flow ({name, trigger_type, graph}) or a bare graph ({nodes, edges}). */
  const importFlow = async () => {
    setImportErr(null);
    let parsed: { name?: string; trigger_type?: string; graph?: FlowGraph; nodes?: unknown; edges?: unknown };
    try { parsed = JSON.parse(json); } catch { setImportErr("That isn't valid JSON."); return; }
    const graph = (parsed.graph ?? (Array.isArray(parsed.nodes) ? { nodes: parsed.nodes, edges: parsed.edges ?? [] } : null)) as FlowGraph | null;
    if (!graph || !Array.isArray(graph.nodes)) { setImportErr("The JSON needs a \"graph\" with \"nodes\" and \"edges\"."); return; }
    setBusy(true);
    try {
      const f = await api.create({ name: (parsed.name || "Imported flow").slice(0, 200), trigger_type: parsed.trigger_type || "incoming_message", graph });
      if (publishNow) {
        try { await api.publish(f.id); toast("Flow imported and published"); }
        catch (e) { toast(`Imported as a draft — ${errorMessage(e)}`, "error"); }
      } else toast("Flow imported");
      router.push(`/dashboard/flow-builder/${f.id}`);
    } catch (e) { setImportErr(errorMessage(e)); setBusy(false); }
  };

  const exportFlow = async (id: string) => {
    try {
      const f = await api.get(id);
      const blob = new Blob([JSON.stringify({ name: f.name, trigger_type: f.trigger_type, graph: f.graph }, null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${f.name.replace(/[^\w-]+/g, "-").toLowerCase() || "flow"}.json` });
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <Page>
      <PageHeader icon={<Workflow size={20} />} title="Flow builder" subtitle="Design automated conversations: ask questions, branch on answers, send templates, wait, call your systems, or hand over to a human."
        actions={<><Button variant="ghost" onClick={() => { setJson(""); setImportErr(null); setImporting(true); }}><FileUp size={15} /> Import JSON</Button><Button onClick={() => setShow(true)}><Plus size={15} /> New flow</Button></>} />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {!list ? <Spinner /> : list.length === 0 ? <EmptyState icon={<Workflow size={22} />} title="No flows yet" body="Start from a ready-made flow or a blank canvas." action={<Button onClick={() => setShow(true)}><Plus size={15} /> Create your first flow</Button>} /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-white/10 text-[11.5px] uppercase tracking-wide text-white/40"><tr><th className="px-5 py-3">Flow</th><th className="px-2 py-3">Trigger</th><th className="px-2 py-3">Status</th><th className="hidden px-2 py-3 md:table-cell">Steps</th><th className="hidden px-2 py-3 md:table-cell">Runs</th><th className="px-2 py-3">Updated</th><th className="px-5 py-3" /></tr></thead>
            <tbody>{list.map((f) => (
              <tr key={f.id} className="border-b border-white/5 hover:bg-white/[0.04]">
                <td className="px-5 py-3"><Link href={`/dashboard/flow-builder/${f.id}`} className="font-medium text-white hover:underline">{f.name}</Link></td>
                <td className="px-2 py-3 text-white/60">{TRIGGERS.find((t) => t.id === f.trigger_type)?.label ?? f.trigger_type}</td>
                <td className="px-2 py-3"><Badge tone={statusTone(f.status)}>{f.status}</Badge>{f.has_unpublished_changes && <Badge tone="yellow" className="ml-1">unpublished edits</Badge>}</td>
                <td className="hidden px-2 py-3 text-white/60 md:table-cell">{f.node_count}</td><td className="hidden px-2 py-3 text-white/60 md:table-cell">{f.conversations_sent.toLocaleString()}</td>
                <td className="px-2 py-3 text-white/45">{timeAgo(f.updated_at)}</td>
                <td className="px-5 py-3"><div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" aria-label="Export JSON" onClick={() => exportFlow(f.id)}><Download size={13} /></Button>
                  <Button size="sm" variant="ghost" aria-label="Duplicate" onClick={async () => { try { await api.duplicate(f.id); toast("Flow duplicated"); await load(); } catch (e) { toast(errorMessage(e), "error"); } }}><Copy size={13} /></Button>
                  <Button size="sm" variant="danger" aria-label="Delete" onClick={async () => { if (await confirm({ title: `Delete “${f.name}”?`, body: "Running conversations in this flow are stopped.", confirmLabel: "Delete", danger: true })) { try { await api.remove(f.id); await load(); toast("Flow deleted"); } catch (e) { toast(errorMessage(e), "error"); } } }}><Trash2 size={13} /></Button></div></td>
              </tr>))}</tbody>
          </table>
        </Card>
      )}
      <Modal open={show} onClose={() => setShow(false)} title="New flow" width={520} footer={<><Button variant="ghost" onClick={() => setShow(false)}>Cancel</Button><Button loading={busy} disabled={!name.trim()} onClick={create}>Create & open</Button></>}>
        <Field label="Flow name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead qualification" autoFocus /></Field>
        <Field className="mt-3" label="Start from"><Select value={preset} onChange={(e) => setPreset(e.target.value)}>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
        <p className="mt-2 text-[12.5px] text-white/45">{PRESETS.find((p) => p.id === preset)?.description}</p>
      </Modal>
      <Modal open={importing} onClose={() => setImporting(false)} title="Import flow from JSON" width={620} footer={<><Button variant="ghost" onClick={() => setImporting(false)}>Cancel</Button><Button loading={busy} disabled={!json.trim()} onClick={importFlow}>Import</Button></>}>
        {importErr && <Alert onClose={() => setImportErr(null)}>{importErr}</Alert>}
        <Field label="Flow JSON" hint="Paste it, or choose a .json file exported from the Flow builder.">
          <Textarea value={json} onChange={(e) => setJson(e.target.value)} rows={12} className="font-mono text-[12px]" placeholder='{ "name": "…", "trigger_type": "incoming_message", "graph": { "nodes": [], "edges": [] } }' />
        </Field>
        <input type="file" accept="application/json,.json" className="mt-2 text-[12.5px] text-white/60" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setJson(await file.text()); }} />
        <label className="mt-3 flex items-center gap-2 text-[12.5px] text-white/70"><input type="checkbox" className="accent-brand" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />Publish right away so it starts replying</label>
      </Modal>
    </Page>
  );
}
