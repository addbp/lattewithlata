/* ==========================================================================
   03-gallery - section module (file contract: export default function init(ctx))
   Engines (all ported in the foundation, nothing bespoke here - spec 03 (d)):
     M12 fan-in   items x = (clientWidth + marginRight) * (1 - i) -> x:0, 1s power1.out, trigger rail, start "bottom bottom",
                  toggleActions "play none none reverse"           - PZ _init-more.beautified.js:117-139 (carousel.js initCarousel)
     M13 Splide   type loop, perPage from data-splide-sizes {"all":2,"576":3,"800":3}, perMove = perPage, gap 1em (slide
                  margin-right), speed 2000, arrows true, pagination false, mediaQuery "min"
                                                                    - PZ _splide.beautified.js:55-70, 106-110 (carousel.js)
     M14 hover zoom / M15 arrows                                    - CSS, base.css s12 (_strip_site.scss:182-191, main.1:291-355)
     M11 reveal   .strip__data.anima--fade -> .waiting/.animated at start "top bottom-=min(h/4,100)px", reset onLeaveBack
                                                                    - PZ _page-scroll.beautified.js:554-568 (core.js initReveals)
   Reduced motion: carousel.js skips the fan-in, core sets .animated immediately (DD Pick 19). Touch: base.css keeps the
   arrows visible (.is-touch .splide__arrow { opacity:1 }, DD Pick 6 "Change").
   Idempotent: core/carousel mark elements in data-init, so the integrator's initAll() after this is a no-op for this section.
   ========================================================================== */
import { initReveals } from "../core.js";
import { initCarousel as carouselFallback } from "../carousel.js";

export default function init(ctx = {}) {
    const root = document.getElementById("s-03-gallery");
    if (!root) return null;                                        // section absent -> nothing to do (file contract)

    const initCarousel = typeof ctx.initCarousel === "function" ? ctx.initCarousel : carouselFallback;

    initReveals(root);                                             // M11 on .strip__data.anima--fade (PS:554-568)

    const rail = root.querySelector(".strip__gallery");
    const splide = rail ? initCarousel(rail, {}) : null;           // M12 + M13 (+ sprite arrows) - spec 03 (d) "initCarousel(..., {})"

    return { root, splide };
}
