"""Generates the embeddable website widget script. Self-contained vanilla JS in a shadow root, so host-page CSS can't break it."""

from __future__ import annotations

import json

TEMPLATE = r"""(function () {
  if (window.__lfgWidget) return; window.__lfgWidget = true;
  var C = __CONFIG__;
  var API = C.api;
  function beacon(path, data) {
    try { navigator.sendBeacon(API + path, new Blob([JSON.stringify(data || {})], { type: 'text/plain' })); } catch (e) {}
  }
  function mount() {
    var host = document.createElement('div');
    host.setAttribute('data-lfg-widget', C.key);
    host.style.cssText = 'position:fixed;z-index:2147483000;' + C.position + ':20px;bottom:' + C.bottom + 'px;';
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    var side = C.position === 'left' ? 'left' : 'right';
    root.innerHTML = '<style>' +
      '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
      '.fab{width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;background:' + C.color + ';box-shadow:0 6px 24px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;transition:transform .15s}' +
      '.fab:hover{transform:scale(1.06)}' +
      '.panel{position:absolute;' + side + ':0;bottom:74px;width:340px;max-width:calc(100vw - 32px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);overflow:hidden;display:none;color:#111}' +
      '.panel.open{display:block;animation:up .18s ease-out}@keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
      '.hd{background:' + C.color + ';color:#fff;padding:16px 18px}.hd b{display:block;font-size:16px}.hd span{font-size:12.5px;opacity:.9}' +
      '.bd{padding:16px;background:#ece5dd}.bub{background:#fff;padding:10px 12px;border-radius:0 10px 10px 10px;font-size:14px;line-height:1.4;max-width:88%;box-shadow:0 1px 1px rgba(0,0,0,.08)}' +
      '.ft{padding:12px 16px 16px;background:#fff}input{width:100%;padding:10px 12px;margin-bottom:8px;border:1px solid #d5d5d5;border-radius:8px;font-size:14px}' +
      '.cta{width:100%;padding:12px;border:0;border-radius:10px;background:' + C.color + ';color:#fff;font-size:15px;font-weight:600;cursor:pointer}' +
      '.pw{display:block;margin-top:10px;text-align:center;font-size:11.5px;line-height:1;color:#8a8f98;text-decoration:none}.pw:hover{color:#555b66}.pw b{font-weight:600}' +
      '.cta:disabled{opacity:.6;cursor:default}.err{color:#c0392b;font-size:12px;margin:-2px 0 8px;display:none}' +
      '.x{position:absolute;top:10px;' + (side === 'left' ? 'right' : 'right') + ':12px;background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}' +
      '</style>' +
      '<div class="panel" role="dialog" aria-label="' + esc(C.title) + '"><button class="x" aria-label="Close">&times;</button>' +
      '<div class="hd"><b>' + esc(C.title) + '</b><span>' + esc(C.subtitle) + '</span></div>' +
      '<div class="bd"><div class="bub">' + esc(C.welcome) + '</div></div>' +
      '<div class="ft">' + (C.lead ? '<input class="nm" placeholder="Your name" autocomplete="name"><input class="ph" placeholder="WhatsApp number (with country code)" inputmode="tel" autocomplete="tel"><div class="err"></div>' : '') +
      '<button class="cta">' + esc(C.cta) + '</button>' +
      '<a class="pw" href="https://leadforgrow.com" target="_blank" rel="noopener">Powered by <b>LeadForGrow.com</b></a></div></div>' +
      '<button class="fab" aria-label="Chat on WhatsApp"><svg width="32" height="32" viewBox="0 0 32 32" fill="#fff"><path d="M16.002 3C9.373 3 4 8.373 4 15c0 2.385.697 4.61 1.9 6.484L4 29l7.7-1.86A11.94 11.94 0 0 0 16.002 27C22.63 27 28 21.627 28 15S22.63 3 16.002 3zm0 21.8c-1.86 0-3.6-.5-5.09-1.38l-.36-.21-4.57 1.1 1.15-4.45-.24-.38A9.78 9.78 0 0 1 6.2 15c0-5.42 4.4-9.8 9.8-9.8s9.8 4.38 9.8 9.8-4.4 9.8-9.8 9.8zm5.4-7.34c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.4.25-.7.25-1.29.17-1.4-.07-.12-.27-.2-.57-.35z"/></svg></button>';
    var panel = root.querySelector('.panel'), fab = root.querySelector('.fab'), cta = root.querySelector('.cta'), opened = false;
    function toggle(force) {
      var open = force === undefined ? !panel.classList.contains('open') : force;
      panel.classList.toggle('open', open);
      if (open && !opened) { opened = true; beacon('/open', { page: location.href }); }
    }
    fab.addEventListener('click', function () { toggle(); });
    root.querySelector('.x').addEventListener('click', function () { toggle(false); });
    cta.addEventListener('click', function () {
      var text = C.prefill, name = '', phone = '';
      if (C.lead) {
        name = root.querySelector('.nm').value.trim(); phone = root.querySelector('.ph').value.trim();
        var err = root.querySelector('.err');
        if (!name || phone.replace(/\D/g, '').length < 8) { err.textContent = 'Please enter your name and a valid number.'; err.style.display = 'block'; return; }
        err.style.display = 'none';
        beacon('/lead', { name: name, phone: phone, page: location.href });
        text = C.prefill + (C.prefill ? ' ' : '') + '(' + name + ')';
      }
      beacon('/click', { page: location.href });
      window.open('https://wa.me/' + C.phone + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      toggle(false);
    });
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function start() { setTimeout(mount, Math.max(0, C.delay) * 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
"""

NOOP = "/* LeadForGrow widget: not available for this page */"


def build(config: dict) -> str:
    # json.dumps output is JS-safe except for </script>-style sequences; we serve as a .js file (not inline HTML), but escape anyway.
    payload = json.dumps(config, ensure_ascii=True).replace("</", "<\\/")
    return TEMPLATE.replace("__CONFIG__", payload)
