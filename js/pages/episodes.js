/* ==========================================================================
   Latte with Lata - js/pages/episodes.js (lane PAGE podcast + episodes)
   Page module of episodes.html. Contract: js/page.js imports it and calls the default export with ctx
   { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel, api, core, page, refreshCarousels }.
   The page is complete without this file (all 18 episodes visible, notes in native <details>); the module adds:
     1. filter chips   [data-eps-filter] button[data-filter] - toggle buttons (aria-pressed, single select), filtering li[data-pillar] by pillarId with the
                       hidden attribute; the result count lives in a role="status" aria-live="polite" line ("5 episodes"); empty state; after a change
                       the list is brought back under the sticky filter row when the reader was further down.
     2. deep links     #ep-<n> on load, on hashchange and on same-hash clicks: clear a filter that hides the target, open its "Show notes", scroll it
                       below the fixed header + the sticky filter row (CSS scroll-margin / scroll-padding), move focus to its heading (tabindex -1).
     3. housekeeping   --epsFilterH (the measured filter row) for the scroll margins; ScrollTrigger.refresh() after a filter / disclosure changes the
                       page height (plain refresh, never refresh(true)).
   No-op when the DOM is absent; idempotent (data-eps-init).
   ========================================================================== */
export default function init(ctx = {}) {
    const root = document.getElementById("p-episodes-03-all-episodes");
    if (!root) return null;
    if (root.dataset.epsInit) return root._eps || null;
    root.dataset.epsInit = "1";

    const grid = root.querySelector("[data-eps-grid]");
    const bar = root.querySelector("[data-eps-filter]");
    if (!grid) return null;
    const items = Array.from(grid.children).filter((li) => li.matches("li"));
    const chips = bar ? Array.from(bar.querySelectorAll("button[data-filter]")) : [];
    const countEl = bar ? bar.querySelector(".eps-filter__count") : null;
    const emptyEl = root.querySelector("[data-eps-empty]");
    const countText = (bar && bar.dataset.countText) || "{count} episodes";
    const reduce = !!ctx.reduceMotion;
    const state = { root, filter: "all", count: items.length, open: openFromHash };
    root._eps = state;

    /* ---- housekeeping ---- */
    let refreshTimer = 0;
    const refreshSoon = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { if (typeof ctx.refresh === "function") ctx.refresh(); }, 120); };
    const measureBar = () => { if (bar) document.body.style.setProperty("--epsFilterH", Math.ceil(bar.getBoundingClientRect().height) + "px"); };
    measureBar();
    if (ctx.ScrollTrigger) ctx.ScrollTrigger.addEventListener("refresh", measureBar);

    /* the scroll reveals (.anima--bottom-in -> .waiting / .animated, core.initReveals) would leave a re-shown card invisible until its trigger fires
       again: once the reader filters (or deep-links), the cards are simply shown and their reveal triggers retired */
    let settled = false;
    function settleReveals() {
        if (settled) return;
        settled = true;
        if (ctx.ScrollTrigger) ctx.ScrollTrigger.getAll().forEach((st) => { if (items.includes(st.trigger)) st.kill(); });
        items.forEach((li) => { li.classList.remove("waiting"); li.classList.add("animated"); });
    }

    /* ---- 1. filter ---- */
    function applyFilter(id, opts = {}) {
        const known = chips.some((c) => c.dataset.filter === id);
        if (!known) id = "all";
        state.filter = id;
        settleReveals();
        chips.forEach((c) => {
            const on = c.dataset.filter === id;
            c.setAttribute("aria-pressed", on ? "true" : "false");
            c.classList.toggle("is-active", on);
        });
        let n = 0;
        items.forEach((li) => {
            const show = id === "all" || li.dataset.pillar === id;
            li.hidden = !show;
            li.classList.remove("is-entering");
            if (show) {
                li.style.setProperty("--i", String(Math.min(n, 8)));
                if (opts.animate !== false && !reduce) { void li.offsetWidth; li.classList.add("is-entering"); }
                n++;
            }
        });
        state.count = n;
        if (countEl) countEl.textContent = countText.replace("{count}", String(n)).replace(/\b(1 episode)s\b/, "$1");
        if (emptyEl) emptyEl.hidden = n !== 0;
        if (opts.scroll !== false && bar) {                                    // the list got shorter: keep the reader at its top, under the sticky row
            const barBottom = bar.getBoundingClientRect().bottom;
            if (grid.getBoundingClientRect().top < barBottom - 1) grid.scrollIntoView({ block: "start", behavior: "auto" });
        }
        refreshSoon();
    }
    grid.addEventListener("animationend", (e) => { if (e.target instanceof Element && e.target.classList.contains("is-entering")) e.target.classList.remove("is-entering"); });
    chips.forEach((c) => c.addEventListener("click", () => applyFilter(c.dataset.filter)));

    /* ---- 2. deep links ---- */
    function openFromHash(opts = {}) {
        const m = /^#(ep-\d+)$/.exec(window.location.hash || "");
        if (!m) return false;
        const card = document.getElementById(m[1]);
        if (!card || !grid.contains(card)) return false;
        const li = card.closest("li");
        if (li && li.hidden) applyFilter("all", { animate: false, scroll: false });
        settleReveals();
        const notes = card.querySelector("details");
        if (notes && !notes.open) notes.open = true;
        const heading = card.querySelector(".eps-card__title");
        const go = () => {
            measureBar();
            card.scrollIntoView({ block: "start", behavior: "auto" });
            if (opts.focus !== false && heading) heading.focus({ preventScroll: true });
        };
        go();
        requestAnimationFrame(go);                                             // once more after the opened notes / the filter reset are laid out
        return true;
    }
    window.addEventListener("hashchange", () => openFromHash());
    document.addEventListener("click", (e) => {                               // a second click on the same #ep-<n> link fires no hashchange
        const a = e.target instanceof Element ? e.target.closest('a[href^="#ep-"]') : null;
        if (a && a.getAttribute("href") === window.location.hash) { e.preventDefault(); openFromHash(); }
    });
    grid.addEventListener("toggle", refreshSoon, true);                       // <details> toggle does not bubble: capture it

    if (openFromHash()) {
        /* fonts and images settle after this module runs: land on the card again when the shell reports ready */
        document.addEventListener("latte:ready", () => {
            openFromHash({ focus: false });
            /* a late shift (the header sliding back in, a font swap above the grid) could still leave the card under the sticky row: check once
               more after the header transition, and only while the reader has not scrolled */
            const y = window.scrollY;
            setTimeout(() => {
                if (window.scrollY !== y || !bar) return;
                const m = /^#(ep-\d+)$/.exec(window.location.hash || "");
                const card = m && document.getElementById(m[1]);
                if (card && card.getBoundingClientRect().top < bar.getBoundingClientRect().bottom) openFromHash({ focus: false });
            }, 320);
        }, { once: true });
    }
    return state;
}
