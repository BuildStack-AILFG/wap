"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Facebook, KeyRound, RefreshCw, Send, Smartphone, Unplug } from "lucide-react";
import { ACCENT, Alert, Badge, Button, Card, CopyField, Field, Input, Modal, PageHeader, Page, Spinner, statusTone, timeAgo, useUi } from "@/components/ui/kit";
import { errorMessage, whatsapp, type WaAccount, type WaConfig } from "@/lib/api";

declare global {
  interface Window {
    FB?: {
      init: (o: Record<string, unknown>) => void;
      login: (cb: (r: { authResponse?: { code?: string } }) => void, o: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const QUALITY_TONE: Record<string, "green" | "yellow" | "red" | "gray"> = { GREEN: "green", YELLOW: "yellow", RED: "red", UNKNOWN: "gray" };

function loadFacebookSdk(appId: string, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve();
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.onerror = () => reject(new Error("Couldn't load the Facebook SDK (an ad blocker may be blocking it)."));
    document.body.appendChild(s);
  });
}

export default function WhatsAppPage() {
  const { toast, confirm } = useUi();
  const [accounts, setAccounts] = useState<WaAccount[] | null>(null);
  const [config, setConfig] = useState<WaConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [testFor, setTestFor] = useState<WaAccount | null>(null);
  const [tokenFor, setTokenFor] = useState<WaAccount | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([whatsapp.list(), whatsapp.config()]);
      setAccounts(a);
      setConfig(c);
    } catch (e) {
      setError(errorMessage(e, "Couldn't load your WhatsApp numbers."));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      if (ok) toast(ok);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const embeddedSignup = async () => {
    if (!config?.embedded_signup.enabled) return;
    setBusy("embedded");
    setError(null);
    let sessionInfo: { waba_id?: string; phone_number_id?: string } = {};
    const onMessage = (ev: MessageEvent) => {
      if (!/facebook\.com$/.test(new URL(ev.origin).hostname)) return;
      try {
        const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") sessionInfo = data.data ?? {};
      } catch {
        /* not our message */
      }
    };
    window.addEventListener("message", onMessage);
    try {
      await loadFacebookSdk(config.embedded_signup.app_id!, config.embedded_signup.graph_version);
      const code = await new Promise<string>((resolve, reject) => {
        window.FB!.login((r) => (r.authResponse?.code ? resolve(r.authResponse.code) : reject(new Error("Signup was cancelled."))), {
          config_id: config.embedded_signup.config_id, response_type: "code", override_default_response_type: true, extras: { setup: {}, sessionInfoVersion: "3" },
        });
      });
      for (let i = 0; i < 20 && !sessionInfo.waba_id; i++) await new Promise((r) => setTimeout(r, 250)); // the FINISH message can trail the login callback
      if (!sessionInfo.waba_id || !sessionInfo.phone_number_id) throw new Error("Meta didn't return the WhatsApp account details. Please try again.");
      const acct = await whatsapp.connectEmbedded({ code, waba_id: sessionInfo.waba_id, phone_number_id: sessionInfo.phone_number_id });
      setWarnings(acct.warnings ?? []);
      toast("WhatsApp number connected");
      await load();
    } catch (e) {
      setError(errorMessage(e, e instanceof Error ? e.message : undefined));
    } finally {
      window.removeEventListener("message", onMessage);
      setBusy(null);
    }
  };

  if (!accounts || !config) return error ? <Page><Alert>{error}</Alert></Page> : <Spinner />;
  const connected = accounts.filter((a) => a.status !== "disconnected");

  return (
    <Page>
      <PageHeader icon={<Smartphone size={20} />} title="WhatsApp number" subtitle="Connect your WhatsApp Business number to send campaigns, reply from the shared inbox and run automations." />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {warnings.map((w) => <Alert key={w} tone="yellow" onClose={() => setWarnings([])}>{w}</Alert>)}

      {connected.length === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#1877F2]/20 text-[#5b9bff]"><Facebook size={20} /></div>
            <h3 className="text-[16px] font-semibold text-white">Connect with Facebook</h3>
            <p className="mt-1.5 flex-1 text-[13px] text-white/55">The fastest way: log in with Facebook, pick or create your WhatsApp Business account and verify your number by SMS or call. We set up webhooks for you.</p>
            <Button className="mt-5" onClick={embeddedSignup} loading={busy === "embedded"} disabled={!config.embedded_signup.enabled}>
              <Facebook size={15} /> Continue with Facebook
            </Button>
            {!config.embedded_signup.enabled && <p className="mt-2 text-[11.5px] text-white/40">Not enabled on this server yet — the platform owner needs to set META_APP_ID, META_APP_SECRET and META_CONFIG_ID. Use manual connect below in the meantime.</p>}
          </Card>
          <Card className="flex flex-col p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${ACCENT}22`, color: ACCENT }}><KeyRound size={20} /></div>
            <h3 className="text-[16px] font-semibold text-white">Connect manually</h3>
            <p className="mt-1.5 flex-1 text-[13px] text-white/55">Already have a Meta app and a WhatsApp Business Account? Paste your WABA ID, phone number ID and a permanent access token from the Meta developer console.</p>
            <Button className="mt-5" variant="ghost" onClick={() => setShowManual(true)}>Enter credentials</Button>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        {accounts.map((a) => (
          <Card key={a.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white"><Smartphone size={20} /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-white">{a.verified_name || "WhatsApp Business"}</h3>
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    {a.quality_rating && <Badge tone={QUALITY_TONE[a.quality_rating] ?? "gray"}>Quality: {a.quality_rating}</Badge>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-white/55">{a.display_phone_number} · Tier {a.messaging_limit?.replace("TIER_", "") ?? "—"} · {a.connection_type === "embedded" ? "Embedded signup" : "Manual"}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {a.status === "disconnected" ? (
                  <Button variant="ghost" size="sm" onClick={() => run(a.id, () => whatsapp.reconnect(a.id), "Reconnected")}>Reconnect</Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" loading={busy === `r${a.id}`} onClick={() => run(`r${a.id}`, () => whatsapp.refresh(a.id), "Status refreshed")}><RefreshCw size={13} /> Refresh</Button>
                    <Button variant="ghost" size="sm" loading={busy === `s${a.id}`} onClick={() => run(`s${a.id}`, async () => { const r = await whatsapp.syncTemplates(a.id); toast(`Synced ${r.total} template${r.total === 1 ? "" : "s"} (${r.created} new)`); })}>Sync templates</Button>
                    <Button variant="ghost" size="sm" onClick={() => setTestFor(a)}><Send size={13} /> Send test</Button>
                    <Button variant="ghost" size="sm" onClick={() => setTokenFor(a)}><KeyRound size={13} /> Update token</Button>
                    <Button variant="danger" size="sm" onClick={async () => { if (await confirm({ title: "Disconnect this number?", body: "Sending and automations stop for this number. Your conversations and contacts are kept, and you can reconnect later.", confirmLabel: "Disconnect", danger: true })) void run(`d${a.id}`, () => whatsapp.disconnect(a.id), "Number disconnected"); }}><Unplug size={13} /> Disconnect</Button>
                  </>
                )}
              </div>
            </div>
            {a.last_error && <Alert>{a.last_error}</Alert>}

            <div className="mt-5 grid gap-3 text-[12.5px] sm:grid-cols-3">
              <Info k="Webhook" v={a.last_webhook_at ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 size={13} /> Last event {timeAgo(a.last_webhook_at)}</span> : <span className="text-amber-300">No events received yet</span>} />
              <Info k="WABA ID" v={<code>{a.waba_id}</code>} />
              <Info k="Phone number ID" v={<code>{a.phone_number_id}</code>} />
            </div>

            {a.webhook_url && (
              <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
                <h4 className="text-[13.5px] font-semibold text-white">Webhook setup {a.last_webhook_at ? "" : <span className="ml-2 text-[11.5px] font-normal text-amber-300">— required to receive replies</span>}</h4>
                <p className="mt-1 text-[12.5px] text-white/50">In your Meta app: WhatsApp → Configuration → Webhook → Edit. Paste these, then subscribe to the <b>messages</b> field. {a.connection_type === "embedded" && "Embedded-signup numbers are subscribed automatically."}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <CopyField label="Callback URL" value={a.webhook_url} />
                  <CopyField label="Verify token" value={a.verify_token ?? ""} />
                </div>
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-sky-300 hover:underline">Open Meta developer console <ExternalLink size={12} /></a>
              </div>
            )}
          </Card>
        ))}
      </div>

      <ManualModal open={showManual} onClose={() => setShowManual(false)} secretRequired={config.app_secret_required}
        onDone={(a) => { setWarnings(a.warnings ?? []); setShowManual(false); toast("WhatsApp number connected"); void load(); }} />
      <TestModal account={testFor} onClose={() => setTestFor(null)} />
      <TokenModal account={tokenFor} onClose={() => setTokenFor(null)} onDone={() => { setTokenFor(null); toast("Credentials updated"); void load(); }} />
    </Page>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="rounded-lg bg-white/[0.04] px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-white/35">{k}</div><div className="mt-0.5 truncate text-white/80">{v}</div></div>;
}

function ManualModal({ open, onClose, onDone, secretRequired }: { open: boolean; onClose: () => void; onDone: (a: WaAccount) => void; secretRequired: boolean }) {
  const [f, setF] = useState({ waba_id: "", phone_number_id: "", access_token: "", app_secret: "", app_id: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value.trim() }));
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      onDone(await whatsapp.connect({ waba_id: f.waba_id, phone_number_id: f.phone_number_id, access_token: f.access_token, app_secret: f.app_secret || undefined, app_id: f.app_id || undefined }));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Connect WhatsApp manually" width={620}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit} disabled={!f.waba_id || !f.phone_number_id || f.access_token.length < 20 || (secretRequired && !f.app_secret)}>Verify & connect</Button></>}>
      {err && <Alert>{err}</Alert>}
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-[12.5px] text-white/55">
        <li>In Meta for Developers, open your app → <b>WhatsApp → API Setup</b> to copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b>.</li>
        <li>Create a <b>System User</b> in Business Settings with <i>whatsapp_business_messaging</i> + <i>whatsapp_business_management</i> and generate a permanent token (temporary tokens expire in 24h).</li>
        <li>Copy the <b>App Secret</b> from App settings → Basic. It lets us verify that webhooks really come from Meta.</li>
      </ol>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="WhatsApp Business Account ID"><Input value={f.waba_id} onChange={set("waba_id")} inputMode="numeric" placeholder="1234567890123456" /></Field>
        <Field label="Phone number ID"><Input value={f.phone_number_id} onChange={set("phone_number_id")} inputMode="numeric" placeholder="109876543210987" /></Field>
      </div>
      <Field className="mt-3" label="Permanent access token"><Input type="password" value={f.access_token} onChange={set("access_token")} placeholder="EAAG…" autoComplete="off" /></Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={`App secret${secretRequired ? "" : " (optional)"}`} hint="Stored encrypted"><Input type="password" value={f.app_secret} onChange={set("app_secret")} autoComplete="off" /></Field>
        <Field label="App ID (optional)" hint="Needed only for templates with image/video/document headers"><Input value={f.app_id} onChange={set("app_id")} inputMode="numeric" /></Field>
      </div>
    </Modal>
  );
}

function TestModal({ account, onClose }: { account: WaAccount | null; onClose: () => void }) {
  const { toast } = useUi();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal open={!!account} onClose={onClose} title="Send a test message" width={460}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={busy} disabled={to.replace(/\D/g, "").length < 8} onClick={async () => {
          setBusy(true); setErr(null);
          try { await whatsapp.test(account!.id, to); toast("Test message sent — check your WhatsApp"); onClose(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
        }}>Send</Button></>}>
      {err && <Alert>{err}</Alert>}
      <p className="mb-3 text-[13px] text-white/55">Sends Meta&apos;s built-in <b>hello_world</b> template, which works even before you have approved templates.</p>
      <Field label="Recipient (with country code)"><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91 98765 43210" /></Field>
    </Modal>
  );
}

function TokenModal({ account, onClose, onDone }: { account: WaAccount | null; onClose: () => void; onDone: () => void }) {
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal open={!!account} onClose={onClose} title="Update credentials" width={480}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={busy} disabled={!token && !secret} onClick={async () => {
          setBusy(true); setErr(null);
          try { await whatsapp.update(account!.id, { access_token: token || undefined, app_secret: secret || undefined }); setToken(""); setSecret(""); onDone(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
        }}>Save</Button></>}>
      {err && <Alert>{err}</Alert>}
      <Field label="New access token" hint="Verified with Meta before it replaces the old one"><Input type="password" value={token} onChange={(e) => setToken(e.target.value.trim())} autoComplete="off" /></Field>
      <Field className="mt-3" label="New app secret (optional)"><Input type="password" value={secret} onChange={(e) => setSecret(e.target.value.trim())} autoComplete="off" /></Field>
    </Modal>
  );
}
