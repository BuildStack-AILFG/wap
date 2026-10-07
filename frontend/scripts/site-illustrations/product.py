"""Product illustrations: AI suite (896x640) and capability / hub cards (800x352)."""

from draw import (AMBER, BRAND, BRAND_DARK, BRIGHT, CARD, CORAL, CREAM, INK, LINE, MINT, MUTED, SKY, VIOLET, Svg)

AI_W, AI_H = 896, 640
CAP_W, CAP_H = 800, 352


def ai_copilot() -> Svg:
    s = Svg(AI_W, AI_H)
    s.background((0.85, 0.1))
    top = s.window(40, 70, 520, 500, "Templates  ·  New template")
    s.text(64, top + 38, "Template name", 13, MUTED, 600)
    s.rect(64, top + 48, 300, 36, 8, CREAM, LINE)
    s.text(78, top + 72, "diwali_admission_offer", 14, INK, 600)
    s.text(64, top + 112, "Category", 13, MUTED, 600)
    s.chip(64, top + 122, "Marketing", "#E6F6F1", BRAND_DARK, 13, "megaphone")
    s.text(64, top + 180, "Message", 13, MUTED, 600)
    s.rect(64, top + 190, 470, 190, 10, CREAM, LINE)
    for i, l in enumerate(["Hi {{1}}! This Diwali, start your JEE prep", "with 25% off on all weekend batches.",
                           "Seats are limited — reserve yours today!"]):
        s.text(80, top + 222 + i * 26, l, 14.5, INK)
    s.rect(80, top + 312, 3, 28, 1, BRIGHT)
    s.chip(80, top + 330, "Reserve a seat", "#FFFFFF", "#1E88C8", 13, "external-link", stroke=LINE)
    s.chip(64, top + 404, "Submit for approval", BRAND, "#FFFFFF", 14, "send")

    # copilot panel
    x, y, w = 470, 120, 390
    s.card(x, y, w, 470)
    s.rect(x, y, w, 58, 14, "#F3EEFF")
    s.rect(x, y + 40, w, 18, 0, "#F3EEFF")
    s.icon_badge("sparkles", x + 32, y + 29, 17, VIOLET, shadow=False)
    s.text(x + 58, y + 26, "AI Copilot", 16, INK, 700)
    s.text(x + 58, y + 44, "writes Meta-ready templates", 12, MUTED)
    by = s.bubble(x + w - 20, y + 80, ["Write a Diwali offer for my", "coaching institute, 25% off"], "out", 14.5)
    s.icon_badge("sparkles", x + 30, by + 34, 13, VIOLET, shadow=False)
    s.rect(x + 50, by + 18, w - 70, 150, 12, "#F7F5FF", "#E4DBFF")
    s.text(x + 66, by + 44, "Here's a draft that follows", 13.5, INK)
    s.text(x + 66, by + 64, "WhatsApp's marketing rules:", 13.5, INK)
    s.skeleton(x + 66, by + 82, [240, 270, 200], 8, 16, "#E4DBFF")
    s.chip(x + 66, by + 132, "Use this template", VIOLET, "#FFFFFF", 12.5, "wand-sparkles")
    s.rect(x + 20, y + 410, w - 40, 40, 20, CREAM, LINE)
    s.text(x + 40, y + 435, "Make it shorter…", 13.5, MUTED)
    s.icon_badge("arrow-up", x + w - 42, y + 430, 14, BRAND, shadow=False)
    return s


def ai_chatbot() -> Svg:
    s = Svg(AI_W, AI_H)
    s.background((0.2, 0.15))
    y = s.phone(300, 40, 320, 560, "Apex Classes", "AI assistant · online", ("AC", "#0B5F48"))
    y = s.bubble(608, y, ["Do you have weekend", "batches for JEE?"], "out", 15, time="10:02")
    y = s.bubble(314, y + 14, ["Yes! Sat & Sun, 9 AM–1 PM 📚", "Fees: ₹3,500/month.", "Want a free demo class?"], "in", 15,
                 buttons=[("calendar-check", "Book demo class"), ("indian-rupee", "See all fees")], time="10:02")
    y = s.bubble(608, y + 14, ["Book demo class"], "out", 15, time="10:03")
    s.bubble(314, y + 14, ["Done ✅ Saturday 9 AM.", "See you there, Rahul!"], "in", 15, time="10:03")
    s.end_phone()
    s.card(640, 120, 220, 96)
    s.icon_badge("bot", 676, 168, 22, VIOLET, shadow=False)
    s.text(708, 158, "AI Agent", 15, INK, 700)
    s.text(708, 180, "replied in 2 sec", 13, MUTED)
    s.card(50, 380, 230, 110)
    s.icon_badge("trending-up", 86, 435, 22, BRAND, shadow=False)
    s.text(118, 426, "+38%", 26, BRAND_DARK, 800)
    s.text(118, 452, "demo bookings", 13, MUTED)
    return s


def ai_forms() -> Svg:
    s = Svg(AI_W, AI_H)
    s.background((0.8, 0.85))
    y = s.phone(120, 40, 320, 560, "Glow Skin Clinic", "online", ("GS", "#B4547A"))
    y = s.bubble(134, y, ["Hi Ananya 👋 Book your free", "skin consultation below."], "in", 15,
                 buttons=[("clipboard-list", "Fill the form")], time="11:20")
    # bottom sheet form
    fx, fy = 120, 250
    s.rect(fx, fy, 320, 350, 22, CARD, shadow=True)
    s.rect(fx + 140, fy + 10, 40, 5, 2.5, LINE)
    s.text(fx + 22, fy + 46, "Book a consultation", 18, INK, 700)
    for i, (label, val) in enumerate([("Full name", "Ananya Sharma"), ("Concern", "Acne & scars"), ("Preferred date", "Sat, 12 Oct · 4 PM")]):
        yy = fy + 70 + i * 70
        s.text(fx + 22, yy + 4, label, 12, MUTED, 600)
        s.rect(fx + 22, yy + 12, 276, 38, 9, CREAM, LINE)
        s.text(fx + 36, yy + 37, val, 14, INK)
    s.rect(fx + 22, fy + 290, 276, 42, 21, BRAND)
    s.text(fx + 160, fy + 317, "Submit", 15, "#FFFFFF", 700, "middle")
    s.end_phone()
    # lead card
    x, y0 = 500, 200
    s.path(f"M450 420 C 480 420, 470 300, {x} 300", stroke=BRIGHT, sw=2.5, dash="6 7")
    s.card(x, y0, 340, 230)
    s.icon_badge("user-check", x + 36, y0 + 38, 18, BRAND, shadow=False)
    s.text(x + 64, y0 + 34, "New lead captured", 16, INK, 700)
    s.text(x + 64, y0 + 54, "saved to contacts & pipeline", 12.5, MUTED)
    for i, (k, v) in enumerate([("Name", "Ananya Sharma"), ("Concern", "Acne & scars"), ("Slot", "Sat 4 PM"), ("Stage", "Consultation booked")]):
        yy = y0 + 90 + i * 32
        s.text(x + 22, yy, k, 13, MUTED, 600)
        s.text(x + 130, yy, v, 13.5, INK, 600)
    return s


def ai_intent() -> Svg:
    s = Svg(AI_W, AI_H)
    s.background((0.5, 0.5))
    s.card(60, 70, 380, 130)
    s.icon_badge("message-circle", 92, 106, 16, "#25A06B", shadow=False)
    s.text(118, 102, "Customer message", 14, MUTED, 700)
    s.text(84, 146, "“It's been 3 days, where is", 17, INK, 500)
    s.text(84, 172, "my parcel??”", 17, INK, 500)
    s.path("M250 210 C 250 260, 430 250, 430 300", stroke=BRIGHT, sw=2.5, dash="6 7")
    s.card(300, 300, 400, 150)
    s.icon_badge("brain", 334, 338, 18, VIOLET, shadow=False)
    s.text(364, 333, "AI understood the intent", 16, INK, 700)
    s.text(364, 353, "no keyword needed", 12.5, MUTED)
    s.chip(324, 376, "Order status", "#F3EEFF", VIOLET, 14, "package")
    s.chip(476, 376, "96% match", "#E6F6F1", BRAND_DARK, 14, "target")
    s.rect(324, 422, 352, 8, 4, "#EEF1EA")
    s.rect(324, 422, 338, 8, 4, VIOLET)
    s.path("M560 460 C 560 510, 700 490, 700 520", stroke=BRIGHT, sw=2.5, dash="6 7")
    s.card(470, 500, 380, 110)
    s.icon_badge("workflow", 504, 538, 18, BRAND, shadow=False)
    s.text(534, 533, "Order-tracking flow started", 16, INK, 700)
    s.text(534, 553, "Tracking link sent in 4 sec", 12.5, MUTED)
    s.chip(494, 568, "Resolved without an agent", "#E6F6F1", BRAND_DARK, 12.5, "check")
    return s


def ai_templates() -> Svg:
    s = Svg(AI_W, AI_H)
    s.background((0.1, 0.1))
    top = s.window(40, 50, 816, 540, "Template library")
    tabs = ["All", "Marketing", "Utility", "Authentication"]
    tx = 64
    for i, t in enumerate(tabs):
        w = s.chip(tx, top + 18, t, BRAND if i == 0 else "#F1F4EC", "#FFFFFF" if i == 0 else MUTED, 13)
        tx += w + 10
    cards = [
        ("Festive offer", "Marketing", AMBER, "gift", ["Hi {{1}}, our festive sale", "is live — 30% off till", "Sunday. Shop now!"], "Shop now"),
        ("Order shipped", "Utility", SKY, "truck", ["Good news {{1}}! Order", "#{{2}} is on its way and", "arrives by {{3}}."], "Track order"),
        ("Appointment", "Utility", BRAND, "calendar-check", ["Reminder: your visit with", "{{1}} is tomorrow at", "{{2}}. Reply to reschedule."], "Confirm"),
    ]
    for i, (name, cat, col, ic, lines, btn) in enumerate(cards):
        x = 64 + i * 262
        y = top + 74
        s.rect(x, y, 244, 420, 14, "#FAFBF7", LINE)
        s.rect(x + 14, y + 14, 216, 120, 10, col, opacity=0.18)
        s.icon_badge(ic, x + 122, y + 74, 30, col, shadow=False)
        s.text(x + 16, y + 164, name, 16, INK, 700)
        s.chip(x + 16, y + 176, cat, "#F1F4EC", MUTED, 12)
        s.chip(x + 120, y + 176, "Approved", "#E6F6F1", BRAND_DARK, 12, "check")
        for j, l in enumerate(lines):
            s.text(x + 16, y + 236 + j * 22, l, 13.5, INK)
        s.line(x + 14, y + 318, x + 230, y + 318, LINE, 1.2)
        s.text(x + 122, y + 344, btn, 14, "#1E88C8", 700, "middle")
        s.rect(x + 16, y + 368, 212, 36, 18, BRAND)
        s.text(x + 122, y + 391, "Use template", 13.5, "#FFFFFF", 700, "middle")
    s.icon_badge("sparkles", 836, 66, 24, VIOLET)
    return s


# ---- capability & hub cards (800x352) ---------------------------------------------------------------------------------

def cap_ai_agent() -> Svg:
    s = Svg(CAP_W, CAP_H)
    s.background((0.15, 0.2))
    y = s.bubble(430, 40, ["Need a 2BHK under ₹60L", "near Whitefield"], "out", 17)
    s.icon_badge("bot", 72, y + 40, 20, VIOLET)
    s.card(108, y + 18, 340, 190)
    s.text(126, y + 48, "Found 3 matches for you 🏡", 16, INK, 700)
    for i, (n, p) in enumerate([("Palm Grove · 2BHK", "₹54L"), ("Green Vista · 2BHK", "₹58L")]):
        yy = y + 64 + i * 52
        s.rect(126, yy, 44, 40, 8, "#DDEFE6")
        s.icon("building-2", 136, yy + 9, 22, BRAND_DARK)
        s.text(182, yy + 18, n, 14.5, INK, 600)
        s.text(182, yy + 36, p, 13.5, BRAND_DARK, 700)
    s.chip(126, y + 172, "Book site visit", BRAND, "#FFFFFF", 13, "calendar-check")
    s.card(500, 170, 260, 120)
    s.text(522, 204, "Lead qualified by AI", 15, INK, 700)
    for i, (k, v) in enumerate([("Budget", "₹60L"), ("Area", "Whitefield"), ("Intent", "Hot 🔥")]):
        s.text(522, 232 + i * 22, k, 13, MUTED, 600)
        s.text(616, 232 + i * 22, v, 13.5, INK, 700)
    return s


def cap_flow_builder() -> Svg:
    s = Svg(CAP_W, CAP_H)
    s.background((0.5, 0.0))
    nodes = [
        (40, 140, "Start", "zap", BRAND, "Keyword: demo"),
        (220, 60, "Ask a question", "message-circle-question", AMBER, "What's your budget?"),
        (220, 220, "Buttons", "list-checks", VIOLET, "Book · Pricing"),
        (420, 60, "Create deal", "badge-indian-rupee", "#16A34A", "Stage: Qualified"),
        (420, 220, "AI reply", "sparkles", "#9333EA", "From knowledge base"),
        (610, 140, "Hand over", "headset", CORAL, "Notify sales team"),
    ]
    centers = {}
    for x, y, title, ic, col, sub in nodes:
        centers[title] = (x, y)
    def link(a, b):
        ax, ay = centers[a]; bx, by = centers[b]
        x1, y1, x2, y2 = ax + 160, ay + 36, bx, by + 36
        mx = (x1 + x2) / 2
        s.path(f"M{x1} {y1} C {mx} {y1}, {mx} {y2}, {x2} {y2}", stroke=BRIGHT, sw=2.5, opacity=0.9)
        s.circle(x2, y2, 4.5, BRIGHT)
    for a, b in [("Start", "Ask a question"), ("Start", "Buttons"), ("Ask a question", "Create deal"), ("Buttons", "AI reply"),
                 ("Create deal", "Hand over"), ("AI reply", "Hand over")]:
        link(a, b)
    for x, y, title, ic, col, sub in nodes:
        s.card(x, y, 160, 72, 12)
        s.rect(x, y, 5, 72, 2, col)
        s.icon_badge(ic, x + 28, y + 26, 13, col, shadow=False)
        s.text(x + 48, y + 31, title, 13.5, INK, 700)
        s.text(x + 16, y + 58, sub, 12, MUTED)
    s.chip(40, 300, "Drag & drop · no code", "#FFFFFF", BRAND_DARK, 13, "mouse-pointer-2")
    return s


def cap_broadcast() -> Svg:
    s = Svg(CAP_W, CAP_H)
    s.background((0.9, 0.2))
    s.card(40, 36, 330, 280)
    s.text(60, 70, "Broadcast", 18, INK, 800)
    s.text(60, 92, "Sent to 1,725 opted-in contacts", 13, MUTED)
    g = s.uid("offer")
    s.defs.append(f'<linearGradient id="{g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A3D"/><stop offset="1" stop-color="#F23E6B"/></linearGradient>')
    s.rect(60, 108, 290, 120, 12, f"url(#{g})")
    s.text(80, 150, "FESTIVE SALE", 24, "#FFFFFF", 900)
    s.text(80, 186, "Flat 30% OFF", 22, "#FFF4C2", 800)
    s.icon("gift", 290, 134, 44, "#FFFFFF", 1.8)
    s.skeleton(60, 244, [250, 200], 8, 16)
    s.text(205, 300, "Shop now", 14, "#1E88C8", 700, "middle")
    cols = [BRAND, VIOLET, AMBER, SKY, CORAL, "#16A34A", "#0EA5E9"]
    pts = [(470, 70), (580, 52), (690, 86), (440, 180), (560, 160), (680, 200), (520, 270), (640, 290), (740, 280)]
    for i, (x, y) in enumerate(pts):
        s.path(f"M370 170 Q {(370 + x) / 2} {y - 40}, {x} {y}", stroke=BRIGHT, sw=1.5, dash="4 6", opacity=0.6)
    for i, (x, y) in enumerate(pts):
        s.avatar(x, y, 22, "ABCDEFGHJ"[i] + "KLMNPRSTV"[i], cols[i % len(cols)])
        s.circle(x + 16, y + 16, 9, "#FFFFFF")
        s.icon("check-check", x + 9.5, y + 9.5, 13, SKY, 2.6)
    return s


def cap_inbox() -> Svg:
    s = Svg(CAP_W, CAP_H)
    s.background((0.1, 0.9))
    top = s.window(40, 30, 720, 300, "Team inbox")
    s.rect(40, top, 250, 300 - 36, 0, "#FAFBF7")
    convs = [("Rohit K", "Is COD available?", BRAND, "2", "Priya"), ("Meera S", "Thanks, received 🙏", VIOLET, "", "Arjun"),
             ("Kabir J", "Need a bulk quote", AMBER, "1", "You"), ("Sana P", "Can I reschedule?", SKY, "", "Priya")]
    for i, (n, m, c, unread, who) in enumerate(convs):
        y = top + 10 + i * 62
        if i == 0:
            s.rect(48, y - 4, 234, 58, 10, "#E6F6F1")
        s.avatar(76, y + 24, 18, n[0] + n.split()[1][0], c)
        s.text(104, y + 18, n, 14, INK, 700)
        s.text(104, y + 38, m, 12.5, MUTED)
        if unread:
            s.circle(266, y + 18, 9, BRAND)
            s.text(266, y + 22.5, unread, 11, "#FFFFFF", 700, "middle")
    # open chat
    s.text(310, top + 30, "Rohit K", 16, INK, 700)
    s.chip(380, top + 12, "Assigned · Priya", "#F3EEFF", VIOLET, 12, "user-round")
    s.chip(530, top + 12, "Open", "#E6F6F1", BRAND_DARK, 12)
    s.rect(300, top + 48, 450, 210, 0, CREAM)
    s.bubble(316, top + 62, ["Is COD available for", "Pune?"], "in", 14.5)
    s.bubble(734, top + 118, ["Yes! COD is available", "across Pune 🚚"], "out", 14.5, time="4:12")
    s.rect(316, top + 192, 300, 50, 10, "#FFF6D6", "#F5D77A")
    s.icon("sticky-note", 328, top + 204, 16, "#B7791F")
    s.text(352, top + 216, "Note: VIP customer — offer", 12.5, "#7A5212", 600)
    s.text(352, top + 233, "free shipping", 12.5, "#7A5212", 600)
    return s


def cap_payments() -> Svg:
    s = Svg(CAP_W, CAP_H)
    s.background((0.85, 0.85))
    s.card(40, 30, 310, 292)
    s.text(60, 64, "Product catalog", 17, INK, 800)
    s.icon("shopping-bag", 316, 46, 22, BRAND)
    items = [("Wall clock · walnut", "₹1,299", "#E7D2B8"), ("Ceramic vase set", "₹899", "#CFE3F0"), ("Table lamp", "₹1,499", "#F3E2B3")]
    for i, (n, p, c) in enumerate(items):
        y = 84 + i * 72
        s.rect(60, y, 56, 56, 10, c)
        s.icon(["clock", "flower-2", "lamp"][i], 74, y + 14, 28, INK, 1.6)
        s.text(130, y + 24, n, 14.5, INK, 600)
        s.text(130, y + 46, p, 14, BRAND_DARK, 800)
        s.rect(296, y + 16, 34, 26, 8, "#E6F6F1")
        s.icon("plus", 304, y + 20, 18, BRAND_DARK, 2.4)
    s.path("M352 180 C 400 180, 400 120, 440 120", stroke=BRIGHT, sw=2.5, dash="6 7")
    s.card(440, 40, 320, 176)
    s.text(462, 74, "Order total", 13.5, MUTED, 600)
    s.text(462, 108, "₹2,798", 30, INK, 800)
    s.chip(610, 84, "UPI · Cards", "#F1F4EC", MUTED, 12, "credit-card")
    s.rect(462, 132, 276, 44, 22, BRAND)
    s.text(600, 160, "Pay securely", 15, "#FFFFFF", 700, "middle")
    s.text(600, 200, "Payment link by Razorpay", 11.5, MUTED, anchor="middle")
    s.card(500, 240, 260, 76)
    s.icon_badge("check", 534, 278, 18, "#16A34A", shadow=False)
    s.text(562, 274, "Payment received", 15, INK, 700)
    s.text(562, 294, "Order #4821 confirmed", 12.5, MUTED)
    return s


def cap_analytics() -> Svg:
    s = Svg(CAP_W, CAP_H)
    s.background((0.2, 0.9))
    tiles = [("Read rate", "90%", BRAND), ("Replied", "74%", VIOLET), ("Avg. first reply", "45 sec", AMBER)]
    for i, (k, v, c) in enumerate(tiles):
        x = 40 + i * 180
        s.card(x, 30, 164, 100)
        s.text(x + 18, 62, k, 13, MUTED, 600)
        s.text(x + 18, 104, v, 30, c if c != AMBER else "#C98A0B", 800)
    s.card(40, 150, 524, 172)
    s.text(60, 182, "Messages this week", 14.5, INK, 700)
    vals = [42, 58, 50, 76, 64, 92, 80]
    for i, v in enumerate(vals):
        x = 70 + i * 68
        h = v * 1.15
        s.rect(x, 300 - h, 34, h, 7, BRAND if i == 5 else "#BFE8DB")
        s.text(x + 17, 316, "MTWTFSS"[i], 11.5, MUTED, 600, "middle")
    s.card(584, 30, 176, 292)
    s.text(604, 62, "Team", 14.5, INK, 700)
    for i, (n, sc, c) in enumerate([("Priya", 0.92, BRAND), ("Arjun", 0.78, VIOLET), ("Neha", 0.64, AMBER), ("Kabir", 0.5, SKY)]):
        y = 86 + i * 58
        s.avatar(616, y + 14, 14, n[:2].upper()[:1] + n[1].upper(), c)
        s.text(640, y + 12, n, 13, INK, 600)
        s.rect(640, y + 22, 100, 7, 3.5, "#EEF1EA")
        s.rect(640, y + 22, 100 * sc, 7, 3.5, c)
    return s


def hub_crm() -> Svg:
    s = Svg(CAP_W, CAP_H)
    s.background((0.85, 0.15))
    s.card(40, 30, 340, 292)
    s.avatar(84, 76, 26, "NV", VIOLET)
    s.text(122, 70, "Nikhil Verma", 18, INK, 800)
    s.text(122, 92, "+91 98•••• 4410 · WhatsApp", 12.5, MUTED)
    x = 60
    for t, bg, fg in [("hot-lead", "#FDE7E4", "#C2412D"), ("demo-booked", "#E6F6F1", BRAND_DARK), ("Ads", "#E5F0FD", "#1D6FC2")]:
        x += s.chip(x, 118, t, bg, fg, 12) + 8
    for i, (k, v) in enumerate([("Business", "Real estate"), ("Team size", "6–15"), ("Lead source", "Instagram"), ("Budget", "₹50k / year")]):
        y = 178 + i * 34
        s.text(60, y, k, 13, MUTED, 600)
        s.text(190, y, v, 14, INK, 700)
    # pipeline
    stages = [("New", 4, "#BFE8DB"), ("Qualified", 3, BRAND), ("Demo", 2, VIOLET), ("Won", 1, "#16A34A")]
    for i, (name, n, c) in enumerate(stages):
        x = 410 + i * 90
        s.rect(x, 40, 80, 270, 12, "#FFFFFF", opacity=0.08)
        s.text(x + 40, 66, name, 12.5, "#FFFFFF", 700, "middle")
        for j in range(n):
            y = 80 + j * 54
            hl = (i == 1 and j == 0)
            s.rect(x + 6, y, 68, 46, 8, CARD, BRAND if hl else None, 2.5 if hl else 1)
            s.rect(x + 14, y + 12, 40, 6, 3, "#D8DFD2")
            s.rect(x + 14, y + 26, 28, 6, 3, c)
    s.path("M380 150 C 400 150, 395 105, 416 103", stroke=BRIGHT, sw=2.5, dash="5 6")
    return s


def hub_support() -> Svg:
    s = Svg(CAP_W, CAP_H)
    s.background((0.1, 0.2))
    y = s.phone(60, 24, 280, 304, "TalkForGrow Support", "typically replies in 2 min", ("TS", "#0B5F48"))
    y = s.bubble(326, y, ["My order arrived damaged 😟"], "out", 14, time="9:41")
    y = s.bubble(74, y + 12, ["So sorry Aditi! Sending a", "free replacement today."], "in", 14, time="9:42")
    s.bubble(326, y + 12, ["Thank you so much! 🙏"], "out", 14, time="9:43")
    s.end_phone()
    stats = [("headset", "First response", "< 2 min", BRAND), ("users", "Agents online", "6", VIOLET), ("circle-check", "Resolved today", "128", "#16A34A")]
    for i, (ic, k, v, c) in enumerate(stats):
        y = 36 + i * 98
        s.card(400, y, 340, 82)
        s.icon_badge(ic, 440, y + 41, 20, c, shadow=False)
        s.text(474, y + 36, k, 13.5, MUTED, 600)
        s.text(474, y + 64, v, 24, INK, 800)
    return s


PRODUCT = {
    "ai-copilot": ai_copilot, "ai-chatbot": ai_chatbot, "ai-forms": ai_forms, "ai-intent": ai_intent, "ai-templates": ai_templates,
    "ai-agent": cap_ai_agent, "flow-builder": cap_flow_builder, "broadcast": cap_broadcast, "team-inbox": cap_inbox,
    "payments-catalog": cap_payments, "analytics": cap_analytics, "crm-qualify": hub_crm, "support": hub_support,
}
