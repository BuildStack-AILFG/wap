"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Package, Plus, Search, Trash2, RefreshCw, Upload, ExternalLink, Store } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Modal, Page, PageHeader, Select, Spinner, Textarea, Toggle, useUi } from "@/components/ui/kit";
import { commerce as api, errorMessage, type Product } from "@/lib/api";

const money = (minor: number, cur = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency: cur }).format((minor || 0) / 100);

export default function CatalogPage() {
  const { toast, confirm } = useUi();
  const [list, setList] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [avail, setAvail] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setList(await api.products({ search: search || undefined, availability: avail || undefined })); }
    catch (e) { setError(errorMessage(e, "Couldn't load products.")); }
  }, [search, avail]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setUploading(true);
    try { const r = await api.importProducts(file); toast(`Imported ${r.added} products${r.skipped ? `, skipped ${r.skipped}` : ""}`); await load(); }
    catch (err) { toast(errorMessage(err), "error"); }
    finally { setUploading(false); }
  }

  async function sync() {
    setSyncing(true);
    try { const r = await api.syncCatalog(); toast(`Synced ${r.synced} products to Meta`); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setSyncing(false); }
  }

  const empty = list && list.length === 0 && !search && !avail;

  return (
    <Page>
      <input ref={fileRef} type="file" accept=".csv" hidden onChange={onFile} />
      <PageHeader icon={<Package size={20} />} title="Catalog" subtitle="View & manage catalog products"
        actions={!empty && list ? <div className="flex gap-2">
          <Button variant="ghost" loading={uploading} onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload CSV</Button>
          <Button variant="ghost" loading={syncing} onClick={sync}><RefreshCw size={15} /> Sync to Meta</Button>
          <Button onClick={() => setEditing("new")}><Plus size={15} /> Add product</Button>
        </div> : undefined} />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      {!list ? <Spinner /> : empty ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]"><Store size={26} className="text-white/40" /></div>
          <div className="text-[17px] font-semibold text-white">No catalog found</div>
          <Button loading={uploading} onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload CSV</Button>
          <div className="text-[12px] uppercase tracking-wide text-white/30">or</div>
          <Link href="/dashboard/commerce-settings"><Button variant="ghost">Set up a FB catalog <ExternalLink size={13} /></Button></Link>
          <button onClick={() => setEditing("new")} className="text-[12.5px] text-white/40 hover:text-white/70">or add a product manually</button>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, SKU or category" className="!pl-9" />
            </div>
            <Select value={avail} onChange={(e) => setAvail(e.target.value)} className="!w-44">
              <option value="">All availability</option><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option>
            </Select>
          </div>
          {list.length === 0 ? (
            <Card className="py-16 text-center text-[13.5px] text-white/45">No products match your filters.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  <div className="flex h-36 items-center justify-center bg-white/[0.03]">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package size={28} className="text-white/20" />}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[14.5px] font-semibold text-white">{p.name}</h3>
                      <Badge tone={p.availability === "in_stock" ? "green" : "red"}>{p.availability === "in_stock" ? "In stock" : "Out"}</Badge>
                    </div>
                    <div className="mt-1 text-[15px] font-semibold text-white">{money(p.price, p.currency)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-white/40">
                      {p.category && <Badge>{p.category}</Badge>}
                      {p.retailer_id && <span>SKU {p.retailer_id}</span>}
                      {!p.is_visible && <Badge tone="yellow">Hidden</Badge>}
                    </div>
                    <div className="mt-3 flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
                      <Button size="sm" variant="danger" aria-label="Delete" onClick={async () => {
                        if (await confirm({ title: `Delete “${p.name}”?`, body: "This removes it from your catalog.", confirmLabel: "Delete", danger: true })) {
                          try { await api.deleteProduct(p.id); await load(); toast("Product deleted"); } catch (e) { toast(errorMessage(e), "error"); }
                        }
                      }}><Trash2 size={13} /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {editing && <Editor product={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </Page>
  );
}

function Editor({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [name, setName] = useState(product?.name ?? "");
  const [priceRupees, setPriceRupees] = useState(product ? String((product.price / 100).toFixed(2)) : "");
  const [currency, setCurrency] = useState(product?.currency ?? "INR");
  const [sku, setSku] = useState(product?.retailer_id ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [availability, setAvailability] = useState(product?.availability ?? "in_stock");
  const [isVisible, setIsVisible] = useState(product?.is_visible ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const price = Math.round(parseFloat(priceRupees || "0") * 100);
    if (!name.trim()) return setErr("Name is required.");
    if (!Number.isFinite(price) || price < 0) return setErr("Enter a valid price.");
    setBusy(true); setErr(null);
    const body = { name, price, currency, retailer_id: sku || null, category: category || null, image_url: imageUrl || null, description: description || null, availability, is_visible: isVisible } as Partial<Product>;
    try {
      if (product) await api.updateProduct(product.id, body); else await api.createProduct(body);
      toast(product ? "Product updated" : "Product added"); onSaved();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={product ? "Edit product" : "Add product"} width={620}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{product ? "Save" : "Add product"}</Button></>}>
      {err && <Alert>{err}</Alert>}
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cotton kurta" autoFocus /></Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label={`Price (${currency})`}><Input value={priceRupees} onChange={(e) => setPriceRupees(e.target.value)} inputMode="decimal" placeholder="499" /></Field>
        <Field label="Currency"><Select value={currency} onChange={(e) => setCurrency(e.target.value)}>{["INR", "USD", "EUR", "GBP", "AED"].map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
        <Field label="SKU / retailer id"><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="KURTA-01" /></Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Apparel" /></Field>
        <Field label="Availability"><Select value={availability} onChange={(e) => setAvailability(e.target.value as Product["availability"])}><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option></Select></Field>
      </div>
      <Field label="Image URL" className="mt-3" hint="Paste a link to the product image."><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/photo.jpg" /></Field>
      <Field label="Description" className="mt-3"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Short description shown to customers" /></Field>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 p-3">
        <div><div className="text-[13.5px] text-white/85">Visible in catalog</div><div className="text-[12px] text-white/40">Hidden products stay saved but don’t show on WhatsApp.</div></div>
        <Toggle checked={isVisible} onChange={setIsVisible} />
      </div>
    </Modal>
  );
}
