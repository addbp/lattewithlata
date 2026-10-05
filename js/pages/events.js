/* ==========================================================================
   Latte with Lata - js/pages/events.js (PAGE lane events + contact)
   events.html ships the eight recording nights as static cards (content/pages.json events.upcoming), so the page is complete without a server.
   This module:
     1. drops nights that are already over (the visitor's calendar; the API does the same on its side);
     2. when the API answers (GET /api/health, then GET /api/events) overlays the live numbers on the cards BY ID:
          seats left badge ("36 seats left", filled when 10 or fewer remain)
          a full night  -> "Full" badge + the walk-in line + "Join the waitlist by email" (mailto) instead of the reserve button
          a night that is not bookable for another reason -> the server's sentence instead of the button
        removes cards the API no longer lists and builds cards for nights the API adds (cloned from the first card);
     3. without the API nothing else changes: the badge stays hidden and every reserve button already points at
        book.html?type=recording&date=YYYY-MM-DD (the booking page owns the form).
   No-op when the list is not on the page. Runtime strings come from data-label-* on the list (pages.json labels).
   ========================================================================== */

const LOW_SEATS = 10;
const norm = (s) => String(s == null ? "" : s).replace(/ /g, " ").replace(/\s+/g, " ").trim();

function setText(el, value) {
    if (!el) return;
    const next = norm(value);
    if (norm(el.textContent) !== next) el.textContent = next;      // keeps the typeset no-break spaces when the copy is the same
    const holder = el.closest("p, h3") || el;
    if (holder !== el && holder.hasAttribute("data-optional")) holder.hidden = !next;
}

export default async function init(ctx) {
    const list = document.querySelector("[data-events]");
    if (!list) return;
    const api = ctx.api;
    const empty = document.querySelector("[data-events-empty]");
    const labels = {
        seats: list.dataset.labelSeats || "{n} seats left",
        full: list.dataset.labelFull || "",
        fullBadge: list.dataset.labelFullBadge || "Full",
        mailto: list.dataset.mailto || ""
    };
    const firstRow = list.querySelector(".event-row");
    const template = firstRow ? firstRow.cloneNode(true) : null;

    const showEmpty = () => { if (empty) empty.hidden = list.querySelector("[data-event]") !== null; };

    /* 1. nights that are over */
    const today = api.todayISO();
    list.querySelectorAll("[data-event]").forEach((card) => {
        if (card.dataset.date && card.dataset.date < today) card.closest(".event-row").remove();
    });
    showEmpty();

    /* 2. live seats */
    if (!(await api.apiAvailable())) return;
    let events;
    try { events = (await api.get("/api/events")).events; } catch (_) { return; }      // the static cards stay as they are
    if (!Array.isArray(events)) return;

    const rows = new Map();
    list.querySelectorAll("[data-event]").forEach((card) => rows.set(card.id, card.closest(".event-row")));
    const added = [];

    events.forEach((ev) => {
        if (!ev || !ev.date) return;
        const id = String(ev.id || "rec-" + ev.date);
        let row = rows.get(id);
        if (!row) {
            if (!template) return;
            row = template.cloneNode(true);
            row.classList.remove("waiting", "animated");
            row.removeAttribute("data-init");
            row.querySelectorAll("[data-init]").forEach((el) => el.removeAttribute("data-init"));
            added.push(row);
        }
        rows.delete(id);
        fill(row, ev, id);
        seatState(row, ev);
        list.appendChild(row);                                       // API order (by date)
    });
    rows.forEach((row) => row.remove());                             // no longer listed by the API
    showEmpty();

    if (added.length) added.forEach((row) => ctx.core.initAll(row));
    ctx.refresh();

    function fill(row, ev, id) {
        const card = row.querySelector("[data-event]");
        const dateLabel = ev.dateLabel || api.formatDate(ev.date);
        const parts = dateLabel.split(" ");                           // "Thu 24 Sep 2026"
        if (card.id !== id) {
            card.id = id;
            card.setAttribute("aria-labelledby", id + "-title");
            const title = row.querySelector("[data-title]");
            if (title) title.id = id + "-title";
        }
        card.dataset.date = ev.date;
        const time = row.querySelector(".event__date time");
        if (time) {
            time.setAttribute("datetime", ev.date);
            setText(time.querySelector(".event__dow"), parts[0]);
            setText(time.querySelector(".event__day"), parts[1]);
            setText(time.querySelector(".event__month"), parts[2]);
        }
        setText(row.querySelector("[data-title]"), ev.title);
        setText(row.querySelector("[data-guest]"), ev.guest);
        setText(row.querySelector("[data-role]"), ev.role);
        setText(row.querySelector("[data-blurb]"), ev.blurb);
        setText(row.querySelector("[data-pillar]"), ev.pillar);
        setText(row.querySelector("[data-datelabel]"), dateLabel);
        setText(row.querySelector("[data-doors]"), api.formatTime(ev.doors));
        const pillar = row.querySelector(".event__pillar"); if (pillar) pillar.hidden = !ev.pillar;
        const guest = row.querySelector(".event__guest"); if (guest) guest.hidden = !ev.guest && !ev.role;
        const blurb = row.querySelector("[data-blurb]"); if (blurb) blurb.hidden = !ev.blurb;
        const img = row.querySelector(".event__media img");
        if (img && ev.image && img.getAttribute("src") !== ev.image) { img.setAttribute("src", ev.image); img.setAttribute("alt", ev.imageAlt || ""); }
        const href = "book.html?type=recording&date=" + encodeURIComponent(ev.date);
        const reserve = row.querySelector("[data-reserve]");
        if (reserve) { reserve.setAttribute("href", href); setText(reserve.querySelector(".a11y-only"), ", " + dateLabel); }
        const wait = row.querySelector("[data-waitlist]");
        if (wait) {
            wait.setAttribute("href", labels.mailto + "?subject=" + encodeURIComponent("Waitlist - " + dateLabel + " recording night"));
            setText(wait.querySelector(".a11y-only"), ", " + dateLabel);
        }
    }

    function seatState(row, ev) {
        const badge = row.querySelector("[data-seats]");
        const text = row.querySelector("[data-seats-text]");
        const note = row.querySelector("[data-note]");
        const reserve = row.querySelector("[data-reserve]");
        const wait = row.querySelector("[data-waitlist]");
        const left = Number(ev.seatsLeft);
        const known = Number.isFinite(left);
        const full = ev.bookableReason === "full" || (known && left <= 0);
        const blocked = !full && ev.bookable === false;

        if (badge && text) {
            badge.hidden = !known && !full;
            badge.classList.toggle("is-full", full);
            badge.classList.toggle("is-low", !full && known && left <= LOW_SEATS);
            text.textContent = full ? labels.fullBadge : labels.seats.replace("{n}", String(left)).replace(/^1 seats\b/, "1 seat");
        }
        if (note) {
            const msg = full ? labels.full : blocked && typeof ev.bookableReason === "string" ? ev.bookableReason : "";
            note.textContent = msg;
            note.hidden = !msg;
        }
        if (reserve) reserve.hidden = full || blocked;
        if (wait) wait.hidden = !full;
        row.querySelector("[data-event]").dataset.state = full ? "full" : blocked ? "closed" : "open";
    }
}
