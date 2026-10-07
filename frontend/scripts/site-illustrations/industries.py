"""Industry cards (800x396): a WhatsApp moment typical for each industry, plus an industry badge."""

from draw import AMBER, BRAND, BRAND_DARK, BRIGHT, CARD, CORAL, CREAM, INK, LINE, MUTED, SKY, VIOLET, Svg

W, H = 800, 396


def base(icon: str, label: str, color: str, glow=(0.15, 0.2)) -> Svg:
    s = Svg(W, H)
    s.background(glow)
    s.icon_badge(icon, 74, 74, 34, color)  # the page prints the industry name under the image, so no label here
    return s


def thumb(s: Svg, x, y, w, h, color, icon, icon_color=INK):
    s.rect(x, y, w, h, 10, color)
    k = min(w, h) * 0.5
    s.icon(icon, x + (w - k) / 2, y + (h - k) / 2, k, icon_color, 1.6)


def banking():
    s = base("landmark", "Banking & Finance", "#1D6FC2")
    y = s.bubble(300, 60, ["Hi Rakesh, your EMI of ₹12,450", "for loan ••4821 is due on 5 Nov."], "in", 17,
                 buttons=[("credit-card", "Pay EMI now"), ("file-text", "Download statement")], time="9:00")
    s.bubble(740, y + 18, ["Paid ✅ Thanks for the reminder!"], "out", 17, time="9:04")
    s.chip(60, 300, "Bank-grade security", "#E5F0FD", "#1D6FC2", 14, "shield-check")
    return s


def travel():
    s = base("plane", "Travel & Tourism", SKY)
    s.card(300, 50, 440, 296)
    g = s.uid("sea")
    s.defs.append(f'<linearGradient id="{g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CC8F5"/><stop offset="0.65" stop-color="#2E9BD6"/>'
                  f'<stop offset="0.66" stop-color="#F3DDA6"/><stop offset="1" stop-color="#E9C77E"/></linearGradient>')
    s.rect(316, 66, 408, 150, 10, f"url(#{g})")
    s.circle(670, 100, 20, "#FFE27A")
    s.icon("tree-palm", 350, 120, 80, "#1F6B3A", 1.8)
    s.text(336, 250, "Goa getaway · 3N/4D", 19, INK, 800)
    s.text(336, 276, "Flights + beach resort from ₹18,999", 15, MUTED)
    s.chip(336, 296, "Book today", BRAND, "#FFFFFF", 14, "calendar-check")
    s.chip(468, 296, "View itinerary", "#F1F4EC", INK, 14, "map")
    s.chip(60, 300, "24/7 booking FAQs", "#E5F0FD", "#1D6FC2", 14, "clock")
    return s


def beauty():
    s = base("sparkles", "Beauty & Cosmetics", "#D9468F", (0.85, 0.2))
    s.card(240, 46, 300, 300)
    s.text(260, 82, "Bestsellers 💄", 18, INK, 800)
    for i, (n, p, c, ic) in enumerate([("Matte lipstick", "₹649", "#F8D3DF", "heart"), ("Vitamin C serum", "₹899", "#FDE6C2", "droplet"),
                                        ("Kajal · long-wear", "₹299", "#E3DDF5", "eye")]):
        y = 100 + i * 76
        thumb(s, 260, y, 58, 58, c, ic, "#9C2E63")
        s.text(332, y + 25, n, 15.5, INK, 600)
        s.text(332, y + 48, p, 15, BRAND_DARK, 800)
        s.rect(486, y + 16, 36, 28, 8, "#E6F6F1")
        s.icon("plus", 494, y + 20, 20, BRAND_DARK, 2.4)
    s.bubble(740, 200, ["Add the serum", "to my cart 🛒"], "out", 16, time="7:12")
    s.chip(60, 300, "Shoppable catalog", "#FCE7F1", "#B12A6F", 14, "shopping-bag")
    return s


def education():
    s = base("graduation-cap", "Education", "#7C3AED")
    y = s.bubble(300, 52, ["Hi Batch A students! 📚", "Updated timetable for this week", "is out. Mock test on Saturday."], "in", 17,
                 buttons=[("calendar-days", "View timetable"), ("clipboard-check", "Register for test")], time="8:30")
    s.bubble(740, y + 18, ["Registered! Thank you ma'am 🙏"], "out", 17, time="8:41")
    s.chip(60, 300, "Admissions & reminders", "#EFE7FD", "#6D28D9", 14, "bell")
    return s


def spas():
    s = base("scissors", "Spas & Salons", "#C2410C", (0.85, 0.8))
    s.card(300, 50, 290, 296)
    s.text(320, 86, "Pick a slot · Sat 12 Oct", 16.5, INK, 800)
    slots = ["11:00 AM", "12:30 PM", "2:00 PM", "3:30 PM", "5:00 PM", "6:30 PM"]
    for i, t in enumerate(slots):
        x = 320 + (i % 2) * 130
        y = 106 + (i // 2) * 56
        sel = i == 3
        s.rect(x, y, 118, 42, 21, BRAND if sel else "#F1F4EC", None if sel else LINE)
        s.text(x + 59, y + 27, t, 15, "#FFFFFF" if sel else INK, 700, "middle")
    s.rect(320, 286, 250, 42, 21, INK)
    s.text(445, 313, "Confirm booking", 15, "#FFFFFF", 700, "middle")
    s.card(612, 120, 150, 120)
    s.icon_badge("bell-ring", 646, 160, 18, AMBER, shadow=False)
    s.text(626, 202, "Reminder sent", 13.5, INK, 700)
    s.text(626, 222, "2 hrs before", 12.5, MUTED)
    s.chip(60, 300, "No-show reminders", "#FDECE2", "#C2410C", 14, "calendar-clock")
    return s


def ecommerce():
    s = base("shopping-cart", "E-commerce", "#EA580C")
    y = s.bubble(300, 50, ["Your cart is waiting, Neha! 🛍️", "Use code PAYNOW for 10% off", "if you check out today."], "in", 17,
                 buttons=[("shopping-cart", "Complete order")], time="6:15")
    s.card(560, y - 10, 200, 92)
    thumb(s, 574, y + 4, 62, 62, "#FCE3CF", "footprints", "#C2410C")
    s.text(648, y + 28, "Running shoes", 14, INK, 600)
    s.text(648, y + 52, "₹2,199", 15, BRAND_DARK, 800)
    s.chip(60, 300, "Abandoned-cart recovery", "#FDECE2", "#C2410C", 14, "rotate-ccw")
    return s


def restaurant():
    s = base("utensils", "Restaurants & Food", "#D97706", (0.85, 0.85))
    y = s.phone(320, 34, 280, 340, "Spice Route Kitchen", "online", ("SR", "#B45309"))
    y = s.bubble(586, y, ["2 Paneer Tikka + 1 Butter", "Naan, please 😋"], "out", 14.5, time="8:02")
    y = s.bubble(334, y + 12, ["Total ₹548 · ready in 25 min.", "Pay here to confirm:"], "in", 14.5,
                 buttons=[("indian-rupee", "Pay ₹548")], time="8:02")
    s.end_phone()
    s.card(620, 150, 150, 112)
    s.icon_badge("bike", 654, 190, 18, BRAND, shadow=False)
    s.text(636, 232, "Out for delivery", 13, INK, 700)
    s.text(636, 250, "ETA 8:30 PM", 12.5, MUTED)
    s.chip(60, 300, "Orders & payments", "#FEF3C7", "#92400E", 14, "receipt")
    return s


def health():
    s = base("stethoscope", "Health & Wellness", "#0E9F6E")
    s.card(300, 50, 440, 200)
    s.avatar(346, 100, 28, "DR", "#0E9F6E")
    s.text(388, 94, "Dr. Meera Iyer · Dermatologist", 17, INK, 800)
    s.text(388, 116, "CareWell Clinic, Indiranagar", 14, MUTED)
    s.rect(320, 140, 400, 52, 10, "#E6F6F1")
    s.icon("calendar-check", 336, 154, 24, BRAND_DARK)
    s.text(372, 172, "Tue, 15 Oct · 11:30 AM", 16.5, INK, 700)
    s.chip(320, 206, "Confirm", BRAND, "#FFFFFF", 14, "check")
    s.chip(428, 206, "Reschedule", "#F1F4EC", INK, 14, "repeat")
    s.bubble(740, 280, ["Confirmed, see you Tuesday!"], "out", 16, time="5:20")
    s.chip(60, 300, "Appointment bookings", "#DDF5EB", "#047857", 14, "heart-pulse")
    return s


def home_decor():
    s = base("sofa", "Home Decor & Furnishing", "#A16207", (0.85, 0.2))
    s.card(300, 46, 230, 300)
    s.rect(316, 62, 198, 140, 10, "#EADBC4")
    s.icon("sofa", 362, 84, 106, "#7C4A1E", 1.4)
    s.text(316, 228, "Sheesham study table", 15, INK, 700)
    s.text(316, 252, "₹8,499  ·  free delivery", 14, BRAND_DARK, 700)
    s.chip(316, 270, "Buy now", BRAND, "#FFFFFF", 13.5, "shopping-bag")
    s.chip(420, 270, "More", "#F1F4EC", INK, 13.5)
    y = s.bubble(552, 80, ["Hey John! Loved your", "new lamp? Here's our", "study-table range 👇"], "in", 15.5, time="12:10")
    s.bubble(760, y + 16, ["Do you have it", "in walnut?"], "out", 15.5, time="12:14")
    s.chip(60, 300, "Catalog-led selling", "#FBF0DC", "#8A5A0B", 14, "layout-grid")
    return s


def agencies():
    s = base("briefcase", "Marketing Agencies", "#4F46E5")
    s.card(300, 46, 460, 300)
    s.text(322, 82, "Client workspaces", 17, INK, 800)
    s.chip(616, 62, "3 active", "#EEF0FF", "#4F46E5", 12.5)
    clients = [("Urban Bakes", "1,240 leads", 0.82, CORAL), ("FitZone Gym", "860 leads", 0.6, VIOLET), ("Nest Realty", "2,105 leads", 0.95, BRAND)]
    for i, (n, l, sc, c) in enumerate(clients):
        y = 104 + i * 74
        s.rect(318, y, 424, 62, 10, "#FAFBF7", LINE)
        s.avatar(346, y + 31, 17, n[0] + n.split()[1][0], c)
        s.text(374, y + 26, n, 15, INK, 700)
        s.text(374, y + 47, l, 12.5, MUTED)
        s.rect(540, y + 26, 180, 9, 4.5, "#EEF1EA")
        s.rect(540, y + 26, 180 * sc, 9, 4.5, c)
    s.chip(60, 300, "Manage every client", "#EEF0FF", "#4F46E5", 14, "layers")
    return s


def automotive():
    s = base("car", "Automotive", "#475569")
    y = s.bubble(300, 54, ["Hello Ahmed! Your Creta is due", "for its 20,000 km service.", "Book a slot this week 🔧"], "in", 17,
                 buttons=[("wrench", "Book service"), ("phone", "Call workshop")], time="10:00")
    s.bubble(740, y + 18, ["Booked for Friday 10 AM 👍"], "out", 17, time="10:06")
    s.chip(60, 300, "Service reminders", "#E8ECF1", "#334155", 14, "gauge")
    return s


def real_estate():
    s = base("building-2", "Real Estate", "#0F766E", (0.85, 0.85))
    y = s.bubble(740, 52, ["Can I see photos of the", "3BHK at Lake View?"], "out", 16, time="4:31")
    s.card(300, y + 16, 300, 236)
    g = s.uid("sky")
    s.defs.append(f'<linearGradient id="{g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE3F7"/><stop offset="1" stop-color="#E8F5FC"/></linearGradient>')
    s.rect(312, y + 28, 276, 130, 10, f"url(#{g})")
    s.icon("building", 400, y + 40, 100, "#0F766E", 1.4)
    s.text(316, y + 184, "Lake View Residences · 3BHK", 15, INK, 700)
    s.text(316, y + 208, "₹1.2 Cr · 1,650 sq ft", 14, BRAND_DARK, 700)
    s.chip(616, y + 160, "Book site visit", BRAND, "#FFFFFF", 14, "map-pin")
    s.chip(616, y + 206, "Brochure (PDF)", "#FFFFFF", INK, 14, "file-down")
    s.chip(60, 300, "Site-visit bookings", "#DDF3F0", "#0F766E", 14, "key-round")
    return s


def freelancers():
    s = base("user-round", "Freelancers & Consultants", "#0891B2")
    y = s.bubble(300, 56, ["Hi Priya! Your invoice for", "October is ready 🧾"], "in", 17, time="11:05")
    s.card(300, y + 14, 300, 168)
    s.rect(312, y + 26, 276, 96, 8, "#F4F7FB")
    s.text(328, y + 60, "Invoice", 22, "#1D6FC2", 800)
    s.skeleton(328, y + 74, [180, 140, 200], 7, 13, "#DCE5F0")
    s.icon("file-text", 316, y + 134, 22, CORAL)
    s.text(346, y + 151, "Invoice_Oct.pdf · 1 page", 14, INK, 600)
    s.bubble(760, y + 70, ["Paid via UPI ✅", "Thanks!"], "out", 16, time="11:20")
    s.chip(60, 300, "Invoices & follow-ups", "#DDF3F9", "#0E7490", 14, "receipt-indian-rupee")
    return s


INDUSTRIES = {
    "banking-finance": banking, "travel-tourism": travel, "beauty-cosmetics": beauty, "education": education, "spas-salons": spas,
    "ecommerce": ecommerce, "restaurant-food": restaurant, "health-wellness": health, "home-decor": home_decor,
    "marketing-agencies": agencies, "automotive": automotive, "real-estate": real_estate, "freelancer-consultants": freelancers,
}
