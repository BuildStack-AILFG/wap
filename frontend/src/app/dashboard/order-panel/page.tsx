"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Upload, Webhook, Store, ExternalLink } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Modal, Page, PageHeader, Select, Spinner, statusTone, Textarea, useUi } from "@/components/ui/kit";
import { commerce as api, errorMessage, type Order, type OrderItem, type OrderStatus, type PaymentStatus } from "@/lib/api";

const money = (minor: number, cur = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency: cur }).format((minor || 0) / 100);
const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "paid", "refunded"];
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const fulfillment = (o: Order) => (o.status === "delivered" ? "Delivered" : o.status === "shipped" ? "Shipped" : o.status === "cancelled" ? "Cancelled" : "Unfulfilled");
const addr = (o: Order) => (o.shipping_address ? Object.values(o.shipping_address).filter(Boolean).join(", ") : "—");

export default function OrderPanelPage() {
  const [list, setList] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [fulfil, setFulfil] = useState("");
  const [range, setRange] = useState("all");
  const [open, setOpen] = useState<Order | null>(null);
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    try { setList(await api.orders(status ? { status } : {})); }
    catch (e) { setError(errorMessage(e, "Couldn't load orders.")); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const rows = (list ?? []).filter((o) => {
    if (payment && o.payment_status !== payment) return false;
    if (fulfil && fulfillment(o).toLowerCase() !== fulfil) return false;
    if (range !== "all" && o.created_at) {
      const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
      if (now - new Date(o.created_at).getTime() > days * 864e5) return false;
    }
    return true;
  });

  function exportCsv() {
    const head = ["Order ID", "Customer", "Phone", "Cart Date", "Items", "Total", "Order Status", "Payment Status", "Fulfillment", "Shipping Address"];
    const lines = rows.map((o) => [o.order_number, o.customer_name ?? "", o.customer_phone ?? "", o.created_at ?? "", o.items.reduce((n, i) => n + i.quantity, 0), (o.total / 100).toFixed(2), o.status, o.payment_status, fulfillment(o), addr(o)]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "orders.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  const noneAtAll = list && list.length === 0;

  return (
    <Page wide>
      <PageHeader title="Your Orders" subtitle="Track your orders"
        actions={<div className="flex gap-2">
          <Link href="/dashboard/integrations"><Button variant="ghost"><Webhook size={15} /> Get Order Webhooks</Button></Link>
          <Button variant="ghost" onClick={exportCsv} disabled={rows.length === 0}><Upload size={15} /> Export CSV</Button>
          <Button onClick={() => setCreating(true)}><Plus size={15} /> New order</Button>
        </div>} />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={range} onChange={(e) => setRange(e.target.value)} className="!w-36"><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All time</option></Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-40"><option value="">Order Status</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</Select>
        <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="!w-40"><option value="">Payment Status</option>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</Select>
        <Select value={fulfil} onChange={(e) => setFulfil(e.target.value)} className="!w-44"><option value="">Fulfillment Status</option>{["unfulfilled", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</Select>
      </div>

      {!list ? <Spinner /> : noneAtAll ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]"><Store size={28} className="text-white/40" /></div>
          <div className="max-w-xs text-[13.5px] text-white/55">To see orders, connect a catalog and set the Auto Checkout Flow live.</div>
          <Link href="/dashboard/commerce-settings"><Button>Commerce Settings <ExternalLink size={13} /></Button></Link>
          <button onClick={() => setCreating(true)} className="text-[12.5px] text-white/40 hover:text-white/70">or add an order manually</button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="border-b border-white/10 text-[11.5px] uppercase tracking-wide text-white/40">
                <tr><th className="px-5 py-3">Customer Name</th><th className="px-2 py-3">Cart Date</th><th className="px-2 py-3">Order ID</th><th className="px-2 py-3">Order Details</th><th className="px-2 py-3">Order Status</th><th className="px-2 py-3">Payment Status</th><th className="px-2 py-3">Fulfillment Status</th><th className="px-5 py-3">Shipping Address</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-white/40">No orders match these filters.</td></tr>
                ) : rows.map((o) => (
                  <tr key={o.id} className="cursor-pointer border-b border-white/5 hover:bg-white/[0.03]" onClick={() => setOpen(o)}>
                    <td className="px-5 py-3 text-white/85">{o.customer_name || "—"}<div className="text-[11px] text-white/35">{o.customer_phone}</div></td>
                    <td className="px-2 py-3 text-white/50">{fmtDate(o.created_at)}</td>
                    <td className="px-2 py-3 font-medium text-white">{o.order_number}</td>
                    <td className="px-2 py-3 text-white/70">{o.items.reduce((n, i) => n + i.quantity, 0)} items · {money(o.total, o.currency)}</td>
                    <td className="px-2 py-3"><Badge tone={statusTone(o.status)}>{o.status}</Badge></td>
                    <td className="px-2 py-3"><Badge tone={o.payment_status === "paid" ? "green" : o.payment_status === "refunded" ? "blue" : "yellow"}>{o.payment_status}</Badge></td>
                    <td className="px-2 py-3"><Badge tone={o.status === "delivered" ? "green" : o.status === "cancelled" ? "red" : "gray"}>{fulfillment(o)}</Badge></td>
                    <td className="px-5 py-3 max-w-[220px] truncate text-white/50" title={addr(o)}>{addr(o)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {open && <OrderModal order={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} />}
      {creating && <CreateOrderModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
    </Page>
  );
}

function OrderModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [payment, setPayment] = useState<PaymentStatus>(order.payment_status);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try { await api.updateOrder(order.id, { status, payment_status: payment }); toast("Order updated"); onSaved(); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Order ${order.order_number}`} width={560}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button loading={busy} onClick={save}>Save</Button></>}>
      <div className="rounded-xl border border-white/10 p-3 text-[13px]">
        <div className="text-white/85">{order.customer_name || "Customer"}</div>
        <div className="text-white/45">{order.customer_phone || "No phone"}</div>
        {order.shipping_address && <div className="mt-1 text-white/45">{Object.values(order.shipping_address).filter(Boolean).join(", ")}</div>}
      </div>
      <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10">
        {order.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 text-[13px]">
            <span className="text-white/80">{it.name} <span className="text-white/40">× {it.quantity}</span></span>
            <span className="text-white/70">{money(it.price * it.quantity, order.currency)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-2 text-[13px] font-semibold text-white"><span>Total</span><span>{money(order.total, order.currency)}</span></div>
      </div>
      {order.note && <div className="mt-3 text-[12.5px] text-white/55">Note: {order.note}</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Order status"><Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Payment status"><Select value={payment} onChange={(e) => setPayment(e.target.value as PaymentStatus)}>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}

function CreateOrderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<{ name: string; price: string; quantity: string }[]>([{ name: "", price: "", quantity: "1" }]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setItem = (i: number, p: Partial<{ name: string; price: string; quantity: string }>) => setItems(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const total = items.reduce((n, it) => n + (parseFloat(it.price || "0") * parseInt(it.quantity || "0", 10) || 0), 0);

  async function save() {
    const clean: OrderItem[] = items.filter((it) => it.name.trim()).map((it) => ({ name: it.name.trim(), price: Math.round(parseFloat(it.price || "0") * 100), quantity: parseInt(it.quantity || "1", 10) || 1 }));
    if (clean.length === 0) return setErr("Add at least one item.");
    setBusy(true); setErr(null);
    try { await api.createOrder({ customer_name: name || undefined, customer_phone: phone || undefined, note: note || undefined, items: clean }); toast("Order created"); onSaved(); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="New order" width={620}
      footer={<><span className="mr-auto self-center text-[13px] text-white/50">Total <b className="text-white">{money(Math.round(total * 100))}</b></span><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Create order</Button></>}>
      {err && <Alert>{err}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Shah" /></Field>
        <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9198…" /></Field>
      </div>
      <div className="mt-4 mb-1 text-[13px] text-white/70">Items</div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <Input className="flex-1" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Product name" />
            <Input className="!w-24" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} inputMode="decimal" placeholder="Price" />
            <Input className="!w-16" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} inputMode="numeric" placeholder="Qty" />
            <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : items)}><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setItems([...items, { name: "", price: "", quantity: "1" }])}><Plus size={14} /> Add item</Button>
      <Field label="Note" className="mt-3"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Internal note (optional)" /></Field>
    </Modal>
  );
}
