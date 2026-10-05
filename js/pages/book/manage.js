/* ==========================================================================
   Latte with Lata - js/pages/book/manage.js (PAGE book lane)
   #manage: look a booking up by reference + email (GET /api/bookings/lookup), show it, cancel it (POST /api/bookings/cancel) after an
   accessible confirm dialog. The <dialog> is opened with showModal(): the page behind is inert, Escape closes it, Tab is kept inside,
   focus starts on the safe choice ("Keep my booking") and returns to the button that opened it. The 2-hour rule (409 too_late) and the
   other refusals are shown in words next to the booking - the booking card never pretends the cancel worked.

     const manage = initManage({ api, onCancelled(booking) {} });
     manage.prefill({ reference, email }, { lookup: true, focus: true })
   ========================================================================== */
import { COPY, fill, partyLabel, withPhoneLink } from "./copy.js";

const REF_RE = /^LWL-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "lwl 7kq2md" / "7KQ2MD" -> "LWL-7KQ2MD" (what people type is rarely what was printed) */
export function normaliseReference(raw) {
    let s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.startsWith("LWL")) s = s.slice(3);
    return s ? "LWL-" + s : "";
}

export function initManage({ api, onCancelled } = {}) {
    const root = document.getElementById("manage");
    const form = document.getElementById("mg-form");
    if (!root || !form) return { prefill() {}, disable() {} };

    const M = COPY.manage;
    const status = document.getElementById("mg-status");
    const submit = document.getElementById("mg-submit");
    const result = document.getElementById("mg-result");
    const resultNote = document.getElementById("mg-result-note");
    const cancelBtn = document.getElementById("mg-cancel");
    const actions = result.querySelector(".book-found__actions");
    const dialog = document.getElementById("mg-dialog");
    const dialogText = document.getElementById("mg-dialog-text");
    const dialogNote = document.getElementById("mg-dialog-note");
    const dialogYes = document.getElementById("mg-dialog-yes");
    const dialogNo = document.getElementById("mg-dialog-no");
    const refInput = form.elements.reference;
    const emailInput = form.elements.email;
    let current = null;           // the booking on screen
    let currentEmail = "";
    let opener = null;

    const tokens = (b) => ({ reference: b.reference, date: api.formatDate(b.date), time: api.formatTime(b.time), party: partyLabel(b.party, b.type) });
    const errorText = (err) => {
        if (api.isUnavailable(err)) return err.code === "network" ? M.errors.network : M.errors.unavailable;
        return M.errors[err.code] || err.message || M.errors.server_error;
    };

    function renderBooking(b) {
        current = b;
        const set = (key, text) => { const el = result.querySelector(`[data-mg="${key}"]`); if (el) el.textContent = text; };
        set("status", M.statuses[b.status] || b.status);
        const tag = result.querySelector('[data-mg="status"]');
        tag.classList.toggle("tag--solid", b.status === "confirmed" || b.status === "seated");
        tag.dataset.status = b.status;
        set("text", fill(M.text, tokens(b)));
        set("reference", b.reference);
        set("type", b.type === "recording" ? COPY.summary.typeRecording : COPY.summary.typeTable);
        set("date", api.formatDate(b.date));
        set("time", api.formatTime(b.time));
        set("party", partyLabel(b.party, b.type));
        set("name", b.name || "");
        const timeLabel = result.querySelector("[data-mg-time-label]");
        if (timeLabel) timeLabel.textContent = b.type === "recording" ? COPY.summary.doors : COPY.summary.time;

        const active = b.status === "pending" || b.status === "confirmed";
        const canCancel = active && b.cancellable !== false;          // inside the 2-hour window the server would refuse: say so instead of offering a button that fails
        actions.hidden = !active;
        cancelBtn.hidden = !canCancel;
        cancelBtn.disabled = false;
        if (b.status === "cancelled") api.setNotice(resultNote, "info", M.cancel.alreadyCancelled);
        else if (active && b.cancellable === false) api.setNotice(resultNote, "info", withPhoneLink(M.cancel.tooLate));       // inside the 2-hour window: say so before they try
        else api.setNotice(resultNote, null);
        result.hidden = false;
    }

    function validate() {
        const fields = {};
        const reference = normaliseReference(refInput.value);
        const email = String(emailInput.value || "").trim();
        if (!reference) fields.reference = M.validation.reference.required;
        else if (!REF_RE.test(reference)) fields.reference = M.validation.reference.invalid;
        if (!email) fields.email = M.validation.email.required;
        else if (!EMAIL_RE.test(email)) fields.email = M.validation.email.invalid;
        return { fields, reference, email };
    }

    async function lookup({ focusResult = true } = {}) {
        api.clearFieldErrors(form);
        api.setNotice(status, null);
        const { fields, reference, email } = validate();
        if (Object.keys(fields).length) { api.showFieldErrors(form, fields); return null; }
        refInput.value = reference;
        api.setBusy(submit, true);
        submit.textContent = M.searching;
        try {
            const res = await api.get("/api/bookings/lookup", { reference, email });
            currentEmail = email;
            renderBooking(res.booking);
            if (focusResult) result.focus({ preventScroll: false });
            return res.booking;
        } catch (err) {
            result.hidden = true;
            current = null;
            if (err.code === "validation" && api.showFieldErrors(form, err.fields)) return null;
            api.setNotice(status, "error", withPhoneLink(errorText(err)));
            return null;
        } finally {
            api.setBusy(submit, false);
            submit.textContent = M.submit;
        }
    }

    form.addEventListener("submit", (e) => { e.preventDefault(); lookup(); });
    [refInput, emailInput].forEach((input) => input.addEventListener("input", () => api.clearFieldErrors(form, input.name)));
    refInput.addEventListener("blur", () => { const n = normaliseReference(refInput.value); if (n && REF_RE.test(n)) refInput.value = n; });

    /* ---- the confirm dialog ---- */
    function openDialog() {
        if (!current) return;
        opener = document.activeElement;
        dialogText.textContent = fill(M.cancel.confirmText, tokens(current));
        api.setNotice(dialogNote, null);
        api.setBusy(dialogYes, false);
        dialogYes.textContent = M.cancel.yes;
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");                         // very old browsers: a plain (non-modal) panel
        dialogNo.focus();
    }
    function closeDialog() {
        if (dialog.open && typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
    }
    dialog.addEventListener("close", () => {
        const target = opener && document.contains(opener) && !opener.hidden && !opener.disabled ? opener : result;
        opener = null;
        if (target && target.focus) target.focus();
    });
    dialog.addEventListener("cancel", (e) => { if (dialogYes.disabled) e.preventDefault(); });   // Escape is ignored only while the request is in flight
    dialog.addEventListener("click", (e) => { if (e.target === dialog && !dialogYes.disabled) closeDialog(); });   // backdrop click
    dialog.addEventListener("keydown", (e) => {                       // belt and braces: keep Tab inside even where modal inertness is incomplete
        if (e.key !== "Tab") return;
        const items = Array.from(dialog.querySelectorAll("button:not([disabled]), a[href]")).filter((el) => !el.hidden);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    cancelBtn.addEventListener("click", openDialog);
    dialogNo.addEventListener("click", closeDialog);

    dialogYes.addEventListener("click", async () => {
        if (!current) return;
        api.setBusy(dialogYes, true);
        dialogNo.disabled = true;
        dialogYes.textContent = M.cancel.cancelling;
        try {
            const res = await api.post("/api/bookings/cancel", { reference: current.reference, email: currentEmail });
            renderBooking(res.booking);
            api.setNotice(resultNote, "success", fill(M.cancel.done, tokens(res.booking)));
            opener = null;                                            // the cancel button is gone: focus goes to the booking card
            closeDialog();
            if (typeof onCancelled === "function") onCancelled(res.booking);
        } catch (err) {
            const text = errorText(err);
            if (err.code === "too_late" || err.code === "not_cancellable" || err.code === "not_found") {
                /* a refusal about THIS booking: close the dialog and leave the explanation on the card */
                if (err.code !== "not_found") { current = Object.assign({}, current, { cancellable: false }); cancelBtn.hidden = true; }
                opener = null;
                closeDialog();
                if (err.code !== "not_found") {                        // show the booking as it is NOW (staff may have moved it), then the refusal
                    try { const fresh = await api.get("/api/bookings/lookup", { reference: current.reference, email: currentEmail }); renderBooking(fresh.booking); cancelBtn.hidden = true; } catch (_) { /* keep the card we have */ }
                }
                api.setNotice(resultNote, "error", withPhoneLink(text));
                result.focus();
            } else {
                api.setNotice(dialogNote, "error", withPhoneLink(text));             // network / rate limit / server: stay in the dialog so they can retry
            }
        } finally {
            api.setBusy(dialogYes, false);
            dialogNo.disabled = false;
            dialogYes.textContent = M.cancel.yes;
        }
    });

    return {
        /** fill the form (from the confirmation card or the duplicate notice) and optionally run the lookup */
        async prefill({ reference, email } = {}, { lookup: run = false, focus = true } = {}) {
            if (reference) refInput.value = reference;
            if (email) emailInput.value = email;
            api.clearFieldErrors(form);
            api.setNotice(status, null);
            if (run && reference && email) return lookup({ focusResult: focus });
            if (focus) (reference ? emailInput : refInput).focus();
            return null;
        },
        /** static hosting: swap the form for the call / email notice */
        disable() {
            form.hidden = true;
            result.hidden = true;
            const fallback = document.getElementById("mg-fallback");
            if (fallback) fallback.hidden = false;
        }
    };
}

export default initManage;
