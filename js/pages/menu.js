/* ==========================================================================
   Latte with Lata - js/pages/menu.js (PAGE lane cafe + menu; contract: export default function init(ctx), no-op when the DOM is absent)
   The generic motion (word-rise titles, reveals, .page-nav scroll-spy) is already running from js/page.js. This module adds:
     1  the sticky category rail: stretches .menu-rail__track (the chips' absolutely positioned, click-through parent) from the intro to the end
        of the last category, so native position: sticky carries the chips across the six category fragments. Re-measured on every
        ScrollTrigger "refresh" (fonts, images, resize, filter).
     2  the dietary filter: aria-pressed chips (Show all / Vegetarian / Vegan / Gluten-free). Non-matching list items AND featured cards get the
        hidden attribute, a category with nothing left shows its "nothing here" line, the count is announced through the role=status line, the
        choice is mirrored in ?diet= (replaceState) and restored on load. Vegan dishes carry VG only, so "vegetarian" matches v OR vg.
     3  scroll-spy support for the category chips: the kit sets aria-current; here the current chip is kept in view inside the sideways-scrolling
        chip row on phones, chip jumps glide (ScrollToPlugin; instant under reduced motion) to land flush under the rail, and focus moves to the
        category heading so keyboard users continue from there. If the kit's spy is ever absent, an equivalent one is created here.
   Without JS: every item is visible, the chips are plain anchors, the filter group is not shown (css/pages/menu.css).
   ========================================================================== */
const FILTERS = {
    all: { label: "", test: () => true },
    v:   { label: "Vegetarian",  test: (tags) => tags.includes("v") || tags.includes("vg") },
    vg:  { label: "Vegan",       test: (tags) => tags.includes("vg") },
    gf:  { label: "Gluten-free", test: (tags) => tags.includes("gf") }
};

export default function init(ctx = {}) {
    const intro = document.getElementById("p-menu-02-intro");
    const items = Array.from(document.querySelectorAll("[data-menu-item]"));
    if (!intro || !items.length) return null;                           // not the menu page (file contract)

    const { gsap, ScrollTrigger, reduceMotion } = ctx;
    const refresh = typeof ctx.refresh === "function" ? ctx.refresh : () => ScrollTrigger && ScrollTrigger.refresh();
    const cards = Array.from(document.querySelectorAll("[data-menu-card]"));
    const cats = Array.from(document.querySelectorAll("[data-menu-cat]"));
    const tagsOf = (el) => (el.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean);

    /* ---- 1. sticky rail ---- */
    const rail = intro.querySelector(".menu-rail");
    const track = intro.querySelector(".menu-rail__track");
    const nav = intro.querySelector(".page-nav");
    function measureRail() {
        if (!rail || !track || !cats.length) return;
        const end = cats[cats.length - 1].getBoundingClientRect().bottom;
        const h = Math.round(end - rail.getBoundingClientRect().top);
        track.style.setProperty("--railH", Math.max(h, rail.offsetHeight) + "px");
    }
    measureRail();
    if (ScrollTrigger) ScrollTrigger.addEventListener("refresh", measureRail);

    /* ---- 2. filter ---- */
    const group = intro.querySelector(".menu-filter");
    const buttons = group ? Array.from(group.querySelectorAll("[data-filter]")) : [];
    const status = group ? group.querySelector(".menu-filter__status") : null;
    const total = items.length;
    let current = "all";

    function apply(key, opts = {}) {
        if (!FILTERS[key]) key = "all";
        current = key;
        const f = FILTERS[key];
        let shown = 0;
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === key)));
        items.forEach((li) => { const ok = f.test(tagsOf(li)); li.hidden = !ok; if (ok) shown += 1; });
        cards.forEach((li) => { li.hidden = !f.test(tagsOf(li)); });
        cats.forEach((cat) => {
            const empty = cat.querySelector(".menu-cat__empty");
            if (empty) empty.hidden = !!cat.querySelector("[data-menu-item]:not([hidden])");
        });
        if (status) status.textContent = key === "all" ? `Showing all ${total} items` : `Showing ${shown} of ${total} items: ${f.label}`;
        if (opts.url !== false) {
            try {
                const url = new URL(window.location.href);
                if (key === "all") url.searchParams.delete("diet"); else url.searchParams.set("diet", key);
                window.history.replaceState(window.history.state, "", url);
            } catch (_) { /* file:// or a sandboxed history: the filter still works */ }
        }
        if (opts.refresh !== false) refresh();                          // section heights changed: reveals, spy and the rail re-measure
        return shown;
    }
    buttons.forEach((b) => b.addEventListener("click", () => {
        const key = b.dataset.filter;
        apply(key === current && key !== "all" ? "all" : key);          // pressing the active filter again releases it
    }));
    const initial = new URLSearchParams(window.location.search).get("diet");
    if (initial && FILTERS[initial] && initial !== "all") apply(initial, { url: false, refresh: false });

    /* a deep link to a line the filter is hiding: release the filter, then go there */
    function revealTarget() {
        const id = decodeURIComponent(window.location.hash.slice(1));
        const el = id ? document.getElementById(id) : null;
        if (el && el.hidden && el.matches("[data-menu-item]")) { apply("all"); el.scrollIntoView(); }
    }
    window.addEventListener("hashchange", revealTarget);
    revealTarget();

    /* ---- 3. category chips ---- */
    if (nav) {
        const list = nav.querySelector(".page-nav__list");
        const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
        const targetOf = (a) => document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));

        if (!nav.dataset.navInit && ScrollTrigger) {                    // the kit's spy normally owns this (js/page.js initPageNav)
            nav.dataset.navInit = "1";
            links.forEach((a) => {
                const target = targetOf(a);
                if (!target) return;
                ScrollTrigger.create({
                    trigger: target, start: "top 55%", end: "bottom 55%",
                    onToggle: (self) => {
                        if (!self.isActive) { a.removeAttribute("aria-current"); return; }
                        links.forEach((l) => l.removeAttribute("aria-current"));
                        a.setAttribute("aria-current", "true");
                    }
                });
            });
        }

        /* keep the current chip in view inside the sideways-scrolling row (never scrolls the page) */
        if (list && "MutationObserver" in window) {
            new MutationObserver(() => {
                const a = nav.querySelector("a[aria-current]");
                if (!a || list.scrollWidth <= list.clientWidth) return;
                const left = a.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - (list.clientWidth - a.offsetWidth) / 2;
                list.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? "auto" : "smooth" });
            }).observe(nav, { attributes: true, subtree: true, attributeFilter: ["aria-current"] });
        }

        /* chip jumps: land the band flush under the rail (the header hides on the way down and shows on the way up) */
        nav.addEventListener("click", (e) => {
            const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
            if (!a || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const target = targetOf(a);
            if (!target) return;
            e.preventDefault();
            const y = target.getBoundingClientRect().top + window.pageYOffset;
            const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hH")) || 78;
            const down = y > window.pageYOffset + 1;
            const to = Math.max(0, Math.round(y - nav.offsetHeight - (down ? 0 : headerH)) + 1);
            const heading = target.querySelector("h2");
            const land = () => { if (heading) heading.focus({ preventScroll: true }); };
            try { window.history.pushState(window.history.state, "", a.getAttribute("href")); } catch (_) { /* keep going */ }
            if (reduceMotion || !gsap || !(gsap.plugins && gsap.plugins.scrollTo)) { window.scrollTo(0, to); land(); return; }
            gsap.to(window, { duration: .9, ease: "power2.inOut", scrollTo: { y: to, autoKill: true }, onComplete: land, overwrite: true });
        });
    }

    return { items: total, filter: () => current, apply, measureRail };
}
