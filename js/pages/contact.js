/* ==========================================================================
   Latte with Lata - js/pages/contact.js (PAGE lane events + contact)
   The contact form of contact.html#write -> POST /api/contact { name, email, phone?, topic, message, consent, website } through js/lib/api.js.

     topic        ?topic=<enum> preselects it (and, with no #hash, brings the form into view); the hint under the select follows the choice;
                  the page's own "?topic=...#write" links (press, guests, credits) work in place: preselect + scroll + focus, no reload
     validation   the server's rules, mirrored (lib/validate.cjs): name 2-80, email, phone optional 7-15 digits in 7-20 characters of
                  digits / space / + ( ) - . , topic from the enum, message 10-2000, consent ticked. Checked on blur (once a field was touched) and
                  on submit; the first invalid field takes focus; messages = content/pages.json (data-msg-* in the markup)
     server       400 validation -> fields mapped with api.showFieldErrors (the server's own sentence wins), 429 -> the rate-limit line,
                  anything else -> the matching errors.* line in the aria-live notice
     sending      submit disabled + aria-busy + "Sending...", one request at a time
     success      201 -> the form is replaced by the thank-you block (focus moves to its title)
     no API       GET /api/health fails (static hosting) -> the shared.apiFallback notice with tel + mailto, every control disabled: it never
                  pretends to send. The same happens if the API disappears between the page load and the submit.
     honeypot     the hidden "website" input is posted as it is; the server answers a fake 201 and stores nothing
   No-op when the form is not on the page. No inline handlers (the server's CSP forbids them).
   ========================================================================== */

const EMAIL_RE = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\.]{2,}$/;      // lib/validate.cjs EMAIL_RE
const PHONE_RE = /^[0-9+ ().\-]{7,20}$/;                                              // lib/validate.cjs PHONE_RE
const oneLine = (v) => String(v == null ? "" : v).normalize("NFC").replace(/\s+/g, " ").trim();           // cleanText(v)
const multiLine = (v) => String(v == null ? "" : v).normalize("NFC").replace(/\r\n?/g, "\n").trim();     // cleanText(v, true)

export default function init(ctx) {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const api = ctx.api;
    const el = (name) => form.elements[name];
    const topic = el("topic"), message = el("message"), submit = document.getElementById("contact-submit");
    const status = document.getElementById("contact-status");
    const fallback = document.getElementById("contact-fallback");
    const success = document.getElementById("contact-success");
    const successTitle = document.getElementById("contact-success-title");
    const topicHint = document.getElementById("ct-topic-hint");
    const count = document.getElementById("ct-message-count");
    const countNumber = count ? count.querySelector("[data-count]") : null;
    const countLive = document.getElementById("ct-message-count-live");
    const MIN = Number(message.dataset.min) || 10;
    const MAX = Number(message.dataset.max) || 2000;
    const touched = new Set();
    let sending = false, disabled = false, liveTimer = 0;

    /* ---- rules: name -> message ("" = valid). Same order as the form. ---- */
    const rules = {
        topic: (c) => (!c.value ? c.dataset.msgRequired : Array.from(c.options).some((o) => o.value === c.value) ? "" : c.dataset.msgRequired),
        name: (c) => { const v = oneLine(c.value); return !v ? c.dataset.msgRequired : v.length < 2 ? c.dataset.msgInvalid : v.length > 80 ? c.dataset.msgTooLong : ""; },
        email: (c) => { const v = oneLine(c.value).toLowerCase(); return !v ? c.dataset.msgRequired : v.length > 254 || !EMAIL_RE.test(v) ? c.dataset.msgInvalid : ""; },
        phone: (c) => { const v = oneLine(c.value); if (!v) return ""; const d = v.replace(/\D+/g, "").length; return !PHONE_RE.test(v) || d < 7 || d > 15 ? c.dataset.msgInvalid : ""; },
        message: (c) => { const n = multiLine(c.value).length; return !n ? c.dataset.msgRequired : n < MIN ? c.dataset.msgTooShort : n > MAX ? c.dataset.msgTooLong : ""; },
        consent: (c) => (c.checked ? "" : c.dataset.msgRequired)
    };
    const ORDER = ["topic", "name", "email", "phone", "message", "consent"];

    function check(name, show) {
        const msg = rules[name](el(name)) || "";
        if (!show) return msg;
        if (msg) paint(name, msg); else api.clearFieldErrors(form, name);
        return msg;
    }
    /** one field's error WITHOUT moving the focus (api.showFieldErrors focuses the first field it marks: right on submit, a focus trap on blur).
        Same DOM contract as the helper: text in the field's .field__error (always in the DOM, aria-live), .is-invalid on the field, aria-invalid on the control. */
    function paint(name, msg) {
        const c = el(name);
        const field = c.closest(".field, .checkbox");
        const box = field && field.querySelector(".field__error");
        if (!box) return;
        if (box.textContent !== msg) box.textContent = msg;
        field.classList.add("is-invalid");
        c.setAttribute("aria-invalid", "true");
    }

    /* ---- topic: hint + ?topic= ---- */
    function syncHint() {
        const opt = topic.options[topic.selectedIndex];
        if (topicHint) topicHint.textContent = (opt && opt.dataset.hint) || "";
    }
    function setTopic(value) {
        const ok = Array.from(topic.options).some((o) => o.value === value && value);
        if (!ok) return false;
        topic.value = value;
        syncHint();
        api.clearFieldErrors(form, "topic");
        return true;
    }
    function goToForm(focus) {
        const target = document.getElementById("write");
        if (!target) return;
        target.scrollIntoView({ behavior: ctx.reduceMotion ? "auto" : "smooth", block: "start" });
        if (focus && !disabled) topic.focus({ preventScroll: true });
    }
    const param = form.dataset.topicParam || "topic";
    const asked = new URLSearchParams(location.search).get(param);
    if (asked && setTopic(asked) && !location.hash) {
        const land = () => { const target = document.getElementById("write"); if (target) target.scrollIntoView({ behavior: "auto", block: "start" }); };
        if (document.documentElement.hasAttribute("data-page-ready")) land();
        else document.addEventListener("latte:ready", () => requestAnimationFrame(land), { once: true });     // after the last ScrollTrigger.refresh() of the boot, which restores the scroll position
    }
    syncHint();

    /* the page's own "contact.html?topic=...#write" links: handle them in place */
    document.querySelectorAll("a[data-topic-link]").forEach((a) => {
        a.addEventListener("click", (e) => {
            let url;
            try { url = new URL(a.getAttribute("href"), location.href); } catch (_) { return; }
            if (url.pathname !== location.pathname) return;
            const value = url.searchParams.get(param);
            if (!value) return;
            e.preventDefault();
            if (!form.hidden || showForm()) setTopic(value);
            try { history.replaceState(null, "", url.pathname + url.search + url.hash); } catch (_) { /* file:// */ }
            goToForm(true);
        });
    });
    /* "Photo credits" -> the register in the footer (a closed <details>): open it on the way */
    document.querySelectorAll("a[data-open-credits]").forEach((a) => {
        a.addEventListener("click", () => { const d = document.getElementById("footer-credits"); if (d && "open" in d) d.open = true; });
    });

    /* ---- live character count ---- */
    function syncCount() {
        const n = multiLine(message.value).length;
        if (countNumber) countNumber.textContent = n.toLocaleString("en-US");
        if (count) count.classList.toggle("is-over", n > MAX);
        clearTimeout(liveTimer);
        if (countLive && (n > MAX || MAX - n <= 100)) {
            liveTimer = setTimeout(() => {
                countLive.textContent = n > MAX ? (n - MAX).toLocaleString("en-US") + " characters over the limit" : (MAX - n).toLocaleString("en-US") + " characters left";
            }, 900);
        } else if (countLive) countLive.textContent = "";
    }
    syncCount();

    /* ---- field events ---- */
    topic.addEventListener("change", () => { syncHint(); touched.add("topic"); check("topic", true); });
    ORDER.forEach((name) => {
        const c = el(name);
        c.addEventListener("blur", () => { if (!c.value && !touched.has(name)) return; touched.add(name); if (name !== "consent") check(name, true); });
        c.addEventListener(name === "consent" ? "change" : "input", () => {
            if (name === "message") { syncCount(); if (multiLine(c.value).length > MAX) { touched.add(name); check(name, true); return; } }
            if (touched.has(name) || c.getAttribute("aria-invalid") === "true") check(name, true);
        });
    });
    message.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : submit.click(); } });

    /* ---- states ---- */
    function setDisabled(on) {
        disabled = !!on;
        form.classList.toggle("is-disabled", disabled);
        Array.from(form.elements).forEach((c) => { if (c.name === "website") return; c.disabled = disabled; });
        if (fallback) fallback.hidden = !disabled;
        if (disabled) { api.setNotice(status, null); api.clearFieldErrors(form); }
    }
    function showForm() {
        if (success) success.hidden = true;
        form.hidden = false;
        return true;
    }
    function showSuccess() {
        form.reset();
        touched.clear();
        api.clearFieldErrors(form);
        api.setNotice(status, null);
        syncHint(); syncCount();
        form.hidden = true;
        if (success) {
            success.hidden = false;
            if (successTitle) successTitle.focus({ preventScroll: true });
            const top = success.getBoundingClientRect().top;
            if (top < 0 || top > window.innerHeight * .6) document.getElementById("write").scrollIntoView({ behavior: ctx.reduceMotion ? "auto" : "smooth", block: "start" });
        }
        ctx.refresh();
    }
    const errorLine = (code) => form.dataset["err" + code.split(/[-_]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")] || "";

    /* ---- submit ---- */
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (sending || disabled) return;
        api.setNotice(status, null);

        const errors = {};
        ORDER.forEach((name) => { touched.add(name); const msg = check(name, false); if (msg) errors[name] = msg; else api.clearFieldErrors(form, name); });
        if (Object.keys(errors).length) {
            api.showFieldErrors(form, errors);                        // marks every field, focuses the first
            api.setNotice(status, "error", errorLine("validation"));
            return;
        }

        const data = api.formData(form);
        const body = { name: oneLine(data.name), email: oneLine(data.email).toLowerCase(), phone: oneLine(data.phone), topic: data.topic, message: multiLine(data.message), consent: data.consent === true, website: data.website || "" };

        sending = true;
        api.setBusy(submit, true);
        submit.textContent = form.dataset.labelSending || "Sending...";
        try {
            await api.post("/api/contact", body);
            showSuccess();
        } catch (err) {
            if (err && err.code === "validation") {
                const placed = api.showFieldErrors(form, err.fields);
                api.setNotice(status, "error", placed ? errorLine("validation") : err.message || errorLine("validation"));
            } else if (err && err.code === "rate_limited") {
                api.setNotice(status, "error", errorLine("rate_limited"));
            } else if (api.isUnavailable(err)) {
                if (err.code === "unavailable") setDisabled(true);    // there is no API behind this host after all
                else api.setNotice(status, "error", navigator.onLine === false ? errorLine("network") : errorLine("unavailable"));
            } else {
                api.setNotice(status, "error", errorLine("server_error") || (err && err.message) || "");
            }
        } finally {
            sending = false;
            api.setBusy(submit, false);
            if (disabled) submit.disabled = true;
            submit.textContent = form.dataset.labelSubmit || "Send message";
        }
    });

    /* ---- static hosting: say so before anybody types a message ---- */
    api.apiAvailable().then((ok) => { if (!ok) setDisabled(true); });
}
