"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HelpCircle, Zap, Store, ShoppingCart, MapPin, CreditCard, CheckCircle2, Info } from "lucide-react";
import { Alert, Button, Card, Field, Page, Select, Spinner, Textarea, Toggle, useUi } from "@/components/ui/kit";
import { commerce as api, errorMessage, type CommerceConfig, type CommerceSettings } from "@/lib/api";

/** Fallback so the page still works against an older backend whose stored config lacks the newer flow keys. */
const CFG_DEFAULTS: CommerceConfig = {
  welcome_message: "", collect_address: true, collect_email: false, confirmation_message: "", payment_instructions: "",
  checkout_live: false, payment_mode: "cod", free_shipping: true,
  proceed_message: "Thanks for your cart! We currently deliver for free all over India.\nYour total order value = {total_order_value}. Would you like to proceed?",
  address_message: "Great! We'll need a few details to ship your order. Please share your full name.",
  payment_message: "We only offer Cash on Delivery right now. Would you like to confirm the order?",
  order_placed_message: "Your order is placed! 🎉\n\nHey {{1}}, thanks for confirming. We're getting your order ready and will send you updates soon.",
};

export default function CheckoutBotPage() {
  const { toast } = useUi();
  const [s, setS] = useState<CommerceSettings | null>(null);
  const [cfg, setCfg] = useState<CommerceConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    api.settings().then((v) => { setS(v); setCfg({ ...CFG_DEFAULTS, ...v.config }); }).catch((e) => setError(errorMessage(e, "Couldn't load the checkout flow.")));
  }, []);

  const patch = (p: Partial<CommerceConfig>) => setCfg((c) => (c ? { ...c, ...p } : c));

  async function save(extra?: Partial<CommerceConfig>) {
    if (!cfg) return;
    setSaving(true);
    try { const v = await api.updateSettings({ config: { ...cfg, ...extra } }); setS(v); setCfg(v.config); toast("Checkout flow saved"); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setSaving(false); }
  }

  if (error) return <Page><Alert>{error}</Alert></Page>;
  if (!s || !cfg) return <Page><Spinner /></Page>;

  const connected = !!s.meta_catalog_id;
  const stepsRemaining = [connected, cfg.proceed_message.trim(), cfg.order_placed_message.trim()].filter((x) => !x).length;

  return (
    <Page wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[14px] font-semibold text-white"><Zap size={15} className="text-[var(--brand)]" /> Auto Checkout Flow</span>
          <Button variant="ghost" size="sm"><HelpCircle size={14} /> What&apos;s This?</Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-white/10 px-3 py-1.5 text-[12.5px] text-white/55">{stepsRemaining}/3 steps remaining</span>
          <Button variant={cfg.checkout_live ? "danger" : "primary"} loading={saving} disabled={stepsRemaining > 0 && !cfg.checkout_live}
            onClick={() => save({ checkout_live: !cfg.checkout_live })}>
            <Zap size={14} /> {cfg.checkout_live ? "Set Offline" : "Set Live"}
          </Button>
        </div>
      </div>

      {!connected && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13.5px] text-amber-200">
          <Store size={16} /> To use the workflow, a catalog should be connected. Connect from <Link href="/dashboard/commerce-settings" className="font-semibold underline">here</Link>.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* Flow preview */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-medium uppercase tracking-wide text-white/40">Flow preview</div>
            <Button variant="ghost" size="sm" onClick={() => setEdit((v) => !v)}>{edit ? "Done editing" : "Edit messages"}</Button>
          </div>
          <div className="theme-fixed mt-4 space-y-3 rounded-xl bg-[#0b141a] p-4">
            <FlowStep icon={<ShoppingCart size={14} />} tag="Trigger Point">
              <div className="rounded-lg border border-white/10 p-3">
                <div className="flex items-center gap-2 text-[13px] text-white/80"><ShoppingCart size={14} /> 4 items</div>
                <div className="text-[12.5px] text-white/50">₹ 12,000.00 (estimated total)</div>
                <div className="mt-2 text-[13px] text-white/85">Hey, I love these products. I&apos;d like to buy them.</div>
                <div className="mt-2 rounded-md border border-white/10 py-1.5 text-center text-[12.5px] text-white/60">View Sent Cart</div>
              </div>
            </FlowStep>

            <FlowStep tag="Confirm order value">
              <Bubble edit={edit} value={cfg.proceed_message} onChange={(v) => patch({ proceed_message: v })} />
              <Choices options={["Yes", "No"]} />
            </FlowStep>

            <FlowStep icon={<MapPin size={14} />} tag="Collect shipping address" muted={!cfg.collect_address}>
              <Bubble edit={edit} value={cfg.address_message} onChange={(v) => patch({ address_message: v })} />
              <div className="mt-1 space-y-1 text-[12px] text-white/40">
                <div>→ Full name → Pincode (city auto-detected) → Street address, building, flat, floor</div>
              </div>
            </FlowStep>

            <FlowStep icon={<CreditCard size={14} />} tag="Payment">
              <Bubble edit={edit} value={cfg.payment_message} onChange={(v) => patch({ payment_message: v })} />
              <Choices options={["Yes", "No"]} />
            </FlowStep>

            <FlowStep icon={<CheckCircle2 size={14} />} tag="Order placed">
              <Bubble edit={edit} value={cfg.order_placed_message} onChange={(v) => patch({ order_placed_message: v })} />
            </FlowStep>
          </div>
          {edit && <div className="mt-4 flex justify-end"><Button loading={saving} onClick={() => { setEdit(false); void save(); }}>Save messages</Button></div>}
        </Card>

        {/* Settings */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-[15px] font-semibold text-white">Workflow settings</h3>
            <div className="mt-3 space-y-3">
              <Row label="Collect shipping address" hint="Ask for the delivery address in the flow.">
                <Toggle checked={cfg.collect_address} onChange={(v) => patch({ collect_address: v })} />
              </Row>
              <Row label="Free shipping" hint="Deliver free (no shipping charge step).">
                <Toggle checked={cfg.free_shipping} onChange={(v) => patch({ free_shipping: v })} />
              </Row>
              <Field label="Payment method">
                <Select value={cfg.payment_mode} onChange={(e) => patch({ payment_mode: e.target.value as CommerceConfig["payment_mode"] })}>
                  <option value="cod">Cash on Delivery</option>
                  <option value="online">Online payment</option>
                  <option value="both">Both</option>
                </Select>
              </Field>
            </div>
            <Button className="mt-4 w-full" loading={saving} onClick={() => void save()}>Save settings</Button>
          </Card>
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[12.5px] text-white/50">
            <Info size={15} className="mt-0.5 shrink-0" /> When you set the flow live, a customer who sends a cart is guided through these steps and the order lands in your Order Panel.
          </div>
        </div>
      </div>
    </Page>
  );
}

function FlowStep({ icon, tag, muted, children }: { icon?: React.ReactNode; tag: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className={muted ? "opacity-40" : ""}>
      <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)]/15 px-2 py-0.5 text-[11.5px] font-medium text-[var(--brand)]">{icon}{tag}</div>
      {children}
    </div>
  );
}

function Bubble({ value, edit, onChange }: { value: string; edit: boolean; onChange: (v: string) => void }) {
  if (edit) return <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="!bg-[#0f1c17]" />;
  return <div className="max-w-[92%] whitespace-pre-wrap rounded-lg bg-[#1f3d33] px-3 py-2 text-[13px] text-white/90">{value}</div>;
}

function Choices({ options }: { options: string[] }) {
  return <div className="mt-1.5 flex gap-1.5">{options.map((o) => <span key={o} className="rounded-md border border-white/15 px-3 py-1 text-[12px] text-white/60">{o}</span>)}</div>;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div><div className="text-[13.5px] text-white/85">{label}</div>{hint && <div className="text-[12px] text-white/40">{hint}</div>}</div>
      {children}
    </div>
  );
}
