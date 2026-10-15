"""Generates the EventDeck report diagrams as SVG (rendered to PNG by render.cjs).

Every box and arrow describes code that exists in the repository; file and
function names are the real ones. Run: python diagrams.py  (writes *.svg here).
"""
import os
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
INK, MUTED, LINE, NAVY = "#222222", "#6B7280", "#3F4A5C", "#1F3864"
KINDS = {
    "blue": ("#E9F0FA", "#2F4F8F", INK),
    "purple": ("#F0EBF8", "#6B4FA0", INK),
    "green": ("#EAF4EA", "#3C7A3C", INK),
    "amber": ("#FDF3E1", "#B7791F", INK),
    "red": ("#FDECEC", "#B42318", INK),
    "white": ("#FFFFFF", LINE, INK),
    "grey": ("#F3F4F6", "#6B7280", INK),
    "entity": (NAVY, NAVY, "#FFFFFF"),
}
FONT = "Arial, Helvetica, sans-serif"


class D:
    def __init__(self, w, h):
        self.w, self.h, self.el = w, h, []

    def _t(self, x, y, s, size, color, weight="normal", anchor="middle"):
        self.el.append(
            f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" fill="{color}" '
            f'font-weight="{weight}" text-anchor="{anchor}" dominant-baseline="middle">{escape(s)}</text>'
        )

    def text(self, x, y, s, size=20, color=MUTED, weight="normal", anchor="middle", bg=False):
        lines = s.split("\n")
        lh = size * 1.25
        y0 = y - lh * (len(lines) - 1) / 2
        if bg:
            wmax = max(len(l) for l in lines) * size * 0.53 + 14
            self.el.append(
                f'<rect x="{x - wmax / 2 if anchor == "middle" else x - 7}" y="{y0 - size * 0.75}" width="{wmax}" '
                f'height="{lh * len(lines) + size * 0.25}" fill="#FFFFFF"/>'
            )
        for i, l in enumerate(lines):
            self._t(x, y0 + i * lh, l, size, color, weight, anchor)

    def container(self, x, y, w, h, title=None):
        self.el.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="#F7F8FC" stroke="#D5D9E6" stroke-width="2.5"/>')
        if title:
            self._t(x + 30, y + 40, title, 21, NAVY, "bold", "start")

    def box(self, x, y, w, h, title, sub=None, kind="blue", size=23, rx=18, sub_size=None, bold=None):
        fill, stroke, ink = KINDS[kind]
        self.el.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>')
        tl = title.split("\n")
        sl = sub.split("\n") if sub else []
        ss = sub_size or size - 4
        bold = (sub is not None) if bold is None else bold
        gap = 14 if sl else 0
        total = len(tl) * size * 1.25 + gap + len(sl) * ss * 1.3
        cy = y + h / 2 - total / 2
        for i, l in enumerate(tl):
            self._t(x + w / 2, cy + size * 0.62 + i * size * 1.25, l, size, ink, "bold" if bold else "normal")
        cy += len(tl) * size * 1.25 + gap
        for i, l in enumerate(sl):
            self._t(x + w / 2, cy + ss * 0.65 + i * ss * 1.3, l, ss, "#E5E7EB" if kind == "entity" else MUTED)

    def pill(self, x, y, w, h, title, kind="blue", size=23):
        self.box(x, y, w, h, title, kind=kind, size=size, rx=h / 2, bold=False)

    def store(self, x, y, w, h, label, size=19):
        self.el.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#F3F4F6" stroke="none"/>')
        self.el.append(
            f'<polyline points="{x + w},{y} {x},{y} {x},{y + h} {x + w},{y + h}" fill="none" stroke="#6B7280" stroke-width="3"/>'
        )
        self._t(x + w / 2, y + h / 2, label, size, INK)

    def table(self, x, y, w, name, rows):
        rh, hh = 30, 46
        h = hh + rh * len(rows) + 10
        self.el.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#FFFFFF" stroke="{NAVY}" stroke-width="2.5"/>')
        self.el.append(f'<path d="M{x},{y + hh} v-{hh - 10} a10,10 0 0 1 10,-10 h{w - 20} a10,10 0 0 1 10,10 v{hh - 10} z" fill="{NAVY}"/>')
        self._t(x + w / 2, y + hh / 2 + 1, name, 21, "#FFFFFF", "bold")
        for i, (col, tag) in enumerate(rows):
            cy = y + hh + 8 + rh * i + rh / 2
            self._t(x + 16, cy, col, 17, INK, "bold" if tag == "PK" else "normal", "start")
            if tag:
                self._t(x + w - 14, cy, tag, 15, MUTED, "normal", "end")
        return h

    def line(self, pts, end=True, start=False, dashed=False, label=None, at=None, color=LINE, lsize=19):
        d = " ".join(f"{px},{py}" for px, py in pts)
        attrs = f'fill="none" stroke="{color}" stroke-width="2.6"'
        if dashed:
            attrs += ' stroke-dasharray="10 8"'
        if end:
            attrs += ' marker-end="url(#a)"'
        if start:
            attrs += ' marker-start="url(#a)"'
        self.el.append(f'<polyline points="{d}" {attrs}/>')
        if label:
            lx, ly = at
            self.text(lx, ly, label, lsize, MUTED, bg=True)

    def save(self, name):
        head = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
            '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
            f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{LINE}"/></marker></defs>'
            f'<rect width="{self.w}" height="{self.h}" fill="#FFFFFF"/>'
        )
        with open(os.path.join(HERE, name + ".svg"), "w") as f:
            f.write(head + "".join(self.el) + "</svg>")


def architecture():
    d = D(2000, 1490)
    d.container(40, 50, 1480, 240, "CLIENT TIER (browser or phone)")
    d.box(80, 120, 440, 130, "Participant pages", "discover · book · pay · tickets")
    d.box(560, 120, 440, 130, "Organizer & moderator pages", "events · bookings · team · scanner")
    d.box(1040, 120, 440, 130, "Admin console", "people · refunds · payouts · audit")
    d.container(40, 330, 1480, 190, "EDGE")
    d.box(180, 395, 1200, 85, "src/proxy.ts — refreshes the Supabase session cookie; signed-out users are sent to /login", kind="white", size=22, bold=False)
    for x in (300, 780, 1260):
        d.line([(x, 250), (x, 395)], start=True)
    d.text(520, 310, "HTTPS · session cookie", 19, bg=True)
    d.container(40, 560, 1480, 560, "APPLICATION TIER")
    d._t(330, 600, "Next.js 16 · React 19 · Node.js", 19, MUTED, "normal", "start")
    d.box(80, 630, 440, 120, "Server Components", "App Router pages · requirePageUser")
    d.box(560, 630, 440, 120, "Server Actions", "src/app/actions/*.ts · requireUser")
    d.box(1040, 630, 440, 120, "Route handlers", "/api/checkin · payments · webhooks")
    for x in (300, 780, 1260):
        d.line([(x, 480), (x, 630)], start=True)
        d.line([(x, 750), (x, 800)])
    d.box(80, 800, 1400, 280, "", kind="purple")
    d._t(780, 832, "Domain and service modules (src/lib)", 23, INK, "bold")
    mods = [
        ("auth.ts", "session · roles"), ("domain/eligibility.ts", "audience rules"), ("server/bookings.ts", "reserve · release"),
        ("server/payments.ts", "confirmPayment"), ("server/checkin.ts", "scan exactly once"), ("server/moderators.ts", "assertCanScanEvent"),
        ("domain/transitions.ts", "state machine"), ("domain/pricing.ts", "server-side prices"), ("server/cancellations.ts", "cancel · refund"),
        ("server/payouts.ts", "settlements"), ("server/pdf.ts", "ticket PDF + QR"), ("server/audit.ts", "audit · notify"),
    ]
    for i, (a, b) in enumerate(mods):
        x = 92 + (i % 6) * 231
        y = 862 + (i // 6) * 102
        d.box(x, y, 219, 88, a, b, kind="white", size=17, sub_size=16, rx=12)
    d.container(40, 1160, 1480, 260, "DATA TIER")
    d.box(100, 1230, 600, 130, "Drizzle ORM + postgres.js", "typed queries · db.transaction()", kind="green")
    d.box(780, 1230, 680, 130, "Supabase PostgreSQL", "CHECK / UNIQUE constraints · RLS · FOR UPDATE", kind="green")
    d.line([(780, 1080), (780, 1140), (400, 1140), (400, 1230)], label="SQL in transactions", at=(590, 1140))
    d.line([(700, 1295), (780, 1295)])
    d.box(1580, 120, 380, 150, "Supabase Auth", "email + password\nsession JWT", kind="amber")
    d.box(1580, 620, 380, 140, "Razorpay Test Mode", "Checkout · webhooks", kind="amber")
    d.box(1580, 850, 380, 150, "Supabase Storage", "posters (public)\nticket PDFs (private)", kind="amber")
    d.box(1580, 1210, 380, 170, "Supabase Realtime", "bookings and\nnotifications changes", kind="amber")
    d.line([(1770, 270), (1770, 437), (1380, 437)], start=True, label="getClaims · getUser", at=(1770, 350))
    d.line([(1480, 690), (1580, 690)], start=True)
    d.text(1530, 600, "orders,\nwebhooks", 18, bg=True)
    d.line([(1480, 925), (1580, 925)])
    d.text(1530, 1030, "posters,\nPDFs", 18, bg=True)
    d.line([(1460, 1295), (1580, 1295)], dashed=True, label="change feed", at=(1520, 1255), lsize=17)
    d.line([(1960, 1295), (1985, 1295), (1985, 22), (1260, 22), (1260, 120)], dashed=True, label="WebSocket: live refresh", at=(1640, 22))
    d.text(1770, 1440, "Dashed: live updates; pages also load\nfresh data on every request.", 17)
    d.save("fig_architecture")


def dfd():
    d = D(2000, 1580)
    d.box(40, 140, 280, 120, "Participant", kind="entity", bold=False)
    d.box(1680, 140, 280, 120, "Organizer", kind="entity", bold=False)
    d.box(40, 960, 280, 120, "Razorpay\n(Test Mode)", kind="entity", bold=False)
    d.box(1680, 960, 280, 120, "Event\nModerator", kind="entity", bold=False)
    d.box(1680, 1380, 280, 120, "Administrator", kind="entity", bold=False)
    d.pill(430, 115, 380, 170, "1.0  Sign up, sign in\n& manage profile")
    d.pill(1190, 115, 380, 170, "2.0  Publish events,\ntiers & moderators")
    d.pill(430, 935, 380, 170, "3.0  Book, pay &\nissue tickets")
    d.pill(1190, 935, 380, 170, "4.0  Check in\nattendees")
    d.pill(1190, 1355, 380, 170, "5.0  Cancel, refund,\nsettle & report")
    d.store(850, 164, 300, 72, "D1  profiles")
    d.store(850, 404, 300, 72, "D2  events · ticket tiers")
    d.store(850, 984, 300, 72, "D3  bookings · tickets")
    d.store(850, 1404, 300, 72, "D4  audit · notifications")
    d.line([(320, 200), (430, 200)], start=True)
    d.text(375, 80, "credentials,\nprofile", 18)
    d.line([(810, 200), (850, 200)], start=True)
    d.line([(1680, 200), (1570, 200)])
    d.text(1625, 80, "events, tiers,\naudience, team", 18)
    d.line([(1300, 285), (1300, 440), (1150, 440)])
    d.line([(850, 440), (720, 440), (720, 935)], label="prices, capacity,\naudience", at=(720, 640))
    d.line([(240, 260), (240, 780), (520, 780), (520, 935)], start=True, label="ticket request /\ntickets, QR", at=(240, 520))
    d.line([(320, 1020), (430, 1020)], start=True)
    d.text(375, 1150, "orders,\npayment events", 18)
    d.line([(810, 1020), (850, 1020)])
    d.line([(1150, 1020), (1190, 1020)], start=True)
    d.text(1170, 905, "ticket status,\ncheck-ins", 18)
    d.line([(1680, 1020), (1570, 1020)])
    d.text(1625, 920, "QR scans", 18)
    d.line([(1460, 935), (1460, 650), (1820, 650), (1820, 260)], label="bookings, attendance", at=(1640, 650))
    d.line([(620, 1105), (620, 1440), (850, 1440)], label="audit, notify", at=(735, 1440))
    d.line([(1150, 1440), (1190, 1440)])
    d.line([(1680, 1440), (1570, 1440)])
    d.text(1625, 1340, "decisions", 18)
    d.line([(1260, 1355), (1260, 1210), (1000, 1210), (1000, 1056)], label="cancel, refund", at=(1130, 1210))
    d.save("fig_dfd")


def erd():
    d = D(2000, 1320)
    W = 410
    X = [40, 530, 1020, 1510]
    h = {}
    h["profiles"] = d.table(X[0], 40, W, "profiles", [("id", "PK"), ("email", "unique"), ("full_name", ""), ("role", "enum"), ("institution_type", "enum"), ("campus", "enum"), ("category", "enum"), ("is_active", "")])
    d.table(X[0], 460, W, "event_moderators", [("id", "PK"), ("event_id", "FK → events"), ("user_id", "FK → profiles"), ("added_by", "FK → profiles"), ("revoked_at", "null = active")])
    d.table(X[0], 750, W, "cancellation_requests", [("id", "PK"), ("event_id", "FK → events"), ("requested_by", "FK → profiles"), ("reason", ""), ("status", "enum")])
    d.table(X[0], 1040, W, "payouts", [("id", "PK"), ("event_id", "FK → events"), ("organizer_id", "FK → profiles"), ("amount_paise", ""), ("platform_fee_paise", ""), ("status", "enum")])
    d.table(X[1], 40, W, "events", [("id", "PK"), ("organizer_id", "FK → profiles"), ("slug", "unique"), ("title", ""), ("status", "enum"), ("start_at · end_at", ""), ("registration_closes_at", ""), ("checkin_opens/closes_at", ""), ("max_tickets_per_booking", "1–4"), ("eligible_* (audience)", "arrays")])
    d.table(X[1], 500, W, "ticket_tiers", [("id", "PK"), ("event_id", "FK → events"), ("name", ""), ("price_paise", ""), ("capacity", ""), ("allocated", "≤ capacity")])
    d.table(X[1], 840, W, "booking_items", [("id", "PK"), ("booking_id", "FK → bookings"), ("tier_id", "FK → ticket_tiers"), ("quantity", "> 0"), ("unit_price_paise", "")])
    d.table(X[2], 40, W, "bookings", [("id", "PK"), ("reference", "unique"), ("event_id", "FK → events"), ("user_id", "FK → profiles"), ("kind", "enum"), ("status", "enum"), ("payment_status", "enum"), ("refund_status", "enum"), ("quantity", ""), ("amount_paise", ""), ("expires_at", "hold"), ("idempotency_key", "unique/user")])
    d.table(X[2], 560, W, "payments", [("id", "PK"), ("booking_id", "FK → bookings"), ("order_id", "unique"), ("payment_id", "unique"), ("amount_paise", "> 0"), ("status", "enum"), ("confirmed_via", "")])
    d.table(X[2], 930, W, "refunds", [("id", "PK"), ("booking_id", "FK, unique"), ("payment_id", "FK → payments"), ("amount_paise", "> 0"), ("status", "enum")])
    d.table(X[3], 40, W, "tickets", [("id", "PK"), ("booking_id", "FK → bookings"), ("event_id", "FK → events"), ("tier_id", "FK → ticket_tiers"), ("ticket_number", "unique"), ("qr_token", "unique"), ("status", "enum")])
    d.table(X[3], 420, W, "check_ins", [("id", "PK"), ("ticket_id", "FK, unique"), ("event_id", "FK → events"), ("scanned_by", "FK → profiles"), ("method", "qr / manual")])

    def rel(pts, a, b, ap, bp):
        d.line(pts, end=False)
        d.text(ap[0], ap[1], a, 18, NAVY, "bold")
        d.text(bp[0], bp[1], b, 18, NAVY, "bold")

    rel([(450, 110), (530, 110)], "1", "N", (462, 92), (518, 92))
    rel([(450, 300), (490, 300), (490, 430), (1020, 430)], "1", "N", (462, 282), (1006, 412))
    rel([(735, 394), (735, 500)], "1", "N", (752, 410), (752, 484))
    rel([(940, 110), (1020, 110)], "1", "N", (952, 92), (1008, 92))
    rel([(735, 734), (735, 840)], "1", "N", (752, 750), (752, 824))
    rel([(1060, 454), (1060, 500), (985, 500), (985, 900), (940, 900)], "1", "N", (1077, 470), (952, 882))
    rel([(1225, 454), (1225, 560)], "1", "N", (1242, 470), (1242, 544))
    rel([(1430, 110), (1510, 110)], "1", "N", (1442, 92), (1498, 92))
    rel([(1715, 304), (1715, 420)], "1", "0..1", (1732, 320), (1745, 404))
    rel([(1225, 824), (1225, 930)], "1", "0..1", (1242, 840), (1257, 914))
    d.box(1510, 760, 410, 300, "Other tables", "organizer_applications\norganizer_payout_accounts\nnotifications · audit_logs\nwebhook_events", kind="grey", size=21, sub_size=17)
    d.text(1715, 1120, "1 — N: one row relates to many.\n1 — 0..1: enforced by a UNIQUE key.", 17)
    d.save("fig_erd")


def authz():
    d = D(2000, 1500)
    d.box(650, 30, 600, 100, "Request from a browser", kind="entity", bold=False)
    d.box(500, 190, 900, 150, "Edge proxy — src/proxy.ts", "refreshes the session cookie\nprotected prefixes: /my · /organizer · /admin · /moderate")
    d.box(500, 400, 900, 150, "getCurrentUser() — src/lib/auth.ts", "verifies the session with Supabase Auth (getUser)\nloads the profile; deactivated accounts count as signed out")
    d.box(500, 610, 900, 150, "Role gate", "requirePageUser(roles) for pages · requireUser(roles) for actions and APIs\nroles: participant · organizer · admin")
    d.box(400, 820, 1100, 330, "", kind="purple")
    d._t(950, 852, "Resource checks in the service layer", 23, INK, "bold")
    d.box(430, 890, 330, 230, "assertCanManageEvent", "owner organizer\nor admin\n(edit, verify,\nreports, team)", kind="white", size=19, sub_size=17, rx=12)
    d.box(785, 890, 330, 230, "assertCanScanEvent", "admin, owner, or an\nactive moderator of\nthis event; checked\non every scan", kind="white", size=19, sub_size=17, rx=12)
    d.box(1140, 890, 330, 230, "Ownership checks", "booking, ticket PDF,\npayment order: owner,\nevent organizer\nor admin", kind="white", size=19, sub_size=17, rx=12)
    d.box(500, 1220, 900, 150, "Supabase PostgreSQL", "Row-Level Security on every table · CHECK / UNIQUE constraints\ndirect API calls with a user token see only that user's rows", kind="green")
    for y1, y2 in ((130, 190), (340, 400), (550, 610), (760, 820), (1150, 1220)):
        d.line([(950, y1), (950, y2)])
    d.box(1560, 215, 380, 100, "Signed out →\n/login?next=…", kind="red", size=20, bold=False)
    d.box(1560, 425, 380, 100, "Treated as\nsigned out", kind="red", size=20, bold=False)
    d.box(1560, 635, 380, 100, "Page → /forbidden\nAPI → 401 / 403", kind="red", size=20, bold=False)
    d.box(1560, 935, 380, 140, "Refused: 403, or\n404 so another user's\nrecords are not revealed", kind="red", size=19, bold=False)
    for y in (265, 475, 685):
        d.line([(1400, y), (1560, y)])
    d.line([(1500, 1005), (1560, 1005)])
    d.box(40, 400, 330, 440, "Never trusted\nfrom the client", "role\nticket price\nper-person limit\naudience fields\n(campus, institution)\nticket validity\npayment success", kind="amber", size=21, sub_size=19)
    d.text(950, 1440, "Every page, Server Action and route handler repeats these checks; the proxy only redirects.", 19)
    d.save("fig_authorization")


def event_lifecycle():
    d = D(2000, 1000)
    d.el.append(f'<circle cx="90" cy="300" r="22" fill="{NAVY}"/>')
    d.box(260, 230, 330, 140, "Draft", "editable · hidden", kind="grey")
    d.box(860, 230, 330, 140, "Published", "listed · bookable", kind="blue")
    d.box(1520, 230, 380, 140, "Cancelled", "final", kind="red")
    d.line([(112, 300), (260, 300)], label="create", at=(186, 260))
    d.line([(590, 270), (860, 270)], label="publish (≥ 1 tier, not ended)", at=(725, 200))
    d.line([(860, 330), (590, 330)], label="unpublish", at=(660, 380))
    d.line([(90, 278), (90, 120), (1025, 120), (1025, 230)], label="publish now", at=(560, 120))
    d.box(840, 560, 370, 150, "Cancellation\nrequest (pending)", "cancellation_requests", kind="amber", sub_size=17)
    d.line([(960, 370), (960, 560)], label="organizer\nrequests", at=(870, 465))
    d.line([(1090, 560), (1090, 370)], label="admin\nrejects", at=(1170, 465))
    d.line([(1210, 635), (1710, 635), (1710, 370)], label="admin approves", at=(1460, 635))
    d.line([(1190, 300), (1520, 300)], label="admin cancels directly", at=(1355, 260))
    d.box(1440, 760, 520, 200, "On cancellation (one transaction)", "live bookings → event_cancelled\ntickets invalidated · refunds queued\nfor paid bookings · everyone notified", kind="white", size=20, sub_size=18)
    d.line([(1710, 640), (1710, 760)], end=False, dashed=True)
    d.box(260, 560, 400, 150, "Ended (display only)", "shown after end_at;\nnot a stored status", kind="grey", size=21, sub_size=18)
    d.line([(860, 350), (760, 350), (760, 635), (660, 635)], dashed=True, label="time passes", at=(760, 500))
    d.text(450, 860, "Event statuses stored in events.status: draft · published · cancelled.\nCancelled events cannot be republished.", 18)
    d.save("fig_event_lifecycle")


def booking_txn():
    d = D(2000, 1880)
    steps = [
        ("1", "Idempotency check", "same (user, idempotency key) → return the existing booking", "white"),
        ("2", "Release expired holds", "expireHolds({ eventId }) frees unpaid seats after 10 minutes", "white"),
        ("3", "BEGIN — lock rows", "profile FOR UPDATE (serialises this user) · event FOR SHARE", "blue"),
        ("4", "Event and eligibility rules", "published · registration open · checkEligibility(stored profile)", "blue"),
        ("5", "Price on the server", "priceOrder(lines, tiers from DB, min(event limit, 4))", "blue"),
        ("6", "Per-person limit", "tickets already held + new tickets ≤ limit", "blue"),
        ("7", "Reserve seats atomically", "UPDATE ticket_tiers SET allocated = allocated + n\nWHERE allocated + n <= capacity   (tiers in sorted order)", "purple"),
        ("8", "Insert booking + items", "paid → awaiting_payment (10-min hold) · free → approved\ncomplimentary → pending_verification", "blue"),
        ("9", "Tickets, audit, notifications", "free: issue tickets now · audit row · notify user and organizer", "blue"),
        ("", "COMMIT", "", "green"),
    ]
    y = 30
    ys = []
    for n, t, s, k in steps:
        hgt = 150 if "\n" in s else 125
        if not s:
            hgt = 90
        d.box(380, y, 980, hgt, (f"{n}.  " if n else "") + t, s or None, kind=k, size=23, sub_size=19, bold=True)
        ys.append((y, hgt))
        y += hgt + 50
    for (y1, h1), (y2, _) in zip(ys, ys[1:]):
        d.line([(870, y1 + h1), (870, y2)])
    d.box(1500, 560, 440, 620, "ROLLBACK", "DomainError →\nfriendly message:\n\n“registration has closed”\n“not eligible …”\n“limit is 4 per person”\n“not enough tickets\nleft in that tier”\n\nnothing is written", kind="red", size=23, sub_size=18)
    for i in (3, 4, 5, 6):
        yy = ys[i][0] + ys[i][1] / 2
        d.line([(1360, yy), (1500, yy)], dashed=True)
    d.box(40, 30, 280, 270, "Before the\ntransaction", "cheap checks,\nno locks held", kind="grey", size=21, sub_size=18)
    d.text(870, y + 10, "A duplicate idempotency key or a CHECK violation raised by the database is mapped to the same results.", 18)
    d.save("fig_booking_transaction")


def booking_states():
    d = D(2000, 1230)
    d.el.append(f'<circle cx="80" cy="190" r="20" fill="{NAVY}"/>')
    d.el.append(f'<circle cx="80" cy="620" r="20" fill="{NAVY}"/>')
    d.el.append(f'<circle cx="80" cy="1010" r="20" fill="{NAVY}"/>')
    d.box(240, 120, 380, 140, "awaiting_payment", "paid booking · 10-min hold", kind="amber", size=22, sub_size=18)
    d.box(240, 550, 380, 140, "pending_verification", "pass request", kind="amber", size=22, sub_size=18)
    d.box(860, 550, 340, 140, "approved", "tickets valid", kind="green", size=24, sub_size=18)
    d.box(860, 120, 340, 140, "expired", "hold lapsed", kind="grey", size=22, sub_size=18)
    d.box(1440, 120, 340, 140, "cancelled", "by participant (unpaid)", kind="grey", size=22, sub_size=18)
    d.box(240, 940, 380, 140, "rejected", "terminal", kind="red", size=22, sub_size=18)
    d.box(860, 940, 340, 140, "event_cancelled", "terminal · refund if paid", kind="red", size=22, sub_size=18)
    d.box(1440, 550, 340, 140, "payment_exception", "terminal · admin resolves", kind="red", size=21, sub_size=18)
    d.line([(100, 190), (240, 190)], label="paid", at=(170, 160))
    d.line([(100, 620), (240, 620)], label="pass", at=(170, 590))
    d.line([(80, 990), (80, 880), (760, 880), (760, 660), (860, 660)], label="free: approved at once", at=(600, 880))
    d.line([(620, 190), (860, 190)], label="no payment in 10 min", at=(740, 150))
    d.line([(520, 260), (520, 410), (1610, 410), (1610, 260)], label="participant cancels", at=(900, 410))
    d.line([(560, 260), (560, 520), (900, 520), (900, 550)], label="payment verified", at=(730, 520))
    d.line([(620, 620), (860, 620)], label="organizer approves", at=(740, 590))
    d.line([(430, 690), (430, 940)], label="organizer\nrejects", at=(340, 815))
    d.line([(1030, 690), (1030, 940)], label="event cancelled", at=(1110, 815))
    d.line([(1200, 230), (1300, 230), (1300, 600), (1200, 600)], dashed=True)
    d.line([(1440, 230), (1340, 230), (1340, 640), (1200, 640)], dashed=True)
    d.text(1320, 500, "late payment,\nseats re-allocated", 17, bg=True)
    d.line([(1700, 260), (1700, 550)], dashed=True)
    d.line([(1030, 120), (1030, 60), (1960, 60), (1960, 620), (1780, 620)], dashed=True)
    d.text(1830, 420, "late payment,\nseats gone", 17, bg=True)
    d.text(1000, 1160, "Allowed moves are listed in BOOKING_TRANSITIONS (src/lib/domain/transitions.ts) and applied with a\ncompare-and-set UPDATE … WHERE status IN (expected). Every live status (amber, green) can also move to event_cancelled.", 18)
    d.save("fig_booking_states")


def checkin():
    d = D(2000, 1510)
    d.box(640, 30, 720, 100, "Scan: QR from camera, or a typed ticket number", kind="entity", size=21, bold=False)
    steps = [
        ("assertCanScanEvent(actor, event)", "admin · owner · active moderator of this event", "403 — not allowed to scan"),
        ("parseScan(raw)", "accepts EVD1:<token>, a raw token or a ticket number", "Invalid — not a ticket from this system"),
        ("Look up the ticket in the database", "join tickets → ticket_tiers → bookings", "Invalid — ticket not found / other event"),
        ("Check every gate", "event not cancelled · ticket valid · booking approved\npayment paid or not required", "Invalid — reason shown, audit row written"),
        ("Inside the check-in window?", "checkin_opens_at ≤ now ≤ checkin_closes_at", "Not open yet / closed"),
        ("INSERT INTO check_ins … ON CONFLICT (ticket_id) DO NOTHING", "the UNIQUE ticket_id makes the first scan win, on any device", None),
    ]
    y = 190
    ys = []
    for t, s, err in steps:
        hgt = 150 if "\n" in s else 125
        d.box(420, y, 1000, hgt, t, s, kind="purple" if t.startswith("INSERT") else "blue", size=22, sub_size=18)
        if err:
            d.box(1530, y + 12, 430, hgt - 24, err, kind="red", size=18, bold=False)
            d.line([(1420, y + hgt / 2), (1530, y + hgt / 2)], label="no", at=(1475, y + hgt / 2 - 22), lsize=17)
        ys.append((y, hgt))
        y += hgt + 55
    d.line([(920, 130), (920, 190)])
    for (y1, h1), (y2, _) in zip(ys, ys[1:]):
        d.line([(920, y1 + h1), (920, y2)])
    ly, lh = ys[-1]
    d.box(420, ly + lh + 90, 460, 130, "Row inserted", "✓ Checked in — attendee,\ntier and ticket number", kind="green", size=22, sub_size=18)
    d.box(960, ly + lh + 90, 460, 130, "Row already exists", "Already used — by whom, when", kind="amber", size=22, sub_size=18)
    d.line([(650, ly + lh), (650, ly + lh + 90)])
    d.line([(1190, ly + lh), (1190, ly + lh + 90)])
    d.box(40, 190, 300, 380, "Trusted from\nthe QR code", "only a 192-bit\nrandom token\n\neverything else is\nread from the\ndatabase", kind="amber", size=21, sub_size=18)
    d.save("fig_checkin")


if __name__ == "__main__":
    for f in (architecture, dfd, erd, authz, event_lifecycle, booking_txn, booking_states, checkin):
        f()
    print("ok")
