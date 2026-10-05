/* ==========================================================================
   02-intro - title word rise (M10) + paragraph class-flip reveal (M11)
   Both engines live in core.js (foundation) and are called here so the section is self-sufficient even when the
   integrator's initAll() runs later - every core init is idempotent (data-init tokens), so the double call is a no-op.
   Sources: PS = PZ/source/js/modules/_page-scroll.beautified.js
     M10 PS:340-359  gsap.fromTo(words, {yPercent:110}, {opacity:1, yPercent:0, rotation:0, stagger:.05, delay:.1, duration:1.2,
                     ease:"power2.inOut", scrollTrigger:{trigger: h1, start:"top bottom-=50px", toggleActions:"play none none reset"}})
                     -> core.initSplitTitles (SplitText words + span.word-wrapper masks, base.css s9)
     M11 PS:554-568  .waiting -> .animated at "top bottom-=min(h/4,100)px", back to .waiting on leave-back at "top bottom"
                     -> core.initReveals (CSS: .waiting.anima--bottom-in = translate3d(0,5vh,0) + opacity 0, .6s cubic-bezier(.645,.045,.355,1))
   Reduced motion: core sets the end states (gsap.set words yPercent 0 / .animated immediately) - DD Pick 5 / Pick 19.
   ctx = { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel } (unused here: core owns the tweens)
   ========================================================================== */
import { initSplitTitles, initReveals } from "../core.js";

export default function init(ctx) {                                        // eslint-disable-line no-unused-vars
    const root = document.getElementById("s-02-intro");
    if (!root) return;
    initSplitTitles(root);                                                  // M10 on #s-02-intro h1.strip__title1 (runtime ST start = h1 docY - (innerHeight - 50): 108 @1440x900 per BUILD-SPEC 02 (d))
    initReveals(root);                                                      // M11 on #s-02-intro .strip__data.anima--bottom-in
    return root;
}
