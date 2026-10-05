/* ==========================================================================
   06-menu - section module (file contract: export default function init(ctx))
   Engines (all ported in the foundation - spec 06 (d) "no bespoke code"):
     M10 word rise   h2.strip__title1 (menu__intro)                       - PZ _page-scroll.beautified.js:340-359 (core initSplitTitles)
     M11 reveals     three .strip__data.anima--bottom-in blocks            - PZ _page-scroll.beautified.js:554-568 (core initReveals)
     M18 stamp       .menu__spacer .strip--stamp (pseudo hidden by CSS while data-stamp="off"; the tween is harmless and
                     ready if the stamp is switched on)                     - PZ _page-scroll.beautified.js:992-1006 (core initStamps)
     M12-M15         food rail via initCarousel (fan-in, Splide loop/perPage ladder, hover zoom, arrows)
                                                                            - PZ _init-more.beautified.js:117-139, _splide.beautified.js:55-70,106-110 (carousel.js)
   Reduced motion / touch: handled inside the helpers (DD Pick 19 / Pick 6).
   ========================================================================== */
import { initSplitTitles, initReveals, initStamps } from "../core.js";
import { initCarousel as carouselFallback } from "../carousel.js";

export default function init(ctx = {}) {
    const root = document.getElementById("s-06-menu");
    if (!root) return null;                                        // section absent -> nothing to do (file contract)

    const initCarousel = typeof ctx.initCarousel === "function" ? ctx.initCarousel : carouselFallback;

    initSplitTitles(root);                                         // PS:340-359 (after document.fonts.ready - onReady)
    initReveals(root);                                             // PS:554-568
    initStamps(root);                                              // PS:992-1006

    const rail = root.querySelector(".menu__carousel .strip__gallery");
    const splide = rail ? initCarousel(rail, {}) : null;           // spec 06 (d) initCarousel(root.querySelector(".strip__gallery"))

    return { root, splide };
}
