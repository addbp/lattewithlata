/* ==========================================================================
   00-header - plate / hide-show triggers (M1, M2), drawer toggle (M3), --hH, mobile pill (M28)
   Sources: PS = PZ/source/js/modules/_page-scroll.beautified.js
            MN = PZ/source/js/modules/_menu.beautified.js
            IB = IC(eberg)/source/js/D51_WxQ5.beautified.js
   ctx = { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   Header triggers stay active under reduceMotion (PS:284 returns AFTER this block).
   PAGES UPDATE (2026-09-17): this module runs on EVERY page (js/main.js on the home page, js/page.js on the sub-pages). The banner the
   plate / hide-show maths key off is the first [data-banner] element (every sub-page hero: .page-hero[data-banner]) with #s-01-hero as the
   fallback (home). The drawer links are real pages now, so the drawer closes on any link click and marks the current page.
   UPDATE-3 (2026-09-17): the bar's "Book a table" link was replaced by the logo lockup link (markup + CSS only - nothing here keyed off it).
   ========================================================================== */
export default function init(ctx) {
    const header = document.getElementById("page-header");
    if (!header || header.dataset.init) return;
    header.dataset.init = "header";

    const { gsap, ScrollTrigger, reduceMotion, mm } = ctx;
    const html = document.documentElement;
    const body = document.body;
    const main = document.getElementById("main") || document.querySelector("main") || body;   // np_root.page.content (= main.page__content)
    const hero = () => document.querySelector("[data-banner]") || document.getElementById("s-01-hero");   // np_root.page.banner (= .banner): first [data-banner], fallback the home hero (PAGES-SPEC 2)
    const heroHeight = () => (hero() ? hero().offsetHeight : 0);                             // banner.height()

    /* ---- --hH: measured header height as a unitless number - PS:167-170 (runs again on resize like the source's r[] stack) ---- */
    const setHH = () => {
        const t = header.offsetHeight, e = header.offsetWidth;
        html.style.setProperty("--hH", String(t < e ? t : e));                                // i = t < e ? t : e
    };
    setHH();
    window.addEventListener("resize", setHH);

    /* ---- M3 drawer - MN:11-14 ---- */
    const drawer = document.getElementById("menu-container");
    const burger = header.querySelector("button.js-menu-switcher");
    const setOpen = (open) => {
        const was = html.classList.contains("m-open");
        html.classList.toggle("m-open", open);                                                // o.addClass/removeClass("m-open")
        if (burger) burger.setAttribute("aria-expanded", open ? "true" : "false");           // a11y - INFERRED
        if (drawer) drawer.setAttribute("aria-hidden", open ? "false" : "true");
        // INFERRED (DD s7 accessibility; verify-A gate 6 "focus trap"): closing returns focus to the burger when it was inside
        // the drawer, so keyboard users are not dropped on a hidden link (the source has no focus management - MN:11-14).
        if (was && !open && burger && drawer && drawer.contains(document.activeElement)) burger.focus({ preventScroll: true });
    };
    header.querySelectorAll(".js-menu-switcher").forEach((el) => {
        el.addEventListener("click", (e) => {                                                 // MN:11-12
            e.preventDefault();
            setOpen(!html.classList.contains("m-open"));
        });
    });
    /* focus trap - INFERRED (not in the source): while html.m-open, Tab / Shift+Tab cycle through the burger + the drawer's
       focusable links only; focus can never land on the page behind the screen (which would also scroll it: gate 6). */
    const trapList = () => {
        const inDrawer = drawer ? Array.from(drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
        return [burger].concat(inDrawer).filter((el) => el && el.getClientRects().length);
    };
    body.addEventListener("keydown", (e) => {                                                 // MN:13-14 (27 === n.which)
        if (e.key === "Escape" || e.keyCode === 27) { setOpen(false); return; }
        if (e.key !== "Tab" || !html.classList.contains("m-open")) return;
        const list = trapList();
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        // every Tab step is driven here (the header's logo lockup link sits outside the list and under the screen)
        const next = e.shiftKey
            ? (i <= 0 ? list[list.length - 1] : list[i - 1])                                  // Shift+Tab: burger (or outside) -> last drawer link
            : (i === -1 || i === list.length - 1 ? list[0] : list[i + 1]);                   // Tab: past the last link (or outside) -> burger
        e.preventDefault();
        next.focus({ preventScroll: true });
    });
    if (drawer) {
        // INFERRED: every drawer link closes the drawer - same-page anchors (#s-13-newsletter, podcast.html#host while ON podcast.html) so the
        // browser can scroll to the target, page links so a bfcache "back" never restores an open drawer. Placeholder "#" links are left alone.
        drawer.querySelectorAll("a[href]").forEach((a) => {
            if (a.getAttribute("href") === "#") return;
            a.addEventListener("click", () => setOpen(false));
        });
        // current page marker: body[data-page] ("home" when absent) -> aria-current="page" on the matching [data-nav] link (CSS: hairline)
        const page = body.dataset.page || "home";
        drawer.querySelectorAll("[data-nav]").forEach((a) => { if (a.dataset.nav === page) a.setAttribute("aria-current", "page"); });
    }
    window.addEventListener("pageshow", (e) => { if (e.persisted) setOpen(false); });        // bfcache restore: never come back to an open drawer - INFERRED

    /* ---- M1 plate - PS:183-195: start = banner.height()/4 (225 desktop / 211 mobile), fallback 300 ---- */
    ScrollTrigger.create({                                                                    // gsap.to("body", {scrollTrigger: {...}}) in the source; a bare trigger is equivalent
        trigger: main,                                                                        // PS:185 (np_root.page.content)
        start: () => (hero() ? heroHeight() / 4 * 1 : 300),                                   // PS:186
        onEnter: () => body.classList.add("opaque"),                                          // PS:187-189
        onLeaveBack: () => body.classList.remove("opaque"),                                   // PS:190-192
        refreshPriority: 1500,                                                                // PS:193
        invalidateOnRefresh: true                                                             // PS:194
    });

    /* ---- M2 hide/show - PS:196-210: start = banner.height()/2 (450 / 422), |dy| > 10 ---- */
    let a = 0;                                                                                // last scrollTop (PS var a)
    ScrollTrigger.create({
        trigger: main,                                                                        // PS:198
        start: () => (hero() ? heroHeight() / 2 * 1 : 500),                                   // PS:199
        onUpdate: (t) => {                                                                    // PS:200-204
            const e = window.pageYOffset;                                                     // np_root.page.win.scrollTop()
            if (t.direction > 0) { if (Math.abs(a - e) > 10) body.classList.add("header-up"); }
            else if (Math.abs(e - a) > 10) body.classList.remove("header-up");
            a = e;
        },
        onLeaveBack: () => body.classList.remove("header-up"),                               // PS:205-207
        refreshPriority: -100,                                                                // PS:208
        invalidateOnRefresh: true                                                             // PS:209
    });

    /* ---- M28 mobile pill - IB:1603-1617 (isMobile "(max-width: 767px)") ----
       Port: trigger = #main (BUILD-SPEC 00 (d)); start = the hero's height so the pill appears "from the title strip down"
       (BEST-PARTS Pick 18 "Change") and never sits over the hero tagline - INFERRED start offset; the spec's literal "top top"
       would show it over the hero. end "bottom bottom" (IB:1607). */
    const wrap = document.getElementById("book-pill-wrap");
    if (wrap && main !== body) {
        if (reduceMotion) {
            gsap.set(wrap, { opacity: 1, visibility: "visible" });                            // DD Pick 19: end state, no trigger - INFERRED
        } else {
            mm.add("(max-width: 767px)", () => {                                              // IB:1598 isMobile
                gsap.timeline({
                    scrollTrigger: {
                        trigger: main,                                                        // IB:1604 (".home-about" -> #main)
                        start: () => "top+=" + heroHeight() + " top",                         // IB:1605 "top top" + hero offset (see note above)
                        end: () => "bottom bottom",                                           // IB:1606
                        toggleActions: "play reverse play reverse",                           // IB:1607
                        invalidateOnRefresh: true                                             // function-valued start/end (BUILD-SPEC M30)
                    }
                }).fromTo(wrap, { opacity: 0, visibility: "hidden" },                         // IB:1609-1612
                    { opacity: 1, visibility: "visible", duration: .6, ease: "power2.out" }); // IB:1613-1616
                /* brand pass (review POLISH 5): park the pill while 12 VISIT / LISTEN is in view - it carries its own "Book a table"
                   and the pill was sliding over the twin-card titles; html.pill-away is CSS-only (00-header.css), no tween - INFERRED */
                /* PAGES UPDATE: the same parking works for any block that opts in with [data-pill-away] (forms, booking widgets, a page's own
                   "Book a table" row) - a counter keeps html.pill-away on while at least one of them is in view */
                const parks = Array.from(document.querySelectorAll("#s-12-visit-listen, [data-pill-away]"));
                if (parks.length) {
                    let active = 0;
                    const aways = parks.map((el) => ScrollTrigger.create({
                        trigger: el, start: "top 85%", end: "bottom 15%",
                        onToggle: (e) => { active = Math.max(0, active + (e.isActive ? 1 : -1)); html.classList.toggle("pill-away", active > 0); }
                    }));
                    return () => { aways.forEach((t) => t.kill()); html.classList.remove("pill-away"); };   // mm cleanup when the query stops matching
                }
            });
        }
    }

    /* ---- SHARED POLISH 2026-09-17: pill contrast + brown-on-brown seam (verify/pages/shared-polish.md) ---- */
    initPillContrast(wrap);
    markSeams();
}

/* colour helpers (WCAG 2.x relative luminance, BRAND.md s1) */
const BRAND = [80, 37, 6];                       // --colBrand, the pill's default plate
const WHITE = [255, 255, 255];                   // --colOnBrand, the inverted plate
const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const parseRGBA = (s) => {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const v = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return v.length >= 3 ? [v[0], v[1], v[2], v.length > 3 ? v[3] : 1] : null;
};
const over = (top, under) => [0, 1, 2].map((k) => top[k] * top[3] + under[k] * (1 - top[3]));   // alpha-composite top onto an opaque colour

/* Pill contrast. The pill is a brown plate; over the brand / deep brown bands (1:1) and the caramel band (2:1) it disappears. On every scroll
   frame (rAF-throttled, phones only) three points across the pill's centre line are resolved to the colour painted behind them:
   document.elementsFromPoint (the pill's wrapper is pointer-events:none, the pill itself is filtered out), translucent backgrounds composited
   down to the first opaque one; a photo (<img>) is read from a cached 24x24 thumbnail mapped through object-fit / object-position. The plate
   whose WORST point contrast is higher wins; the result is one class on the wrapper (#book-pill-wrap.is-on-dark -> white plate, brown label,
   00-header.css). Brown pill vs white 13.06:1, white pill vs brown 13.06 / deep 16.97 / caramel 6.54. The data-pill-away parking is untouched. */
function initPillContrast(wrap) {
    const pill = document.getElementById("book-pill");
    if (!wrap || !pill || wrap.dataset.contrastInit) return;
    wrap.dataset.contrastInit = "1";
    const phone = window.matchMedia("(max-width: 47.99em)");
    const thumbs = new WeakMap();                // img -> { src, w, h, data } (24x24 RGBA) or { src, fail: true }

    const imgColour = (img, x, y) => {
        if (!img.complete || !img.naturalWidth) return null;
        let t = thumbs.get(img);
        if (!t || t.src !== img.currentSrc) {
            t = { src: img.currentSrc };
            try {
                const c = document.createElement("canvas");
                c.width = 24; c.height = 24;
                const g = c.getContext("2d", { willReadFrequently: true });
                g.drawImage(img, 0, 0, 24, 24);
                t.data = g.getImageData(0, 0, 24, 24).data;
            } catch (_) { t.fail = true; }       // tainted (cross-origin) or undecodable: fall back to the box behind the photo
            thumbs.set(img, t);
        }
        if (t.fail) return null;
        const r = img.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        const cs = getComputedStyle(img);
        const nw = img.naturalWidth, nh = img.naturalHeight;
        const fit = cs.objectFit;
        const s = fit === "cover" ? Math.max(r.width / nw, r.height / nh) : fit === "contain" ? Math.min(r.width / nw, r.height / nh) : null;
        const dw = s ? nw * s : r.width, dh = s ? nh * s : r.height;
        const pos = (cs.objectPosition || "50% 50%").split(/\s+/);
        const frac = (p, free) => (p.endsWith("%") ? parseFloat(p) / 100 : free ? parseFloat(p) / free : 0.5);
        const ox = (r.width - dw) * frac(pos[0] || "50%", r.width - dw), oy = (r.height - dh) * frac(pos[1] || "50%", r.height - dh);
        const u = (x - r.left - ox) / dw, v = (y - r.top - oy) / dh;
        if (u < 0 || u > 1 || v < 0 || v > 1) return null;
        const i = (Math.min(23, Math.floor(v * 24)) * 24 + Math.min(23, Math.floor(u * 24))) * 4;
        return [t.data[i], t.data[i + 1], t.data[i + 2], t.data[i + 3] / 255];   // alpha kept: a transparent SVG / PNG pixel shows what is behind it
    };

    const colourAt = (x, y) => {
        const layers = [];
        for (const el of document.elementsFromPoint(x, y)) {
            if (wrap.contains(el)) continue;
            if (el.tagName === "IMG") {
                const c = imgColour(el, x, y);
                if (c && c[3] > 0 && parseFloat(getComputedStyle(el).opacity) > 0.5) { layers.push(c); if (c[3] >= 1) break; }
                continue;
            }
            const c = parseRGBA(getComputedStyle(el).backgroundColor);
            if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
        }
        return layers.reverse().reduce((under, top) => over(top, under), WHITE);   // nothing opaque found = the white page
    };

    let queued = false;
    const update = () => {
        queued = false;
        if (!phone.matches || getComputedStyle(wrap).display === "none") return;
        const r = pill.getBoundingClientRect();
        if (!r.width) return;
        const y = r.top + r.height / 2;
        const pts = [r.left + r.height / 2, r.left + r.width / 2, r.right - r.height / 2].map((x) => colourAt(x, y));
        const worst = (plate) => Math.min(...pts.map((c) => contrast(plate, c)));
        wrap.classList.toggle("is-on-dark", worst(WHITE) > worst(BRAND));
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    // content can move under the fixed pill WITHOUT a scroll event (reveals slide 5vh over .6s + a delay ladder, carousels, lazy images):
    // after the scroll settles, look again at 150 ms, 800 ms and 2.5 s
    let settle = [];
    const onScroll = () => {
        queue();
        settle.forEach(clearTimeout);
        settle = [150, 800, 2500].map((ms) => setTimeout(queue, ms));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", queue);
    window.addEventListener("load", queue);
    document.addEventListener("latte:ready", queue);
    queue();
}

/* Brown-meets-brown seam: #s-13-newsletter (brand band) gets .seam-above (base.css: 1px --colLineOnBrand inset hairline) when the rendered block
   before it paints (nearly) the same colour - contrast < 1.5:1. Runs on the home page and every sub-page; idempotent, re-run on latte:ready in
   case a page module swapped the closing band. */
function markSeams() {
    const run = () => {
        const nl = document.getElementById("s-13-newsletter");
        if (!nl) return;
        let prev = nl.previousElementSibling;
        while (prev && (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|LINK)$/.test(prev.tagName) || !prev.getClientRects().length)) prev = prev.previousElementSibling;
        if (!prev) { nl.classList.remove("seam-above"); return; }
        const paint = (el) => {                  // the opaque colour along the bottom edge of el: own background, else a full-width last child that reaches that edge, else the parent's
            for (let e = el, depth = 0; e && depth < 4; depth++) {
                const c = parseRGBA(getComputedStyle(e).backgroundColor);
                if (c && c[3] > 0) return c[3] >= 1 ? c : over(c, WHITE);
                let last = e.lastElementChild;
                while (last && !last.getClientRects().length) last = last.previousElementSibling;
                if (!last) break;
                const pr = e.getBoundingClientRect(), lr = last.getBoundingClientRect();
                if (lr.bottom < pr.bottom - 1 || lr.width < pr.width - 1) break;
                e = last;
            }
            for (let e = nl.parentElement; e; e = e.parentElement) { const c = parseRGBA(getComputedStyle(e).backgroundColor); if (c && c[3] >= 1) return c; }
            return WHITE;
        };
        const mine = parseRGBA(getComputedStyle(nl).backgroundColor);
        const same = !!mine && mine[3] >= 1 && contrast(paint(prev), mine) < 1.5;
        nl.classList.toggle("seam-above", same);
    };
    run();
    document.addEventListener("latte:ready", run);
}
