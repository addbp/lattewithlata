/* ==========================================================================
   Latte with Lata - js/pages/book/copy.js (PAGE book lane)
   Every string the booking scripts print, copied from content/pages.json -> book (CONTENT lane). The static labels live in the fragments
   (pages/book/*.html); this file holds only what JavaScript has to write at runtime. Tokens: {reference} {date} {time} {party} {n}.
   ========================================================================== */
export const COPY = {
    help: {
        when: "We take bookings up to 60 days ahead. Days we are closed or full are greyed out.",
        whenRecording: "Recording nights are Thursdays. Pick one from the list, or from the calendar.",
        party: "Up to 8 online. For a bigger group, call or email and we will plan the tables.",
        partyRecording: "Up to 4 seats on one reservation, so there is room for everyone. Count children too.",
        time: "Times are shown in 30-minute steps. A sitting is 90 minutes. Greyed-out times are full.",
        timeRecording: "Doors open at 6:30 pm. Be seated by 6:50 pm."
    },
    large: {
        table: "Online bookings go up to 8. For a bigger group,",
        recording: "Recording night seats are limited to 4 per reservation. For a bigger group,"
    },
    availability: {
        loading: "Checking the book...",
        closed: "We are closed that day. Pick another date.",
        noSlots: "Nothing left for that party size on this day. Try another day, or call us.",
        seatsLeft: "{n} seats left",
        seatLeft: "1 seat left",
        full: "Full",
        past: "Passed",
        groupPast: "No longer bookable today.",
        recordingFull: "This night is fully reserved. Walk in anyway: reserved seats still empty at 6:50 pm go to the room.",
        slotGone: "That time has just been taken. Pick another.",
        doors: "Doors {time}",
        groups: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" },
        reasons: {
            invalid_date: "That date does not look right. Pick another.",
            past: "That date has passed. Pick today or later.",
            too_far: "We take bookings up to 60 days ahead. Pick an earlier date.",
            blocked: "We are not taking bookings on that date. Pick another, or call us.",
            closed: "We are closed that day. Pick another date.",
            not_recording_night: "Recording nights are Thursdays, doors at 6:30 pm. Pick a Thursday.",
            too_late_today: "Online booking has closed for today. Call us and we will do our best.",
            full: "We are fully booked for that party size on this date. Try another day, or call us."
        }
    },
    summary: {
        typeTable: "A table",
        typeRecording: "Seats at the recording",
        empty: "Not chosen yet",
        emptyName: "Not entered yet",
        none: "None",
        personOne: "person",
        personMany: "people",
        seatOne: "seat",
        seatMany: "seats",
        time: "Time",
        doors: "Doors"
    },
    buttons: {
        confirm: "Confirm booking",
        confirmRecording: "Reserve my seats",
        sending: "Booking...",
        copy: "Copy",
        copied: "Copied"
    },
    validation: {
        type: { required: "Choose a table or a seat at the recording." },
        date: { required: "Pick a date.", invalid: "That date does not look right." },
        time: { required: "Pick a time.", unavailable: "That time has just been taken. Pick another." },
        party: {
            required: "Tell us how many people are coming.",
            max: "Online bookings go up to 8. For a bigger group, call or email us.",
            maxRecording: "Recording night seats are limited to 4 per reservation."
        },
        name: { required: "Tell us the name for the booking.", invalid: "Use at least 2 characters.", tooLong: "Keep the name under 80 characters." },
        email: { required: "We need an email so you can find or cancel your booking.", invalid: "That email does not look right. Check it and try again." },
        phone: { required: "We need a number in case something changes on the day.", invalid: "Enter a phone number with 7 to 15 digits." },
        notes: { tooLong: "Keep notes under 500 characters." },
        consent: { required: "Please tick the box so we can hold the booking." }
    },
    errors: {
        validation: "Some details need another look. The messages are next to each field.",
        slot_full: "Someone just took the last table at that time. Pick another time and we will hold it for you.",
        slot_full_recording: "Someone just took the last seats for that night. Walk in anyway: reserved seats still empty at 6:50 pm go to the room.",
        duplicate: "You already have a booking at that time under this email.",
        duplicateLink: "Use Manage a booking to check or cancel it.",
        rate_limited: "That is a lot of attempts in a short time. Wait a few minutes and try again, or call us.",
        unavailable: "The booking system is not answering right now. Try again in a minute, or call (555) 014-2024.",
        server_error: "Something went wrong on our side. Your booking was not made. Try again, or call (555) 014-2024.",
        network: "You seem to be offline. Check your connection and try again."
    },
    success: {
        eyebrow: "Booking confirmed",
        eyebrowPending: "Request received",
        title: "You are booked",
        titleRecording: "Your seats are reserved",
        text: "A table for {party} on {date} at {time}. Your reference is {reference}.",
        textRecording: "{party} at the recording on {date}. Doors open at {time}. Your reference is {reference}.",
        pending: "Your request is in, and we will confirm it shortly. Your reference is {reference}.",
        hold: "We hold tables for 15 minutes. If you are running late, call ",
        holdRecording: "Reserved seats are held until 6:50 pm, then released to the room. Running late? Call ",
        copied: "Reference {reference} copied.",
        copyFailed: "Copying is blocked here. Select the reference and copy it by hand.",
        announce: "Booking confirmed. Your reference is {reference}."
    },
    manage: {
        submit: "Find my booking",
        searching: "Looking...",
        text: "{party} on {date} at {time}. Reference {reference}.",
        statuses: { pending: "Waiting for confirmation", confirmed: "Confirmed", seated: "Seated", completed: "Completed", cancelled: "Cancelled", no_show: "Missed" },
        cancel: {
            button: "Cancel this booking",
            confirmText: "Your booking for {party} on {date} at {time} will be cancelled. This cannot be undone.",
            yes: "Yes, cancel it",
            cancelling: "Cancelling...",
            done: "Booking {reference} is cancelled. Thank you for letting us know.",
            tooLate: "It is less than 2 hours before your booking, so it cannot be cancelled online. Please call (555) 014-2024.",
            alreadyCancelled: "This booking has already been cancelled."
        },
        validation: {
            reference: { required: "Enter your booking reference.", invalid: "A reference looks like LWL-ABC123." },
            email: { required: "Enter the email you booked with.", invalid: "That email does not look right. Check it and try again." }
        },
        errors: {
            not_found: "We could not find a booking with that reference and email. Check both and try again.",
            too_late: "It is less than 2 hours before your booking, so it cannot be cancelled online. Please call (555) 014-2024.",
            not_cancellable: "This booking can no longer be cancelled online. Please call (555) 014-2024.",
            server_error: "Something went wrong on our side. Nothing was changed. Try again, or call (555) 014-2024.",
            rate_limited: "That is a lot of attempts in a short time. Wait a few minutes and try again.",
            unavailable: "The booking system is not answering right now. Try again in a minute, or call (555) 014-2024.",
            network: "You seem to be offline. Check your connection and try again."
        }
    },
    contact: { phone: "(555) 014-2024", tel: "tel:+15550142024", email: "hello@lattewithlata.example", mailto: "mailto:hello@lattewithlata.example" },
    cafe: { name: "Latte with Lata", address: ["27 Bellwood Street", "Corner of Fenwick Lane", "Harrowfield"], recordingEnd: "20:15" }   // pages.json events: doors 6:30 pm, recording ends 8:15 pm
};

/** fill("{party} on {date}", { party: "2 people", date: "Thu 24 Sep 2026" }) */
export function fill(template, values) {
    return String(template || "").replace(/\{(\w+)\}/g, (m, key) => (values && values[key] != null ? String(values[key]) : m));
}

/** "... call (555) 014-2024." -> a text node with the number as a real tel: link (notices are built from nodes, never from HTML strings) */
export function withPhoneLink(text) {
    const out = document.createElement("span");
    const parts = String(text || "").split(COPY.contact.phone);
    parts.forEach((part, i) => {
        if (i) { const a = document.createElement("a"); a.href = COPY.contact.tel; a.textContent = COPY.contact.phone; out.append(a); }
        if (part) out.append(document.createTextNode(part));
    });
    return out;
}

/** "2 people" / "1 person" - for a recording "2 seats" / "1 seat" */
export function partyLabel(party, type) {
    const n = Number(party) || 0;
    const s = COPY.summary;
    if (type === "recording") return `${n} ${n === 1 ? s.seatOne : s.seatMany}`;
    return `${n} ${n === 1 ? s.personOne : s.personMany}`;
}

export default COPY;
