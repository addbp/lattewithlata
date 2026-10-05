/* ==========================================================================
   11-live - Live sessions mosaic
   Phase 1 (default): static mosaic; the quote row is a class-flip reveal (.anima--fade) handled by core initReveals.
   Phase 2 (data-zoom-splash="on" on #s-11-live): pinned zoom-splash timeline ported verbatim from
     PS = teardowns/2026-09-14-caffepaszkowski-com/source/js/modules/_page-scroll.beautified.js:949-991
   ctx = { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   ========================================================================== */
import { initReveals } from "../core.js";   // idempotent (data-init="reveal"); safe if the integrator also calls initAll()

export default function init(ctx) {
    const root = document.getElementById("s-11-live");
    if (!root) return;
    const { gsap, ScrollTrigger, reduceMotion } = ctx;

    // Phase 1: the quote row reveal (M11) - core owns the mechanism; called here so the section works standalone.
    initReveals(root);

    const stage = root.querySelector(".live__stage");
    const phase2 = root.getAttribute("data-zoom-splash") === "on";
    if (!phase2 || !stage) return;

    /* ---- Phase 2: PS:949-991 (jQuery -> DOM) ---- */
    if (reduceMotion) {                                    // DD Pick 19/20: reduced motion -> Phase 1 rendering
        root.removeAttribute("data-zoom-splash");
        return;
    }
    const e = stage;                                       // PS:950  e = $(this)  (the .js-zoom-splash element)
    const r = Array.from(e.querySelectorAll(".strip"));    // PS:951  r = e.find(".strip")  -> [row-left, centre, row-right]
    const i = e.querySelector(".strip--image .strip__image");   // PS:952
    const s = e.querySelector(".strip--image .strip__text");    // PS:953 (the caption)
    if (!i || !s) return;
    const o = r.indexOf(i.closest(".strip"));              // PS:954
    const n = i.querySelectorAll("img");                   // PS:955
    const a = r.filter((el, idx) => idx < o).flatMap((el) => Array.from(el.querySelectorAll("img")));   // PS:956
    const c = r.filter((el, idx) => idx > o).flatMap((el) => Array.from(el.querySelectorAll("img"))).reverse();   // PS:957
    s.hidden = false;                                      // the caption markup is hidden in Phase 1 (spec 11 (b))
    const strips = Array.from(document.querySelectorAll(".strip"));
    const offsetTop = () => e.getBoundingClientRect().top + window.pageYOffset;   // e.offset().top

    gsap.timeline({
        scrollTrigger: {
            trigger: e,                                    // PS:961
            start: () => "top top",                        // PS:962
            end: () => "+=" + 2 * window.innerHeight,      // PS:963
            pin: true,                                     // PS:964
            refreshPriority: 1000 - 10 * strips.indexOf(e),   // PS:965  f - 10 * g.index(e)
            invalidateOnRefresh: true,                     // PS:966
            scrub: true                                    // PS:967
        }
    })
    .to(i, {
        clipPath: () => {                                  // PS:970-973 verbatim
            const t = i.getClientRects()[0];
            const top = offsetTop();
            return `inset(-${Math.abs(t.y - top)}px -${Math.abs(window.innerWidth - (t.x + t.width))}px -${Math.abs(window.innerHeight - (t.y - top + t.height))}px -${t.x}px)`;
        },
        "--screenOpacity": .5,                             // PS:974
        duration: 2                                        // PS:975
    }, "start")
    .to(s, { opacity: 1, scale: 1, duration: 2 }, "start+=.2")   // PS:976-980
    .to(n, { scale: 1, duration: 1.5 }, "start")           // PS:980-983
    .to(a, { xPercent: -75, stagger: .1, duration: 1.5 }, "start")   // PS:983-987
    .to(c, { xPercent: 75, stagger: .1, duration: 1.5 }, "start");   // PS:987-991

    // DD Pick 20 / build-analysis Notes: plain refresh after the mosaic images decode (never refresh(true))
    const imgs = Array.from(e.querySelectorAll("img"));
    Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))
        .then(() => ScrollTrigger.refresh());
}
