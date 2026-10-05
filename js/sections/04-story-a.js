/* ==========================================================================
   04-story-a - section module (file contract: export default function init(ctx))
   Engines (all ported in the foundation - spec 04 (d) "nothing bespoke"), in Paszkowski's init order (PS = _page-scroll.beautified.js):
     M10 word rise   h2.strip__title1 -> SplitText words; fromTo yPercent 110 -> 0, opacity 1, stagger .05, delay .1, 1.2s
                     power2.inOut, start "top bottom-=50px", toggleActions "play none none reset"   - PS:340-359 (core initSplitTitles)
     M11 reveals     .strip__column--1.anima--left-in / --2.anima--right-in class flip                - PS:554-568 (core initReveals)
     M18 stamp       .strip__column--1.strip--stamp: --stamp-y -25% -> 25%, start "top bottom", end "top top", scrub .75
                                                                                                     - PS:992-1006 (core initStamps)
     M16 zoom-settle .js-image-anime -> each .strip__image img: gsap.from {scale 1.2, yPercent -40}, trigger = the column,
                     start "top min(offsetTop/innerHeight*100,100)%", end "bottom top", scrub 1     - PS:1031-1046 (core initImageAnime)
                     (loading="lazy" stripped first - PS:143-145; the fragment ships loading="eager" anyway)
   Reduced motion: each helper gsap.set()s its end state / skips its trigger (DD Pick 19).
   ========================================================================== */
import { initSplitTitles, initReveals, initStamps, initImageAnime } from "../core.js";

export default function init(ctx = {}) {
    const root = document.getElementById("s-04-story-a");
    if (!root) return null;                                        // section absent -> nothing to do (file contract)

    initSplitTitles(root);                                         // PS:340-359 (must run after document.fonts.ready - onReady does)
    initReveals(root);                                             // PS:554-568
    initStamps(root);                                              // PS:992-1006
    initImageAnime(root);                                          // PS:1031-1046

    return { root };
}
