/* ==========================================================================
   09-episodes - episodes carousel: Paszkowski rail (carousel.js) + Iceberg project-card hover lines (build-C)
   Engines:
     IC = teardowns/2026-09-14-icebergdoc-org/source/js/D51_WxQ5.beautified.js (ProjectCard component)
          :913-921 mouseenter f(e): gsap.to(card.querySelectorAll(".line"), { y: 0, opacity: 1, duration: .4, stagger: .05, ease: "power2.out" })
          :922-932 mouseleave x(e): gsap.to(lines, { opacity: 0, duration: .4, onComplete: () => gsap.set(lines, { clearProps: "all" }) })
          :936-941 gsap.utils.toArray(".project-card__impact").forEach(e => new SplitText(e, { type: "lines", linesClass: "line" }))
          :946     onMouseenter: f, onMouseleave: x   (bound on the card root)
     PZ = rail via carousel.js: M13 Splide (_splide.beautified.js:55-127), M12 fan-in (_init-more.beautified.js:117-139),
          M14/M15 hover zoom + arrows (CSS), M11 reveals (_page-scroll.beautified.js:554-568, core initReveals)
   ctx contract: { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   Idempotent (root.dataset.init); returns early when the section is absent.
   ========================================================================== */
import { initReveals } from "../core.js";                                   // M11 on .anima--bottom-in wrappers (idempotent: initAll() may run it again)
import { initCarousel as initCarouselFallback } from "../carousel.js";     // used only if the integrator's ctx lacks initCarousel

export default function init(ctx = {}) {
    const root = document.getElementById("s-09-episodes");
    if (!root) return null;                                                 // section absent -> nothing to do (file contract)
    if (root.dataset.init) return root._episodes || null;                   // idempotent
    root.dataset.init = "episodes";

    const { gsap, ScrollTrigger, SplitText, reduceMotion, isMouse } = ctx;
    const initCarousel = ctx.initCarousel || initCarouselFallback;
    const rail = root.querySelector(".strip__gallery");

    initReveals(root);                                                      // PS:554-568 - .anima--bottom-in on the rail wrapper and the CTA row

    /* 1. the rail - carousel.js: Splide {type loop, perPage from data-splide-sizes {"all":1,"576":2,"800":3} (DD Pick 6 "Change"),
          gap 1em, speed 2000, arrows (sprite) hover-only on is-mouse, pagination false} + fan-in (w+gap)*(1-i) -> x:0, 1s power1.out
          at start "bottom bottom" (IM:117-139). Skipped under reduceMotion inside carousel.js. */
    const splide = rail ? initCarousel(rail) : null;
    const state = { root, rail, splide, splits: [], lines: false };
    root._episodes = state;

    /* 2. hover lines - IC (pointer:fine) only: html.is-mouse (DD Pick 19). Touch and reduced motion keep the blurb visible (DD Pick 8 "Change"). */
    if (!rail || !isMouse || reduceMotion || !gsap || !SplitText) return state;
    state.lines = true;
    root.classList.add("episodes--lines");                                  // CSS gate for .line { opacity:0; translateY(50%) } (IC inline-scoped:2211-2215)

    const blurbs = () => Array.from(rail.querySelectorAll(".episode-card__blurb"));

    /* IC:936-941 - one SplitText({type:"lines", linesClass:"line"}) per blurb. Runs on the originals AND the Splide clones
       (clones are DOM copies made at mount / refresh, so they need their own split and carry no instance). */
    function splitAll() {
        revertAll();
        blurbs().forEach((el) => {
            if (!el.dataset.text) el.dataset.text = el.textContent.trim();  // keep the plain copy: clones of an already split blurb carry stale .line markup
            else el.textContent = el.dataset.text;
            const split = new SplitText(el, { type: "lines", linesClass: "line" });   // IC:938-940
            el.classList.add("is-split");
            state.splits.push(split);
        });
    }
    function revertAll() {
        state.splits.forEach((s) => { try { s.revert(); } catch (e) { /* element gone (clone regenerated) */ } });
        state.splits = [];
        blurbs().forEach((el) => el.classList.remove("is-split"));
    }

    /* IC:913-932 - hover in / out on the card root */
    const enter = (card) => {
        gsap.to(card.querySelectorAll(".line"), { y: 0, opacity: 1, duration: .4, stagger: .05, ease: "power2.out" });   // IC:915-920
    };
    const leave = (card) => {
        const lines = card.querySelectorAll(".line");
        gsap.to(lines, { opacity: 0, duration: .4, onComplete: () => { gsap.set(lines, { clearProps: "all" }); } });      // IC:924-931
    };
    /* bound once on the rail in the capture phase so the Splide clones (regenerated on refresh) are covered too - INFERRED delegation */
    rail.addEventListener("mouseenter", (e) => { const t = e.target; if (t instanceof Element && t.matches(".episode-card")) enter(t); }, true);
    rail.addEventListener("mouseleave", (e) => { const t = e.target; if (t instanceof Element && t.matches(".episode-card")) leave(t); }, true);
    /* keyboard parity: focus entering / leaving a card = hover (INFERRED, DD s7 accessibility) */
    rail.addEventListener("focusin", (e) => { const c = e.target.closest && e.target.closest(".episode-card"); if (c && !(e.relatedTarget && c.contains(e.relatedTarget))) enter(c); });
    rail.addEventListener("focusout", (e) => { const c = e.target.closest && e.target.closest(".episode-card"); if (c && !(e.relatedTarget && c.contains(e.relatedTarget))) leave(c); });

    /* split after the display/body fonts are in (line breaks depend on them - IC splits at hydration, i.e. after fonts in practice) */
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    fontsReady.then(() => { if (root.isConnected) splitAll(); });

    /* re-split when the layout changes: every ScrollTrigger.refresh() (resize, image decode, refreshCarousels() after Splide re-clones) - SPEC 09 (d) */
    if (ScrollTrigger) {
        ScrollTrigger.addEventListener("refreshInit", revertAll);
        ScrollTrigger.addEventListener("refresh", splitAll);
    }
    return state;
}
