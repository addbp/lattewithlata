/* ==========================================================================
   Latte with Lata - js/pages/book/calendar.js (PAGE book lane)
   An inline, accessible month-grid date picker (WAI-ARIA APG "date picker grid" keyboard model), brand styled by css/pages/book.css.

     const cal = createCalendar(rootEl, {
         today: "2026-09-17", max: "2026-11-16",          // inclusive ISO bounds (the server's "today" + leadDays)
         value: "",                                        // preselected ISO date
         reasonFor: (iso) => null | { code, label },       // null = bookable; otherwise why it is not (label is spoken + shown on click)
         onSelect: (iso) => {}, onBlocked: (iso, reason) => {},
         describedBy: "id id"                              // hint / error ids for the grid
     });
     cal.setValue(iso | "")   cal.refresh()   cal.show(iso)   cal.focus()   cal.getValue()

   Keyboard (focus is on one day at a time - roving tabindex):
     Arrow keys  +-1 day / +-7 days          Home / End        first / last day of the week (Monday .. Sunday)
     PageUp / PageDown  previous / next month (Shift = year)   Enter / Space   choose the focused day
   Days that cannot be booked stay focusable (aria-disabled="true" + the reason in the accessible name), so a screen-reader user can find
   out WHY a day is greyed out; they just cannot be chosen. Focus never leaves [today, max]. All date maths is UTC-based string maths
   (no time-zone drift); "today" comes from the server (GET /api/config), not the visitor's clock.
   ========================================================================== */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad = (n) => String(n).padStart(2, "0");
export const isISO = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return false;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
const toDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toISO = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
export const addDays = (iso, n) => { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return toISO(d); };
/** 0 = Sunday .. 6 = Saturday (the server's weekday numbering) */
export const weekday = (iso) => toDate(iso).getUTCDay();
const mondayIndex = (iso) => (weekday(iso) + 6) % 7;                 // 0 = Monday .. 6 = Sunday
const monthKey = (iso) => iso.slice(0, 7);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m = 1..12
/** same day number in another month, clamped to that month's length */
function addMonths(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1 + n, 1));
    const ty = first.getUTCFullYear(), tm = first.getUTCMonth() + 1;
    return `${ty}-${pad(tm)}-${pad(Math.min(d, daysInMonth(ty, tm)))}`;
}
const clamp = (iso, min, max) => (iso < min ? min : iso > max ? max : iso);
export const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${DAYS_LONG[mondayIndex(iso)]} ${d} ${MONTHS[m - 1]} ${y}`; };

const CHEVRON_LEFT = '<svg class="icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>';
const CHEVRON_RIGHT = '<svg class="icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';

export function createCalendar(root, options) {
    const opts = Object.assign({ today: "", max: "", value: "", reasonFor: () => null, onSelect() {}, onBlocked() {}, describedBy: "" }, options || {});
    const uid = root.id || "cal";
    let value = isISO(opts.value) ? opts.value : "";
    let focusISO = "";                                  // the day that owns tabindex="0"
    let view = "";                                      // "YYYY-MM" on screen

    root.classList.add("cal");
    root.setAttribute("role", "group");
    root.setAttribute("aria-labelledby", uid + "-title");
    root.innerHTML =
        `<div class="cal__head">
            <button type="button" class="cal__nav" data-cal="prev" aria-label="Previous month">${CHEVRON_LEFT}</button>
            <p class="cal__title" id="${uid}-title" aria-live="polite" aria-atomic="true"></p>
            <button type="button" class="cal__nav" data-cal="next" aria-label="Next month">${CHEVRON_RIGHT}</button>
        </div>
        <table class="cal__grid" role="grid" aria-labelledby="${uid}-title"${opts.describedBy ? ` aria-describedby="${opts.describedBy}"` : ""}>
            <thead><tr>${DAYS_SHORT.map((d, i) => `<th scope="col" abbr="${DAYS_LONG[i]}"><span aria-hidden="true">${d}</span><span class="a11y-only">${DAYS_LONG[i]}</span></th>`).join("")}</tr></thead>
            <tbody></tbody>
        </table>
        <p class="cal__legend" aria-hidden="true"><span class="cal__key cal__key--today">Today</span><span class="cal__key cal__key--on">Selected</span><span class="cal__key cal__key--off">Not available</span></p>
        <p class="a11y-only" id="${uid}-keys">Use the arrow keys to move between days, Page Up and Page Down to change month, Home and End for the start and end of the week, Enter to choose.</p>`;

    const titleEl = root.querySelector(".cal__title");
    const body = root.querySelector("tbody");
    const grid = root.querySelector(".cal__grid");
    const prevBtn = root.querySelector('[data-cal="prev"]');
    const nextBtn = root.querySelector('[data-cal="next"]');
    grid.setAttribute("aria-describedby", ((opts.describedBy ? opts.describedBy + " " : "") + uid + "-keys").trim());

    const minMonth = () => monthKey(opts.today);
    const maxMonth = () => monthKey(opts.max);

    /** the day that should be tabbable when the view changes: the chosen day, else the first bookable day on screen, else the first in-range day */
    function defaultFocus(month) {
        if (value && monthKey(value) === month) return value;
        const [y, m] = month.split("-").map(Number);
        let firstInRange = "";
        for (let d = 1; d <= daysInMonth(y, m); d++) {
            const iso = `${month}-${pad(d)}`;
            if (iso < opts.today || iso > opts.max) continue;
            if (!firstInRange) firstInRange = iso;
            if (!opts.reasonFor(iso)) return iso;
        }
        return firstInRange || clamp(`${month}-01`, opts.today, opts.max);
    }

    function render() {
        const [y, m] = view.split("-").map(Number);
        titleEl.textContent = `${MONTHS[m - 1]} ${y}`;
        const atMin = view <= minMonth(), atMax = view >= maxMonth();
        prevBtn.setAttribute("aria-disabled", String(atMin));
        nextBtn.setAttribute("aria-disabled", String(atMax));
        if (!focusISO || monthKey(focusISO) !== view) focusISO = defaultFocus(view);

        const lead = mondayIndex(`${view}-01`);
        const total = daysInMonth(y, m);
        const cells = [];
        for (let i = 0; i < lead; i++) cells.push('<td class="cal__cell cal__cell--blank" role="gridcell" aria-hidden="true"></td>');
        for (let d = 1; d <= total; d++) {
            const iso = `${view}-${pad(d)}`;
            const out = iso < opts.today || iso > opts.max;
            const reason = out ? { code: iso < opts.today ? "past" : "too_far", label: iso < opts.today ? "in the past" : "too far ahead" } : opts.reasonFor(iso);
            const isToday = iso === opts.today, isOn = iso === value;
            const name = longDate(iso) + (isToday ? ", today" : "") + (reason ? ", not available: " + reason.label : "");
            const cls = "cal__day" + (isToday ? " is-today" : "") + (isOn ? " is-selected" : "") + (reason ? " is-off" : "");
            cells.push(
                `<td class="cal__cell" role="gridcell"${isOn ? ' aria-selected="true"' : ""}>` +
                `<button type="button" class="${cls}" data-date="${iso}" tabindex="${iso === focusISO ? "0" : "-1"}" aria-label="${name}"` +
                `${reason ? ' aria-disabled="true"' : ""}${isToday ? ' aria-current="date"' : ""}${isOn ? ' aria-pressed="true"' : ""}><span aria-hidden="true">${d}</span></button></td>`
            );
        }
        while (cells.length % 7) cells.push('<td class="cal__cell cal__cell--blank" role="gridcell" aria-hidden="true"></td>');
        const rows = [];
        for (let i = 0; i < cells.length; i += 7) rows.push("<tr>" + cells.slice(i, i + 7).join("") + "</tr>");
        body.innerHTML = rows.join("");
    }

    function show(iso, { focus = false } = {}) {
        const target = clamp(isISO(iso) ? iso : opts.today, opts.today, opts.max);
        view = monthKey(target);
        focusISO = target;
        render();
        if (focus) focusDay();
    }
    function focusDay() {
        const btn = body.querySelector(`[data-date="${focusISO}"]`);
        if (btn) btn.focus({ preventScroll: false });
    }
    function moveFocus(iso) {
        const target = clamp(iso, opts.today, opts.max);
        if (monthKey(target) !== view) { view = monthKey(target); focusISO = target; render(); }
        else {
            const old = body.querySelector('[tabindex="0"]');
            if (old) old.setAttribute("tabindex", "-1");
            focusISO = target;
            const next = body.querySelector(`[data-date="${target}"]`);
            if (next) next.setAttribute("tabindex", "0");
        }
        focusDay();
    }
    function changeMonth(step, keepFocus) {
        const next = monthKey(addMonths(`${view}-01`, step));
        if (next < minMonth() || next > maxMonth()) return;
        view = next;
        focusISO = "";
        render();
        if (keepFocus) focusDay();
    }
    function choose(iso, viaKeyboard) {
        const reason = iso < opts.today || iso > opts.max ? { code: iso < opts.today ? "past" : "too_far" } : opts.reasonFor(iso);
        focusISO = iso;
        if (reason) { moveFocusSilently(iso); opts.onBlocked(iso, reason); return; }
        value = iso;
        render();
        if (viaKeyboard !== false) focusDay();
        opts.onSelect(iso);
    }
    function moveFocusSilently(iso) {
        const old = body.querySelector('[tabindex="0"]');
        if (old) old.setAttribute("tabindex", "-1");
        const next = body.querySelector(`[data-date="${iso}"]`);
        if (next) next.setAttribute("tabindex", "0");
    }

    body.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-date]");
        if (!btn) return;
        choose(btn.dataset.date);
    });
    prevBtn.addEventListener("click", () => { if (prevBtn.getAttribute("aria-disabled") !== "true") changeMonth(-1, false); });
    nextBtn.addEventListener("click", () => { if (nextBtn.getAttribute("aria-disabled") !== "true") changeMonth(1, false); });

    grid.addEventListener("keydown", (e) => {
        const btn = e.target.closest("[data-date]");
        if (!btn) return;
        const iso = btn.dataset.date;
        let target = "";
        switch (e.key) {
            case "ArrowLeft": target = addDays(iso, -1); break;
            case "ArrowRight": target = addDays(iso, 1); break;
            case "ArrowUp": target = addDays(iso, -7); break;
            case "ArrowDown": target = addDays(iso, 7); break;
            case "Home": target = addDays(iso, -mondayIndex(iso)); break;
            case "End": target = addDays(iso, 6 - mondayIndex(iso)); break;
            case "PageUp": target = addMonths(iso, e.shiftKey ? -12 : -1); break;
            case "PageDown": target = addMonths(iso, e.shiftKey ? 12 : 1); break;
            default: return;
        }
        e.preventDefault();
        moveFocus(target);
    });

    show(value || opts.today);

    return {
        getValue: () => value,
        /** set (or clear with "") the chosen day without firing onSelect */
        setValue(iso) { value = isISO(iso) ? iso : ""; if (value) { view = monthKey(clamp(value, opts.today, opts.max)); focusISO = value; } render(); },
        /** re-evaluate reasonFor() for every day (the booking type or the settings changed) */
        refresh() { focusISO = value && monthKey(value) === view ? value : ""; render(); },
        show,
        focus() { if (value && monthKey(value) !== view) show(value); focusDay(); },
        setBounds(today, max) { opts.today = today; opts.max = max; show(value || today); },
        get view() { return view; }
    };
}

export default createCalendar;
