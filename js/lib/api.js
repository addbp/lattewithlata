/* ==========================================================================
   Latte with Lata - js/lib/api.js (SHELL lane, PAGES-SPEC 2 + 4)
   The one fetch client every form uses (newsletter, booking, events, contact, admin). Zero dependencies, ES module.

     import api, { apiAvailable, formatDate, formatTime } from "./lib/api.js";      // from js/*.js
     import api from "../lib/api.js";                                               // from js/pages/*.js, js/sections/*.js, js/admin/*.js
     ctx.api === api                                                                // js/main.js and js/page.js put it on the ctx

     await api.get("/api/config")                         -> parsed JSON body
     await api.get("/api/availability", { date, party })  -> query object is URL-encoded (undefined / null / "" values are dropped)
     await api.post("/api/bookings", body)                -> parsed JSON body; the HTTP status rides on the result as a non-enumerable `$status`
     api.patch(path, body) / api.put(path, body) / api.del(path)
     await apiAvailable()                                 -> true | false   (cached GET /api/health, 2 s timeout; never throws)

   Every request: JSON in / JSON out, `X-Requested-With: fetch` (the server refuses public POSTs without it), `credentials: "same-origin"`
   (the admin cookie session), `Accept: application/json`. Paths are same-origin; "bookings" is shorthand for "/api/bookings".

   Errors: every failure rejects with an ApiError (extends Error):
     err.status  HTTP status (0 = the request never got an answer)
     err.code    the spec's `error` string ("validation", "slot_full", "duplicate", "rate_limited", "unauthorized", ...), or one of the
                 client-side codes: "network" (offline / refused), "timeout", "unavailable" (no API behind this host: a static server answered
                 404 / 405 / 501 or something that is not JSON), "http_<status>" (an error status without the spec's JSON shape)
     err.fields  { "<input name>": "<message>" }  (always an object, {} when the server sent none)
     err.message the server's human message, or a plain fallback sentence
   `isUnavailable(err)` is true for network / timeout / unavailable - the "static hosting" branch where a form must show its call-or-email
   notice instead of pretending to work (PAGES-SPEC 4 "Static-hosting fallback").

   Helpers: formatDate("2026-09-24") -> "Thu 24 Sep 2026", formatTime("18:30") -> "6:30 pm" (PAGES-SPEC 6), todayISO(), addDaysISO(),
   and the small form-kit behaviours that go with css/pages/_shell.css: formData(form), setBusy(button, on), showFieldErrors(form, fields),
   clearFieldErrors(form), setNotice(el, kind, html|text). All of them are safe no-ops on missing elements.
   ========================================================================== */

const HEADERS = { "Accept": "application/json", "X-Requested-With": "fetch" };
const DEFAULT_TIMEOUT = 12000;      // ms; a booking POST on a sleepy host still answers well inside this
const HEALTH_TIMEOUT = 2000;        // ms; brief: apiAvailable() = cached GET /api/health with a 2 s timeout

export class ApiError extends Error {
    constructor(message, { status = 0, code = "error", fields = {}, body = null } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.fields = fields && typeof fields === "object" ? fields : {};
        this.body = body;
    }
}

/** true when the API is simply not there (static hosting, offline, timed out) - show the call / email fallback notice */
export function isUnavailable(err) {
    return !!err && (err.code === "network" || err.code === "timeout" || err.code === "unavailable");
}

function resolvePath(path, query) {
    let url = String(path || "");
    if (!/^(\/|https?:)/i.test(url)) url = "/api/" + url.replace(/^api\//, "");
    if (query && typeof query === "object") {
        const qs = new URLSearchParams();
        Object.keys(query).forEach((k) => {
            const v = query[k];
            if (v === undefined || v === null || v === "") return;
            qs.append(k, String(v));
        });
        const s = qs.toString();
        if (s) url += (url.includes("?") ? "&" : "?") + s;
    }
    return url;
}

async function request(method, path, { query, body, timeout = DEFAULT_TIMEOUT, signal } = {}) {
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeout);
    if (signal) signal.addEventListener("abort", () => ctrl.abort(), { once: true });

    const init = { method, headers: { ...HEADERS }, credentials: "same-origin", cache: "no-store", signal: ctrl.signal };
    if (body !== undefined && method !== "GET") {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(resolvePath(path, query), init);
    } catch (e) {
        clearTimeout(timer);
        if (timedOut) throw new ApiError("The request took too long. Please try again.", { code: "timeout" });
        if (e && e.name === "AbortError") throw new ApiError("The request was cancelled.", { code: "aborted" });
        throw new ApiError("We could not reach the server. Check your connection and try again.", { code: "network" });
    }
    clearTimeout(timer);

    /* body: JSON when the server says so (or when it parses), otherwise null */
    let data = null;
    const type = res.headers.get("content-type") || "";
    if (res.status !== 204) {
        const text = await res.text().catch(() => "");
        if (text) {
            if (/json/i.test(type)) { try { data = JSON.parse(text); } catch (_) { data = null; } }
            else if (/^\s*[{[]/.test(text)) { try { data = JSON.parse(text); } catch (_) { data = null; } }
        }
    }

    if (res.ok) {
        const out = data === null ? {} : data;
        if (out && typeof out === "object") {
            try { Object.defineProperty(out, "$status", { value: res.status, enumerable: false }); } catch (_) { /* frozen body: ignore */ }
        }
        return out;
    }

    /* the spec error shape: { error, message, fields } */
    if (data && typeof data === "object" && (data.error || data.message)) {
        throw new ApiError(data.message || "Something went wrong. Please try again.", {
            status: res.status, code: String(data.error || "http_" + res.status), fields: data.fields, body: data
        });
    }
    /* an error status WITHOUT the JSON shape = there is no API here (serve.cjs answers "404 /api/..." as text/plain; static hosts send HTML) */
    if (res.status === 404 || res.status === 405 || res.status === 501) {
        throw new ApiError("This feature needs the cafe's server, which is not available here.", { status: res.status, code: "unavailable" });
    }
    throw new ApiError("Something went wrong (" + res.status + "). Please try again.", { status: res.status, code: "http_" + res.status });
}

/* ---- apiAvailable(): cached GET /api/health, 2 s timeout, never throws ---- */
let healthPromise = null;
/** @param {{force?: boolean}} [opts] force = ignore the cache (e.g. a "try again" button) */
export function apiAvailable(opts) {
    if (healthPromise && !(opts && opts.force)) return healthPromise;
    healthPromise = request("GET", "/api/health", { timeout: HEALTH_TIMEOUT })
        .then((d) => !!(d && d.ok))
        .catch(() => false);
    return healthPromise;
}

/* ---- dates and times (PAGES-SPEC 6: "Thu 24 Sep 2026", "6:30 pm") - pure string maths, no timezone drift ---- */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-24" (or a Date) -> "Thu 24 Sep 2026"; anything unparseable comes back unchanged */
export function formatDate(iso) {
    if (iso instanceof Date && !isNaN(iso)) iso = toISO(iso);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return String(iso);
    return `${DAYS[date.getUTCDay()]} ${d} ${MONTHS[mo - 1]} ${y}`;
}

/** "18:30" -> "6:30 pm", "07:00" -> "7:00 am", "00:15" -> "12:15 am", "12:00" -> "12:00 pm" */
export function formatTime(hhmm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
    if (!m) return String(hhmm || "");
    const h = Number(m[1]);
    if (h > 23 || Number(m[2]) > 59) return String(hhmm);
    return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

function toISO(date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
/** today in the visitor's local calendar as "YYYY-MM-DD" (the value format of <input type="date">) */
export function todayISO() { return toISO(new Date()); }
/** addDaysISO("2026-09-24", 7) -> "2026-10-01" */
export function addDaysISO(iso, days) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(days || 0)));
    const p = (n) => String(n).padStart(2, "0");
    return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}`;
}

/* ---- form-kit behaviours (markup + classes: css/pages/_shell.css, documented in verify/handoff-pages/shell.md) ---- */

/** formData(form) -> plain object. Checkboxes become booleans, radio groups their checked value, number inputs numbers; text is trimmed.
    The honeypot `website` field is included on purpose (the server checks it is empty). Disabled / unnamed controls are skipped. */
export function formData(form) {
    const out = {};
    if (!form || !form.elements) return out;
    Array.from(form.elements).forEach((el) => {
        if (!el.name || el.disabled || el.type === "submit" || el.type === "button" || el.type === "fieldset") return;
        if (el.type === "checkbox") { out[el.name] = el.checked; return; }
        if (el.type === "radio") { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = ""; return; }
        if (el.type === "number") { out[el.name] = el.value === "" ? "" : Number(el.value); return; }
        out[el.name] = typeof el.value === "string" ? el.value.trim() : el.value;
    });
    return out;
}

/** setBusy(button, on): .is-loading + aria-busy + disabled while sending (quality bar: "submit disabled while sending") */
export function setBusy(button, on) {
    if (!button) return;
    button.classList.toggle("is-loading", !!on);
    button.disabled = !!on;
    if (on) button.setAttribute("aria-busy", "true"); else button.removeAttribute("aria-busy");
}

function fieldOf(form, name) {
    const el = form.elements[name];
    const control = el && el.length && !el.tagName ? el[0] : el;      // RadioNodeList -> first radio
    if (!control || !control.closest) return null;
    return { control, field: control.closest(".field, .checkbox, fieldset") };
}

/** showFieldErrors(form, { name: message }[, { focus }]): fills each field's .field__error (created when missing), sets aria-invalid +
    .is-invalid, focuses the first invalid control. Returns the number of fields it marked. Unknown names are ignored (show err.message
    in a .notice). Pass { focus: false } to mark the fields without moving focus (blur / live validation); the default is to focus. */
export function showFieldErrors(form, fields, opts) {
    if (!form || !fields) return 0;
    const moveFocus = !(opts && opts.focus === false);
    let first = null, count = 0;
    Object.keys(fields).forEach((name) => {
        const hit = fieldOf(form, name);
        if (!hit || !hit.field) return;
        const { control, field } = hit;
        let box = field.querySelector(".field__error");
        if (!box) {
            box = document.createElement("p");
            box.className = "field__error";
            box.setAttribute("aria-live", "polite");
            field.appendChild(box);
        }
        if (!box.id) box.id = (control.id || name) + "-error";
        box.textContent = String(fields[name]);
        box.hidden = false;
        field.classList.add("is-invalid");
        const targets = field.matches("fieldset") ? Array.from(field.querySelectorAll("input")) : [control];
        targets.forEach((t) => {
            t.setAttribute("aria-invalid", "true");
            const ids = (t.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
            if (!ids.includes(box.id)) { ids.push(box.id); t.setAttribute("aria-describedby", ids.join(" ")); }
        });
        if (!first) first = control;
        count++;
    });
    if (moveFocus && first && first.focus) first.focus();
    return count;
}

/** clearFieldErrors(form[, name]): empties the error text (the aria-live node stays in the DOM) and drops aria-invalid / .is-invalid */
export function clearFieldErrors(form, name) {
    if (!form) return;
    const scope = name ? (fieldOf(form, name) || {}).field : form;
    if (!scope) return;
    const fields = scope.matches && scope.matches(".field, .checkbox, fieldset") ? [scope] : Array.from(scope.querySelectorAll(".is-invalid"));
    fields.forEach((field) => {
        field.classList.remove("is-invalid");
        field.querySelectorAll(".field__error").forEach((box) => { box.textContent = ""; });
        field.querySelectorAll("[aria-invalid]").forEach((t) => t.removeAttribute("aria-invalid"));
    });
}

/** setNotice(el, kind, content): kind = "info" | "success" | "error" | null (null hides). content = text, or a Node for rich content.
    The element should be in the DOM from the start with role="status" (or aria-live="polite") so the change is announced. */
export function setNotice(el, kind, content) {
    if (!el) return;
    el.classList.remove("notice--info", "notice--success", "notice--error");
    if (!kind) { el.hidden = true; el.textContent = ""; return; }
    el.classList.add("notice", "notice--" + kind);
    el.textContent = "";
    if (content instanceof Node) el.appendChild(content); else el.textContent = String(content == null ? "" : content);
    el.hidden = false;
}

const api = {
    get: (path, query, opts) => request("GET", path, { ...(opts || {}), query }),
    post: (path, body, opts) => request("POST", path, { ...(opts || {}), body: body === undefined ? {} : body }),
    patch: (path, body, opts) => request("PATCH", path, { ...(opts || {}), body: body === undefined ? {} : body }),
    put: (path, body, opts) => request("PUT", path, { ...(opts || {}), body: body === undefined ? {} : body }),
    del: (path, opts) => request("DELETE", path, opts || {}),
    available: apiAvailable,
    apiAvailable,
    isUnavailable,
    ApiError,
    formatDate, formatTime, todayISO, addDaysISO,
    formData, setBusy, showFieldErrors, clearFieldErrors, setNotice
};
export default api;
