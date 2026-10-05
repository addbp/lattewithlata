/* ==========================================================================
   05-strip - section module (file contract: export default function init(ctx))
   Engines (ported in the foundation - spec 05 (d)):
     M17 window parallax  .parallax inside .strip--image: img y 0 -> box.h - img.h (= -292.5 @1440x900), trigger = the figure,
                          start "top min(img.offsetTop/innerHeight*100,100)%" (= "top 100%"), end "bottom top", scrub true,
                          invalidateOnRefresh                        - PZ _page-scroll.beautified.js:360-380 (core initParallaxStrips)
     M18 stamp            .strip__data.strip--stamp: --stamp-y -25% -> 25%, start "top bottom", end "top top", scrub .75
                                                                     - PZ _page-scroll.beautified.js:992-1006 (core initStamps)
   Ease: neither tween sets one -> GSAP default power1.out (measured fit, INFERRED in build-analysis effect 8 / spec 05 (d)).
   Reduced motion: parallax skipped (image rests at y 0 inside the 65vh window), --stamp-y 0.
   ========================================================================== */
import { initStamps, initParallaxStrips } from "../core.js";

export default function init(ctx = {}) {
    const root = document.getElementById("s-05-strip");
    if (!root) return null;                                        // section absent -> nothing to do (file contract)

    initStamps(root);                                              // PS:992-1006
    initParallaxStrips(root);                                      // PS:360-380 (o = -1 branch)

    return { root };
}
