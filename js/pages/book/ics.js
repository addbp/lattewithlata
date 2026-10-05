/* ==========================================================================
   Latte with Lata - js/pages/book/ics.js (PAGE book lane)
   "Add to calendar" = a real iCalendar file (RFC 5545) built in the browser and handed over as a Blob download. No server round trip.

   - DTSTART / DTEND are FLOATING local times (no "Z", no TZID): the booking is "6:30 pm at the cafe" whatever the visitor's device
     time zone is, which is exactly what the API means by "all times are local cafe time".
   - a table lasts one sitting (GET /api/config turnMinutes, 90 minutes); a recording night runs from doors (6:30 pm) to the end of the
     recording (8:15 pm, options.recordingEnd) - not doors + 90
   - UID comes from the booking reference, so importing the file twice updates the same event instead of duplicating it
   - CRLF line endings, TEXT escaping (\\ \; \, \n) and 75-octet line folding per the RFC
   ========================================================================== */
import { COPY, partyLabel } from "./copy.js";
import { formatDate, formatTime } from "../../lib/api.js";

const pad = (n) => String(n).padStart(2, "0");

/** RFC 5545 3.3.11 TEXT escaping */
export function escapeText(s) {
    return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 3.1 folding: lines longer than 75 octets continue on the next line after CRLF + one space (never inside a UTF-8 sequence) */
export function foldLine(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const out = [];
    let current = "", bytes = 0, limit = 75;
    for (const ch of line) {
        const size = enc.encode(ch).length;
        if (bytes + size > limit) { out.push(current); current = ""; bytes = 0; limit = 74; }   // continuation lines carry a leading space
        current += ch; bytes += size;
    }
    if (current) out.push(current);
    return out.join("\r\n ");
}

/** "2026-09-24" + "18:30" + minutes -> "20260924T183000" (pure calendar maths, no Date time-zone conversion) */
export function localStamp(date, time, addMinutes = 0) {
    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    const t = new Date(Date.UTC(y, mo - 1, d, h, mi + addMinutes, 0));
    return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
}

function utcStamp(date) {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

const toMinutes = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };

/** buildICS(booking, { minutes, recordingEnd, address, phone }) -> the file's text */
export function buildICS(booking, options) {
    const o = Object.assign({ minutes: 90, recordingEnd: COPY.cafe.recordingEnd, address: COPY.cafe.address, phone: COPY.contact.phone, now: new Date() }, options || {});
    const recording = booking.type === "recording";
    /* recording night: DTEND = the end of the recording; if doors ever move past it, fall back to the sitting length */
    const untilEnd = recording && /^\d{2}:\d{2}$/.test(String(o.recordingEnd || "")) ? toMinutes(o.recordingEnd) - toMinutes(booking.time) : 0;
    const duration = untilEnd > 0 ? untilEnd : o.minutes;
    const who = partyLabel(booking.party, booking.type);
    const summary = recording ? `Recording night at ${COPY.cafe.name} (${who})` : `Table for ${booking.party} at ${COPY.cafe.name}`;
    const location = [COPY.cafe.name].concat(o.address).join(", ");
    const description = [
        `Booking reference: ${booking.reference}`,
        recording ? `${who} at the Thursday recording. Doors open at ${formatTime(booking.time)}; be seated by 6:50 pm. The recording ends around ${formatTime(o.recordingEnd || "20:15")}.` : `${who}, ${formatDate(booking.date)} at ${formatTime(booking.time)}. We hold tables for 15 minutes.`,
        `To change or cancel (up to 2 hours before) use the reference with your email on the Book a table page, or call ${o.phone}.`
    ].join("\n");

    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Latte with Lata//Bookings//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${String(booking.reference).toLowerCase()}@lattewithlata.example`,
        `DTSTAMP:${utcStamp(o.now)}`,
        `DTSTART:${localStamp(booking.date, booking.time)}`,
        `DTEND:${localStamp(booking.date, booking.time, duration)}`,
        `SUMMARY:${escapeText(summary)}`,
        `LOCATION:${escapeText(location)}`,
        `DESCRIPTION:${escapeText(description)}`,
        "STATUS:CONFIRMED",
        "TRANSP:OPAQUE",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(summary)}`,
        "TRIGGER:-PT2H",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ];
    return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** hand the file to the browser as a download; returns the text (handy for tests) */
export function downloadICS(booking, options) {
    const text = buildICS(booking, options);
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `latte-with-lata-${String(booking.reference).toLowerCase()}.ics`;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
    return text;
}

export default { buildICS, downloadICS };
