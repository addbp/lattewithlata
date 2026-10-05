/* ==========================================================================
   Latte with Lata - js/pages/book.js (PAGE book lane) - the public booking flow. Contract: PAGES-SPEC 4 + API.md, shell kit: js/lib/api.js.
   Modules: ./book/copy.js (strings from content/pages.json), ./book/calendar.js (the date picker), ./book/ics.js ("Add to calendar"),
            ./book/manage.js (#manage: lookup + cancel dialog).

   Flow (one page, steps reveal as each is completed and stay editable):
     01 type (table | recording, ?type= & ?date= honoured)  ->  02 day (calendar; closed / blocked / past / > leadDays days are off; recording =
     Thursdays only)  ->  03 party (1-8, recording 1-4, "more" = the large-party note)  ->  04 time (GET /api/availability, grouped chips,
     refetched when the day / party / type changes)  ->  05 details  ->  06 review + POST /api/bookings  ->  07 confirmation card
     (reference + copy, .ics, manage link; kept in sessionStorage so a refresh still shows it).
   No API (static hosting)  ->  the widget is replaced by the shared call / email notice. Nothing here ever pretends to book.
   ========================================================================== */
import api, { apiAvailable, isUnavailable, formatDate, formatTime } from "../lib/api.js";
import { COPY, fill, partyLabel, withPhoneLink } from "./book/copy.js";
import { createCalendar, isISO, addDays, weekday } from "./book/calendar.js";
import { buildICS, downloadICS } from "./book/ics.js";
import { initManage } from "./book/manage.js";

const STORE_KEY = "lwl.booking.last";
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LOW_SEATS = 6;                                   // "N seats left" appears at or below this
const $ = (id) => document.getElementById(id);
const minutes = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };

export default async function init(ctx) {
    const form = $("bk-form");
    const app = $("bk-app");
    if (!form || !app) return null;                    // not the booking page

    const reduceMotion = !!(ctx && ctx.reduceMotion);
    const refreshLayout = debounce(() => { try { ctx && ctx.refresh && ctx.refresh(); } catch (_) { /* layout only */ } }, 250);

    const el = {
        fallback: $("bk-fallback"), live: $("bk-live"), done: $("bk-done"), aside: $("bk-aside"),
        steps: { type: $("bk-step-type"), when: $("bk-step-when"), party: $("bk-step-party"), time: $("bk-step-time"), details: $("bk-step-details"), confirm: $("bk-step-confirm") },
        recordingNote: $("bk-recording-note"),
        dateInput: $("bk-date"), dateLabel: $("bk-date-label"), dateError: $("bk-date-error"), dateOut: $("bk-date-out"), cal: $("bk-cal"),
        whenHelp: $("bk-when-help"), nights: $("bk-nights"),
        partyHelp: $("bk-party-help"), partyNote: $("bk-party-note"), partyError: $("bk-party-error"),
        timeHelp: $("bk-time-help"), slots: $("bk-slots"), timeError: $("bk-time-error"), timeNote: $("bk-time-note"),
        notes: $("bk-notes"), notesCount: $("bk-notes-count"), notesLive: $("bk-notes-live"),
        reviewBtn: $("bk-review-btn"), reviewActions: $("bk-review-actions"), confirmTitle: $("bk-confirm-title"),
        reviewToggle: $("bk-review-toggle"), reviewPanel: $("bk-review-panel"),
        status: $("bk-status"), submit: $("bk-submit")
    };

    const state = { type: "table", date: "", party: 2, partyTooLarge: false, time: "", availability: null, revealed: new Set(["type", "when"]), config: null };
    let cal = null;
    let availCtrl = null;
    let availSeq = 0;
    let nightsLoaded = false;
    let doneBooking = null;

    /* ---- #manage works on its own (it only needs the API) ---- */
    const manage = initManage({
        api,
        onCancelled(booking) {                           // the confirmation on screen was just cancelled: drop it, the form comes back
            if (doneBooking && doneBooking.reference === booking.reference) { clearStored(); showForm({ focus: false }); }
            if (state.date) loadAvailability({ keep: true });
        }
    });

    /* ---- API probe: static hosting = the call / email notice, never a fake form ---- */
    const online = await apiAvailable();
    let config = null;
    if (online) { try { config = await api.get("/api/config"); } catch (_) { config = null; } }
    if (!online || !config || !config.hours) {
        app.hidden = true;
        el.fallback.hidden = false;
        manage.disable();
        refreshLayout();
        return { status: "fallback" };
    }
    state.config = config;
    const today = isISO(config.today) ? config.today : api.todayISO();
    const maxDate = addDays(today, Number(config.leadDays) || 60);
    const maxParty = () => (state.type === "recording" ? (config.recording && config.recording.maxParty) || 4 : config.maxParty || 8);

    /* =====================================================================
       dates: what the calendar greys out (the server stays the judge - GET /api/availability answers for the chosen day)
       ===================================================================== */
    const overrides = config.hoursOverrides || {};
    const hasOverride = (iso) => Object.prototype.hasOwnProperty.call(overrides, iso);
    function hoursFor(iso) { return hasOverride(iso) ? overrides[iso] : (config.hours || {})[DOW[weekday(iso)]]; }
    function reasonFor(iso) {
        if ((config.blockedDates || []).includes(iso)) return { code: "blocked", label: "no bookings on this date" };
        if (state.type === "recording") {
            if (weekday(iso) !== ((config.recording && config.recording.weekday) ?? 4)) return { code: "not_recording_night", label: "recording nights are Thursdays" };
            if (hasOverride(iso) && overrides[iso] === null) return { code: "closed", label: "closed" };
            return null;
        }
        const h = hoursFor(iso);
        if (!h || !h.open || !h.close || minutes(h.close) - (Number(config.lastSeatingMinutes) || 90) < minutes(h.open)) return { code: "closed", label: "closed" };
        return null;
    }
    function dateProblem(iso) {                          // -> reason code | ""
        if (!isISO(iso)) return "invalid_date";
        if (iso < today) return "past";
        if (iso > maxDate) return "too_far";
        const r = reasonFor(iso);
        return r ? r.code : "";
    }

    /* =====================================================================
       small view helpers
       ===================================================================== */
    function announce(text) { el.live.textContent = ""; window.setTimeout(() => { el.live.textContent = text; }, 40); }
    function setGroupError(step, box, message) {
        box.textContent = message || "";
        step.classList.toggle("is-invalid", !!message);
        step.querySelectorAll("input[type=radio], input[type=hidden]").forEach((i) => { if (message) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid"); });
    }
    function reveal(name, { nudge = true } = {}) {
        const step = el.steps[name];
        if (!step) return;
        state.revealed.add(name);
        if (!step.hidden) return;
        step.hidden = false;
        if (!reduceMotion) { step.classList.add("is-entering"); window.setTimeout(() => step.classList.remove("is-entering"), 450); }
        if (nudge) nudgeIntoView(step);
        refreshLayout();
    }
    /** a newly opened step that sits below the fold is brought up a little - never a jump, never more than ~40% of the screen, focus untouched */
    function nudgeIntoView(step) {
        window.requestAnimationFrame(() => {
            const r = step.getBoundingClientRect();
            const vh = window.innerHeight;
            if (r.top < vh * 0.72) return;
            const delta = Math.min(r.top - vh * 0.45, vh * 0.42);
            window.scrollBy({ top: delta, behavior: reduceMotion ? "auto" : "smooth" });
        });
    }

    /* =====================================================================
       summary (the sticky card + the review block share one renderer; text only - nothing a guest types is ever parsed as HTML)
       ===================================================================== */
    function summaryValues() {
        const f = form.elements;
        const occ = f.occasion.options[f.occasion.selectedIndex];
        return {
            type: state.type === "recording" ? COPY.summary.typeRecording : COPY.summary.typeTable,
            date: state.date ? formatDate(state.date) : "",
            time: state.time ? (state.type === "recording" ? fill(COPY.availability.doors, { time: formatTime(state.time) }) : formatTime(state.time)) : "",
            party: state.party ? partyLabel(state.party, state.type) : "",
            name: f.name.value.trim(),
            email: f.email.value.trim(),
            phone: f.phone.value.trim(),
            occasion: f.occasion.value && f.occasion.value !== "none" && occ ? occ.textContent : "",
            notes: f.notes.value.trim()
        };
    }
    function renderSummary() {
        const v = summaryValues();
        document.querySelectorAll("#p-book-02-booking [data-sum]").forEach((node) => {
            const key = node.dataset.sum;
            if (key === "digest") { node.textContent = [v.date, v.time, v.party].filter(Boolean).join(" · "); return; }
            const text = v[key];
            node.textContent = text || (key === "name" || key === "email" || key === "phone" ? COPY.summary.emptyName : key === "occasion" || key === "notes" ? COPY.summary.none : COPY.summary.empty);
            node.classList.toggle("is-empty", !text);
        });
    }

    /* =====================================================================
       01 type
       ===================================================================== */
    function applyType(type, { initial = false } = {}) {
        state.type = type === "recording" ? "recording" : "table";
        const rec = state.type === "recording";
        form.elements.type.value = state.type;
        app.dataset.type = state.type;
        el.recordingNote.hidden = !rec;
        el.whenHelp.textContent = rec ? COPY.help.whenRecording : COPY.help.when;
        el.partyHelp.textContent = rec ? COPY.help.partyRecording : COPY.help.party;
        el.timeHelp.textContent = rec ? COPY.help.timeRecording : COPY.help.time;
        el.submit.textContent = rec ? COPY.buttons.confirmRecording : COPY.buttons.confirm;
        setGroupError(el.steps.type, $("bk-type-error"), "");

        /* party chips: 1-4 for a recording, 1-8 for a table; the last chip is "more than the limit" */
        const max = maxParty();
        form.querySelectorAll('input[name="party"]').forEach((input) => {
            if (input.value === "more") return;
            const over = Number(input.value) > max;
            input.disabled = over;
            input.closest(".radio-chip").hidden = over;
        });
        const more = form.querySelector('input[name="party"][value="more"]');
        more.closest(".radio-chip").querySelector("[data-more-label]").textContent = (max + 1) + "+";
        more.closest(".radio-chip").querySelector("[data-more-sr]").textContent = rec ? `More than ${max} seats` : `More than ${max} people`;
        el.partyNote.querySelector("[data-large-text]").textContent = rec ? COPY.large.recording : COPY.large.table;
        if (state.party && state.party > max) setParty(max, { silent: true });

        /* the chosen day may not exist for the new type (a Tuesday is not a recording night) */
        if (cal) {
            cal.refresh();
            if (state.date) {
                const problem = dateProblem(state.date);
                if (problem) { clearDate(); setGroupError(el.steps.when, el.dateError, COPY.availability.reasons[problem]); cal.show(today); }
            }
        }
        if (rec) loadNights(); else el.nights.hidden = true;
        if (!initial) { state.time = ""; if (state.date && !state.partyTooLarge) loadAvailability({ keep: false, fresh: true }); }
        renderSummary();
    }
    form.querySelectorAll('input[name="type"]').forEach((input) => input.addEventListener("change", () => { if (input.checked) applyType(input.value); }));

    /* =====================================================================
       02 day
       ===================================================================== */
    function clearDate() {
        state.date = ""; state.time = ""; state.availability = null;
        el.dateInput.value = "";
        el.dateOut.textContent = "";
        if (cal) cal.setValue("");
        el.slots.textContent = "";
        api.setNotice(el.timeNote, null);
        syncNights();
        renderSummary();
    }
    function setDate(iso, { focusCalendar = false } = {}) {
        state.date = iso;
        el.dateInput.value = iso;
        setGroupError(el.steps.when, el.dateError, "");
        el.dateOut.textContent = "";
        const label = document.createElement("span"); label.className = "book-picked__label"; label.textContent = "Selected day";
        const strong = document.createElement("strong"); strong.className = "book-picked__date"; strong.textContent = formatDate(iso);
        el.dateOut.append(label, strong);
        if (cal && cal.getValue() !== iso) cal.setValue(iso);
        if (focusCalendar && cal) cal.focus();
        syncNights();
        reveal("party", { nudge: false });
        if (!state.partyTooLarge) { reveal("time"); loadAvailability({ keep: true, fresh: true }); }
        renderSummary();
    }

    /* JS is here: the native date input becomes the hidden value holder and the calendar takes over */
    el.dateInput.type = "hidden";
    el.dateInput.removeAttribute("required");
    el.dateLabel.hidden = true;
    el.cal.hidden = false;
    cal = createCalendar(el.cal, {
        today, max: maxDate, value: "",
        describedBy: "bk-when-help bk-date-error",
        reasonFor,
        onSelect: (iso) => setDate(iso),
        onBlocked: (iso, reason) => setGroupError(el.steps.when, el.dateError, `${formatDate(iso)}: ${lowerFirst(COPY.availability.reasons[reason.code] || COPY.availability.reasons.closed)}`)
    });

    /* recording nights quick list (GET /api/events): same choice as the calendar, with the guest's name next to the date */
    async function loadNights() {
        el.nights.hidden = !el.nights.querySelector("li");
        if (nightsLoaded) { syncNights(); return; }
        nightsLoaded = true;
        try {
            const res = await api.get("/api/events");
            const list = el.nights.querySelector("ul");
            list.textContent = "";
            (res.events || []).filter((ev) => isISO(ev.date) && !dateProblemFor("recording", ev.date)).slice(0, 4).forEach((ev) => {
                const li = document.createElement("li");
                const btn = document.createElement("button");
                btn.type = "button"; btn.className = "book-night"; btn.dataset.date = ev.date; btn.setAttribute("aria-pressed", "false");
                const d = document.createElement("span"); d.className = "book-night__date"; d.textContent = formatDate(ev.date);
                const g = document.createElement("span"); g.className = "book-night__guest"; g.textContent = ev.guest ? `with ${ev.guest}` : (ev.title || "Thursday recording night");
                const s = document.createElement("span"); s.className = "book-night__seats";
                const left = Number(ev.seatsLeft);
                s.textContent = ev.bookable === false || left <= 0 ? COPY.availability.full : left <= 12 ? fill(COPY.availability.seatsLeft, { n: left }) : "";
                btn.append(d, g); if (s.textContent) btn.append(s);
                if (ev.bookable === false || left <= 0) { btn.setAttribute("aria-disabled", "true"); btn.classList.add("is-off"); }
                li.append(btn); list.append(li);
            });
            el.nights.hidden = state.type !== "recording" || !list.children.length;
            syncNights();
            refreshLayout();
        } catch (_) { el.nights.hidden = true; }
    }
    function dateProblemFor(type, iso) { const keep = state.type; state.type = type; const p = dateProblem(iso); state.type = keep; return p; }
    function syncNights() { el.nights.querySelectorAll(".book-night").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.date === state.date))); }
    el.nights.addEventListener("click", (e) => {
        const btn = e.target.closest(".book-night");
        if (!btn) return;
        if (btn.getAttribute("aria-disabled") === "true") { setGroupError(el.steps.when, el.dateError, COPY.availability.recordingFull); return; }
        setDate(btn.dataset.date);
    });

    /* =====================================================================
       03 party
       ===================================================================== */
    function setParty(n, { silent = false } = {}) {
        state.party = n; state.partyTooLarge = false;
        const input = form.querySelector(`input[name="party"][value="${n}"]`);
        if (input) input.checked = true;
        el.partyNote.hidden = true;
        setGroupError(el.steps.party, el.partyError, "");
        if (!silent) afterPartyChange();
    }
    function afterPartyChange() {
        if (state.partyTooLarge) {
            state.time = ""; el.steps.time.hidden = true;
        } else if (state.date) {
            el.steps.time.hidden = false; state.revealed.add("time");
            loadAvailability({ keep: true });
        }
        renderSummary();
        refreshLayout();
    }
    form.querySelectorAll('input[name="party"]').forEach((input) => input.addEventListener("change", () => {
        if (!input.checked) return;
        if (input.value === "more") {
            state.party = null; state.partyTooLarge = true;
            el.partyNote.hidden = false;
            setGroupError(el.steps.party, el.partyError, "");
            afterPartyChange();
        } else setParty(Number(input.value));
    }));

    /* =====================================================================
       04 time - GET /api/availability
       ===================================================================== */
    function skeleton() {
        const wrap = document.createElement("div");
        wrap.className = "book-skeleton";
        wrap.setAttribute("aria-hidden", "true");
        const n = state.type === "recording" ? 1 : 12;
        for (let i = 0; i < n; i++) { const s = document.createElement("span"); s.className = "book-skeleton__chip"; wrap.append(s); }
        return wrap;
    }
    function callLink() { const a = document.createElement("a"); a.href = COPY.contact.tel; a.textContent = COPY.contact.phone; return a; }
    function noteNode(text, withCall) {
        const p = document.createElement("span");
        p.append(document.createTextNode(text));
        if (withCall) { p.append(document.createTextNode(" ")); p.append(callLink()); }
        return p;
    }

    async function loadAvailability({ keep = true, fresh = false } = {}) {
        if (!state.date || !state.party) return;
        if (availCtrl) availCtrl.abort();
        availCtrl = new AbortController();
        const seq = ++availSeq;
        const wanted = keep ? state.time : "";
        el.slots.setAttribute("aria-busy", "true");
        el.slots.classList.add("is-loading");
        if (fresh || !el.slots.querySelector(".radio-chip")) { el.slots.textContent = ""; el.slots.append(skeleton()); api.setNotice(el.timeNote, null); }
        el.live.textContent = COPY.availability.loading;

        let res = null, failure = null;
        try { res = await api.get("/api/availability", { date: state.date, party: state.party, type: state.type }, { signal: availCtrl.signal }); }
        catch (err) { failure = err; }
        if (seq !== availSeq) return;                   // a newer request owns the screen
        el.slots.removeAttribute("aria-busy");
        el.slots.classList.remove("is-loading");

        if (failure) {
            if (failure.code === "aborted") return;
            state.availability = null;
            el.slots.textContent = "";
            const node = document.createElement("span");
            const fieldMsg = failure.fields && (failure.fields.date || failure.fields.party);
            node.append(document.createTextNode((fieldMsg || (isUnavailable(failure) ? (failure.code === "network" ? COPY.errors.network : COPY.errors.unavailable) : failure.code === "rate_limited" ? COPY.errors.rate_limited : failure.message || COPY.errors.server_error)) + " "));
            if (!fieldMsg) {
                const retry = document.createElement("button");
                retry.type = "button"; retry.className = "button--link book-retry"; retry.textContent = "Try again";
                retry.addEventListener("click", () => loadAvailability({ keep: true, fresh: true }));
                node.append(retry);
            }
            api.setNotice(el.timeNote, "error", node);
            refreshLayout();
            return;
        }

        state.availability = res;
        renderSlots(res, wanted);
        refreshLayout();
    }

    function groupOf(time) { const m = minutes(time); return m < 12 * 60 ? "morning" : m < 17 * 60 ? "afternoon" : "evening"; }

    function renderSlots(res, wanted) {
        el.slots.textContent = "";
        api.setNotice(el.timeNote, null);
        const slots = Array.isArray(res.slots) ? res.slots : [];
        const rec = state.type === "recording";

        /* the day is not bookable at all: say why, in the API's words (its `reason`), falling back to the page copy for that reasonCode */
        if (res.open === false) {
            state.time = "";
            const text = res.reason || COPY.availability.reasons[res.reasonCode] || COPY.availability.closed;
            api.setNotice(el.timeNote, "info", noteNode(text, res.reasonCode === "blocked"));
            announce(text);
            renderSummary();
            return;
        }

        const stillThere = wanted && slots.some((s) => s.time === wanted && s.available);
        let chosen = stillThere ? wanted : "";

        if (rec) {
            const slot = slots[0];
            const list = document.createElement("div");
            list.className = "radio-chips__list book-slotlist book-slotlist--doors";
            if (slot) {
                if (slot.available && !chosen) chosen = slot.time;               // one choice = chosen for them
                list.append(slotChip(slot, chosen, { doors: true }));
            }
            el.slots.append(list);
            if (slot && !slot.available) api.setNotice(el.timeNote, "info", noteNode(slot.reason === "full" ? COPY.availability.recordingFull : (res.reason || COPY.availability.reasons.too_late_today), slot.reason !== "full"));
        } else {
            const groups = { morning: [], afternoon: [], evening: [] };
            slots.forEach((s) => groups[groupOf(s.time)].push(s));
            Object.keys(groups).forEach((key) => {
                const items = groups[key];
                if (!items.length) return;
                const group = document.createElement("div");
                group.className = "book-slotgroup";
                group.setAttribute("role", "group");
                const title = document.createElement("p");
                title.className = "book-slotgroup__title"; title.id = "bk-slots-" + key; title.textContent = COPY.availability.groups[key];
                group.setAttribute("aria-labelledby", title.id);
                group.append(title);
                if (items.every((s) => !s.available && s.reason === "past")) {   // a whole part of today that has gone: one line instead of a wall of dead chips
                    const gone = document.createElement("p");
                    gone.className = "book-slotgroup__gone"; gone.textContent = COPY.availability.groupPast;
                    group.append(gone);
                } else {
                    const list = document.createElement("div");
                    list.className = "radio-chips__list book-slotlist";
                    items.forEach((s) => list.append(slotChip(s, chosen, {})));
                    group.append(list);
                }
                el.slots.append(group);
            });
            if (res.reasonCode === "full" || res.reasonCode === "too_late_today") {
                api.setNotice(el.timeNote, "info", noteNode(res.reason || COPY.availability.reasons[res.reasonCode], true));
            } else if (!slots.length) api.setNotice(el.timeNote, "info", noteNode(COPY.availability.noSlots, true));
        }

        /* the slot they had picked is gone: clear it and say so, next to the times */
        if (wanted && !stillThere && !(rec && chosen)) {
            state.time = "";
            setGroupError(el.steps.time, el.timeError, COPY.validation.time.unavailable);
        } else {
            setGroupError(el.steps.time, el.timeError, "");
        }
        state.time = chosen;
        if (chosen) reveal("details", { nudge: false });
        const open = slots.filter((s) => s.available).length;
        announce(rec
            ? (open ? `${fill(COPY.availability.doors, { time: formatTime(slots[0].time) })}. ${fill(COPY.availability.seatsLeft, { n: slots[0].seatsLeft })}.` : COPY.availability.recordingFull)
            : `${open} ${open === 1 ? "time" : "times"} available on ${formatDate(state.date)}.`);
        renderSummary();
    }

    function slotChip(slot, chosen, { doors = false } = {}) {
        const label = document.createElement("label");
        label.className = "radio-chip book-slot" + (doors ? " book-slot--doors" : "");
        const input = document.createElement("input");
        input.type = "radio"; input.name = "time"; input.value = slot.time;
        input.setAttribute("aria-describedby", "bk-time-help");
        input.checked = slot.time === chosen && slot.available;
        input.disabled = !slot.available;
        const span = document.createElement("span");
        span.append(document.createTextNode(doors ? fill(COPY.availability.doors, { time: formatTime(slot.time) }) : formatTime(slot.time)));
        const small = document.createElement("small");
        const left = Number(slot.seatsLeft);
        if (!slot.available) small.textContent = slot.reason === "past" ? COPY.availability.past : COPY.availability.full;
        else if (doors || left <= LOW_SEATS) small.textContent = left === 1 ? COPY.availability.seatLeft : fill(COPY.availability.seatsLeft, { n: left });
        if (small.textContent) span.append(small);
        label.append(input, span);
        return label;
    }

    el.slots.addEventListener("change", (e) => {
        const input = e.target.closest('input[name="time"]');
        if (!input || !input.checked) return;
        state.time = input.value;
        setGroupError(el.steps.time, el.timeError, "");
        api.setNotice(el.status, null);
        reveal("details");
        renderSummary();
    });

    /* =====================================================================
       05 details
       ===================================================================== */
    function validateDetails() {
        const f = form.elements, V = COPY.validation, out = {};
        const name = f.name.value.trim(), email = f.email.value.trim(), phone = f.phone.value.trim(), notes = f.notes.value;
        if (!name) out.name = V.name.required; else if (name.length < 2) out.name = V.name.invalid; else if (name.length > 80) out.name = V.name.tooLong;
        if (!email) out.email = V.email.required; else if (!EMAIL_RE.test(email) || email.length > 254) out.email = V.email.invalid;
        const digits = phone.replace(/\D/g, "").length;
        if (!phone) out.phone = V.phone.required; else if (!/^[0-9+() .\-\s]{7,20}$/.test(phone) || digits < 7 || digits > 15) out.phone = V.phone.invalid;
        if (notes.length > 500) out.notes = V.notes.tooLong;
        if (!f.consent.checked) out.consent = V.consent.required;
        return out;
    }
    function validateChoice() {
        const V = COPY.validation, out = {};
        if (state.type !== "table" && state.type !== "recording") out.type = V.type.required;
        if (!state.date) out.date = V.date.required; else { const p = dateProblem(state.date); if (p) out.date = COPY.availability.reasons[p]; }
        if (state.partyTooLarge) out.party = state.type === "recording" ? V.party.maxRecording : V.party.max; else if (!state.party) out.party = V.party.required;
        if (!out.date && !out.party && !state.time) out.time = V.time.required;
        return out;
    }

    /** put messages next to their controls (shell helper) and move focus to the first invalid control in page order */
    function showErrors(fields) {
        const order = ["type", "date", "party", "time", "name", "email", "phone", "occasion", "notes", "consent"];
        const sorted = {};
        order.forEach((k) => { if (fields[k]) sorted[k] = fields[k]; });
        Object.keys(fields).forEach((k) => { if (!(k in sorted) && k !== "website") sorted[k] = fields[k]; });
        const placed = api.showFieldErrors(form, sorted);
        if (sorted.time && !form.querySelector('input[name="time"]')) setGroupError(el.steps.time, el.timeError, sorted.time);
        const first = Object.keys(sorted)[0];
        if (!first) return placed;
        const stepFor = { type: "type", date: "when", party: "party", time: "time" }[first] || "details";
        if (el.steps[stepFor].hidden && !(stepFor === "time" && state.partyTooLarge)) reveal(stepFor, { nudge: false });
        if (first === "date") cal.focus();
        else if (first === "time") { const t = form.querySelector('input[name="time"]:checked:not(:disabled), input[name="time"]:not(:disabled)'); if (t) t.focus(); else el.steps.time.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" }); }
        else if (first === "party" || first === "type") { const r = form.querySelector(`input[name="${first}"]:checked`) || form.querySelector(`input[name="${first}"]:not(:disabled)`); if (r) r.focus(); }
        return placed || 1;
    }

    ["name", "email", "phone", "occasion", "notes"].forEach((name) => {
        const input = form.elements[name];
        input.addEventListener("input", () => { if (input.getAttribute("aria-invalid")) api.clearFieldErrors(form, name); renderSummary(); });
        input.addEventListener("change", renderSummary);
    });
    form.elements.consent.addEventListener("change", () => api.clearFieldErrors(form, "consent"));
    /* validate a text field when it is left (only once something was typed - never nag an untouched field) */
    ["name", "email", "phone"].forEach((name) => {
        const input = form.elements[name];
        input.addEventListener("blur", () => { if (!input.value.trim()) return; const errs = validateDetails(); if (errs[name]) softError(name, errs[name]); });
    });
    function softError(name, message) {                 // the same marks as api.showFieldErrors, but focus is never touched (a blur handler must not pull people back)
        const input = form.elements[name];
        const field = input.closest(".field");
        const box = field && field.querySelector(".field__error");
        if (!box) return;
        box.textContent = message;
        field.classList.add("is-invalid");
        input.setAttribute("aria-invalid", "true");
    }

    function updateCount() {
        const n = el.notes.value.length, left = 500 - n;
        el.notesCount.querySelector("[data-count]").textContent = String(n);
        el.notesCount.classList.toggle("is-near", left <= 50);
        announceCount(left);
    }
    const announceCount = debounce((left) => { el.notesLive.textContent = left <= 50 ? `${left} characters left` : ""; }, 700);
    el.notes.addEventListener("input", updateCount);

    el.reviewBtn.addEventListener("click", () => {
        api.clearFieldErrors(form);
        const errs = Object.assign(validateChoice(), validateDetails());
        if (Object.keys(errs).length) { showErrors(errs); return; }
        el.reviewActions.hidden = true;
        reveal("confirm", { nudge: false });
        renderSummary();
        el.confirmTitle.focus({ preventScroll: true });
        el.steps.confirm.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    });

    /* review block: a collapsible bar on phones (the toggle is display:none from 60em, where the panel is always open) */
    el.reviewToggle.addEventListener("click", () => {
        const open = el.reviewToggle.getAttribute("aria-expanded") !== "true";
        el.reviewToggle.setAttribute("aria-expanded", String(open));
        el.reviewPanel.hidden = !open;
        refreshLayout();
    });
    form.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-edit]");
        if (!btn) return;
        const key = btn.dataset.edit;
        if (key === "when") cal.focus();
        else if (key === "type" || key === "party" || key === "time") { const r = form.querySelector(`input[name="${key}"]:checked`) || form.querySelector(`input[name="${key}"]:not(:disabled)`); if (r) r.focus(); }
        else if (form.elements[key]) form.elements[key].focus();
    });

    /* =====================================================================
       06 confirm - POST /api/bookings
       ===================================================================== */
    function duplicateNode() {
        const node = document.createElement("span");
        node.append(document.createTextNode(COPY.errors.duplicate + " "));
        const a = document.createElement("a");
        a.href = "#manage"; a.textContent = COPY.errors.duplicateLink; a.dataset.manageLink = "1";
        node.append(a);
        return node;
    }
    el.status.addEventListener("click", (e) => {
        if (!e.target.closest("[data-manage-link]")) return;
        manage.prefill({ email: form.elements.email.value.trim() }, { focus: false });      // the hash jump scrolls; the email is already filled in
        window.setTimeout(() => { const r = $("mg-reference"); if (r) r.focus({ preventScroll: true }); }, 50);
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (el.submit.disabled) return;
        api.clearFieldErrors(form);
        setGroupError(el.steps.time, el.timeError, "");
        api.setNotice(el.status, null);
        const errs = Object.assign(validateChoice(), validateDetails());
        if (Object.keys(errs).length) { showErrors(errs); api.setNotice(el.status, "error", COPY.errors.validation); return; }

        const f = form.elements;
        const body = {
            type: state.type, date: state.date, time: state.time, party: state.party,
            name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(),
            occasion: f.occasion.value || "none", notes: f.notes.value.trim(),
            marketingOptIn: !!f.marketingOptIn.checked, consent: !!f.consent.checked, website: f.website.value
        };
        api.setBusy(el.submit, true);
        el.submit.textContent = COPY.buttons.sending;
        try {
            const res = await api.post("/api/bookings", body);
            const booking = Object.assign({}, body, res.booking || {}, { reference: res.reference || (res.booking && res.booking.reference), status: res.status || (res.booking && res.booking.status) || "confirmed" });
            store(booking);
            showDone(booking, { focus: true, announceIt: true });
            resetForm();
        } catch (err) {
            handleSubmitError(err);
        } finally {
            api.setBusy(el.submit, false);
            el.submit.textContent = state.type === "recording" ? COPY.buttons.confirmRecording : COPY.buttons.confirm;
        }
    });

    function handleSubmitError(err) {
        if (err.code === "slot_full") {                 // someone was faster: keep everything they typed, refresh the times, let them pick again
            const wasTime = state.time;
            api.setNotice(el.status, "error", state.type === "recording" ? COPY.errors.slot_full_recording : COPY.errors.slot_full);
            state.time = wasTime;
            loadAvailability({ keep: true }).then(() => {
                if (!state.time) { setGroupError(el.steps.time, el.timeError, COPY.validation.time.unavailable); const t = form.querySelector('input[name="time"]:not(:disabled)'); if (t) t.focus(); else el.steps.time.scrollIntoView({ block: "center" }); }
            });
            return;
        }
        if (err.code === "duplicate") { api.setNotice(el.status, "error", duplicateNode()); el.status.setAttribute("tabindex", "-1"); el.status.focus(); return; }
        if (err.code === "validation" && err.fields && Object.keys(err.fields).length) {
            const placed = showErrors(err.fields);
            api.setNotice(el.status, "error", placed ? COPY.errors.validation : (err.message || COPY.errors.validation));
            if (err.fields.time || err.fields.date) loadAvailability({ keep: true });
            return;
        }
        let text;
        if (err.code === "rate_limited") text = COPY.errors.rate_limited;
        else if (isUnavailable(err)) text = err.code === "network" ? COPY.errors.network : COPY.errors.unavailable;
        else if (err.code === "validation") text = err.message || COPY.errors.validation;
        else text = COPY.errors.server_error;
        api.setNotice(el.status, "error", withPhoneLink(text));
        el.status.setAttribute("tabindex", "-1");
        el.status.focus();
    }

    /* =====================================================================
       07 confirmation
       ===================================================================== */
    function store(b) {
        try {
            window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ savedAt: Date.now(), booking: { reference: b.reference, type: b.type, date: b.date, time: b.time, party: b.party, status: b.status, name: b.name, email: b.email } }));
        } catch (_) { /* private mode: the card still shows, it just will not survive a refresh */ }
    }
    function readStored() {
        try {
            const raw = window.sessionStorage.getItem(STORE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            const b = data && data.booking;
            return b && /^LWL-/.test(b.reference || "") && isISO(b.date) ? b : null;
        } catch (_) { return null; }
    }
    function clearStored() { try { window.sessionStorage.removeItem(STORE_KEY); } catch (_) { /* nothing to clear */ } }

    function showDone(b, { focus = false, announceIt = false } = {}) {
        doneBooking = b;
        const rec = b.type === "recording";
        const pending = b.status === "pending";
        const tokens = { reference: b.reference, date: formatDate(b.date), time: formatTime(b.time), party: partyLabel(b.party, b.type) };   // {party} = counted label ("1 seat", "2 people"), as in the manage copy
        const q = (sel) => el.done.querySelector(sel);
        q("[data-done-eyebrow]").textContent = pending ? COPY.success.eyebrowPending : COPY.success.eyebrow;
        q("[data-done-title]").textContent = rec ? COPY.success.titleRecording : COPY.success.title;
        q("[data-done-text]").textContent = fill(pending ? COPY.success.pending : rec ? COPY.success.textRecording : COPY.success.text, tokens);
        q("[data-done-ref]").textContent = b.reference;
        q('[data-done="type"]').textContent = rec ? COPY.summary.typeRecording : COPY.summary.typeTable;
        q('[data-done="date"]').textContent = formatDate(b.date);
        q('[data-done="time"]').textContent = formatTime(b.time);
        q("[data-done-time-label]").textContent = rec ? COPY.summary.doors : COPY.summary.time;
        q('[data-done="party"]').textContent = partyLabel(b.party, b.type);
        q('[data-done="name"]').textContent = b.name || "";
        q('[data-done="status"]').textContent = COPY.manage.statuses[b.status] || b.status;
        const hold = q("[data-done-hold]");
        hold.textContent = rec ? COPY.success.holdRecording : COPY.success.hold;
        hold.append(callLink(), document.createTextNode("."));
        form.hidden = true;
        el.aside.hidden = true;
        app.classList.add("is-done");
        el.done.hidden = false;
        if (focus) { el.done.focus({ preventScroll: true }); el.done.scrollIntoView({ block: "start", behavior: "auto" }); }   /* the tall form just collapsed: an animated scroll would chase a moving target */
        if (announceIt) announce(fill(COPY.success.announce, tokens));
        refreshLayout();
    }
    function showForm({ focus = true } = {}) {
        doneBooking = null;
        el.done.hidden = true;
        form.hidden = false;
        el.aside.hidden = false;
        app.classList.remove("is-done");
        if (focus) { const r = form.querySelector('input[name="type"]:checked'); if (r) r.focus({ preventScroll: true }); $("booking").scrollIntoView({ block: "start", behavior: "auto" }); }
        refreshLayout();
    }
    function resetForm() {
        form.reset();
        api.clearFieldErrors(form);
        api.setNotice(el.status, null);
        ["party", "time", "details", "confirm"].forEach((k) => { el.steps[k].hidden = true; state.revealed.delete(k); });
        el.reviewActions.hidden = false;
        state.party = 2; state.partyTooLarge = false; el.partyNote.hidden = true;
        clearDate();
        cal.show(today);
        updateCount();
        applyType("table", { initial: true });
    }

    $("bk-done-copy").addEventListener("click", async () => {
        if (!doneBooking) return;
        const btn = $("bk-done-copy"), label = btn.querySelector("[data-copy-label]"), status = $("bk-done-copied");
        const ok = await copyText(doneBooking.reference, $("bk-done-ref-code"));
        status.textContent = "";
        window.setTimeout(() => { status.textContent = ok ? fill(COPY.success.copied, { reference: doneBooking ? doneBooking.reference : "" }) : COPY.success.copyFailed; }, 40);
        if (ok) { label.textContent = COPY.buttons.copied; btn.classList.add("is-copied"); window.setTimeout(() => { label.textContent = COPY.buttons.copy; btn.classList.remove("is-copied"); }, 2200); }
    });
    $("bk-done-ics").addEventListener("click", () => { if (doneBooking) downloadICS(doneBooking, icsOptions()); });
    /** a table = one sitting (turnMinutes); a recording night runs from doors to the end of the recording (8:15 pm), whatever the sitting length is */
    function icsOptions() {
        return { minutes: Number(config.turnMinutes) || 90, recordingEnd: COPY.cafe.recordingEnd, address: addressLines(config), phone: (config.contact && config.contact.phone) || COPY.contact.phone };
    }
    $("bk-done-manage").addEventListener("click", () => {
        if (!doneBooking) return;
        manage.prefill({ reference: doneBooking.reference, email: doneBooking.email }, { lookup: true, focus: true });   // the #manage hash jump does the scrolling
    });
    $("bk-done-again").addEventListener("click", () => { clearStored(); showForm({ focus: true }); });

    /* =====================================================================
       start: URL parameters (events page: book.html?type=recording&date=YYYY-MM-DD), a stored confirmation, first paint
       ===================================================================== */
    const params = new URLSearchParams(window.location.search);
    const wantType = params.get("type") === "recording" ? "recording" : "table";
    const wantDate = params.get("date") || "";
    applyType(wantType, { initial: true });
    updateCount();
    renderSummary();
    if (wantDate) {
        const problem = dateProblem(wantDate);
        if (!problem) setDate(wantDate);
        else { setGroupError(el.steps.when, el.dateError, COPY.availability.reasons[problem]); if (isISO(wantDate)) cal.show(wantDate); }
    }
    const stored = readStored();
    if (stored) showDone(stored, { focus: false });
    else if ((params.has("type") || params.has("date")) && !window.location.hash) {
        window.requestAnimationFrame(() => $("booking").scrollIntoView({ block: "start", behavior: "auto" }));   // they came to book something specific: land on the form
    }
    if (window.location.hash === "#manage" && stored) manage.prefill({ reference: stored.reference, email: stored.email }, { focus: false });

    return { status: "ready", state, buildICS, icsOptions, calendar: cal, reload: () => loadAvailability({ keep: true }) };
}

/* ---- helpers ---- */
function debounce(fn, ms) { let t = 0; return (...args) => { window.clearTimeout(t); t = window.setTimeout(() => fn(...args), ms); }; }
function lowerFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function addressLines(config) {
    const a = config && config.contact && config.contact.address;
    return a ? [a.line1, a.line2, a.city].filter(Boolean) : COPY.cafe.address;
}
/** navigator.clipboard where it exists (secure contexts), otherwise the selection + execCommand route */
async function copyText(text, sourceEl) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (_) { /* fall through */ }
    try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select(); ta.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        ta.remove();
        if (ok) return true;
    } catch (_) { /* fall through */ }
    try { const range = document.createRange(); range.selectNodeContents(sourceEl); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); } catch (_) { /* nothing else to try */ }
    return false;
}
