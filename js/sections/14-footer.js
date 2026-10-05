/* ==========================================================================
   14-footer - curtain reveal (M26), back-to-top ride + click (M27), stamp at the seam (M18 via core initStamps)
   Sources: IM = teardowns/2026-09-14-caffepaszkowski-com/source/js/modules/_init-more.beautified.js:101-115 (initFooterAnimation)
            PS = .../modules/_page-scroll.beautified.js:22 (u = footer .js-scroll-top-limit), :284-296 (ride)
            AN = .../modules/_anchor.beautified.js:4-17 (goToAnchor: gsap.to(scroller, { scrollTo: { y } }))
   ctx = { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   Fragment root is <footer id="page-footer">; #back-to-top and aside.footer__stamp are its children.
   ========================================================================== */
import { initStamps } from "../core.js";   // idempotent (data-init="stamp"); safe if the integrator also calls initAll()

export default function init(ctx) {
    const footer = document.getElementById("page-footer");
    if (!footer) return;
    const { gsap, reduceMotion } = ctx;

    const container = footer.querySelector(".footer__container");   // IM:102  document.querySelector(".footer__container")
    const limit = footer.querySelector(".js-scroll-top-limit");     // PS:22   u = np_root.page.footer.find(".js-scroll-top-limit")
    const top = document.getElementById("back-to-top");
    const topLink = top && top.querySelector("a");

    /* ---- M18 stamp on the seam (aside.footer__stamp) - core owns the mechanism (PS:992-1006) ---- */
    initStamps(footer);

    /* ---- click: AN:4-17 goToAnchor -> gsap.to(scrollParent, { scrollTo: { y: target.offset().top - (headerH + delta) } }) (default .5s)
            rebuild: the target is the page top -> scrollTo y 0 (spec 14 (d)); reduced motion -> native jump ---- */
    if (topLink) {
        topLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (reduceMotion || !gsap.plugins || !gsap.plugins.scrollTo) {
                window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                return;
            }
            gsap.to(window, { scrollTo: { y: 0 } });                // AN:12-14 l.scrollTo = { y }, gsap.to(r, l) - duration = gsap default .5s
        });
    }

    /* ---- "Photo credits" (PAGES-SPEC 3: the legal link goes to contact.html#credits). The register itself still ships in every footer as
            <details id="footer-credits"> (the CC BY / CC BY-SA credits are "not optional" - verify/handoff/assets.md). Fallback so the link never
            dead-ends: on a page with NO #credits block of its own (the contact lane owns that id), a #credits hash - on load or on a same-page
            click - opens the footer disclosure and scrolls to it. INFERRED, keyboard / hash friendly. ---- */
    const credits = footer.querySelector("#footer-credits");
    if (credits) {
        const showCredits = () => {
            if (location.hash !== "#credits" || document.getElementById("credits")) return;
            credits.open = true;
            credits.scrollIntoView({ block: "center", behavior: "auto" });
            const summary = credits.querySelector("summary");
            if (summary) summary.focus({ preventScroll: true });
        };
        window.addEventListener("hashchange", showCredits);
        window.addEventListener("load", () => setTimeout(showCredits, 0), { once: true });
        if (document.readyState === "complete") showCredits();
    }

    /* ---- reduced motion: PS:284 returns before the ride; the curtain sits at its end state (DD Pick 19 / spec 14 (d)) ---- */
    if (reduceMotion) {
        if (container) gsap.set(container, { yPercent: 0 });
        if (top) gsap.set(top, { y: 0 });
        return;
    }

    /* ---- M26 curtain - IM:101-115 (verbatim, jQuery-free) ---- */
    if (container) {
        gsap.fromTo(container, {
            yPercent: -50                                           // IM:103
        }, {
            yPercent: 0,                                            // IM:105
            ease: "linear",                                         // IM:106
            scrollTrigger: {
                trigger: container,                                 // IM:108
                start: () => "top bottom",                          // IM:109
                end: () => "clamp(top top)",                        // IM:110 (clamps to the max scroll - GSAP 3.12+)
                scrub: true,                                        // IM:111
                refreshPriority: -20,                               // IM:112 (refreshes after every section trigger)
                invalidateOnRefresh: true                           // IM:113
            }
        });
    }

    /* ---- M27 ride - PS:285-296: gsap.to(".scroll-top", { y: -(limit.outerHeight() + parent padding-bottom), ease:"none",
            scrollTrigger: { trigger: limit, start:"top bottom", end:`bottom+=${pad} bottom`, scrub:true, refreshPriority:-10, invalidateOnRefresh:true } }) ---- */
    if (top && limit) {
        const pad = () => parseInt(getComputedStyle(limit.parentElement).paddingBottom, 10) || 0;   // PS:286, 292  u.parent().css("padding-bottom") || 0
        gsap.to(top, {
            y: () => -1 * (limit.offsetHeight + pad() + 0),         // PS:286  u.outerHeight() = offsetHeight
            ease: "none",                                           // PS:287
            scrollTrigger: {
                trigger: limit,                                     // PS:290
                start: () => "top bottom",                          // PS:291
                end: () => `bottom+=${pad()} bottom`,               // PS:292
                scrub: true,                                        // PS:293
                refreshPriority: -10,                               // PS:294
                invalidateOnRefresh: true                           // PS:295
            }
        });
    }
}
