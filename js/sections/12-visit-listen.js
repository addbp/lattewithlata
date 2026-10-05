/* ==========================================================================
   12-visit-listen - Twin cards over a slowly translating room photo (BUILD-SPEC M24)
   Engine ported from IC = teardowns/2026-09-14-icebergdoc-org/source/js/D51_WxQ5.beautified.js:1335-1370
   (Vue component "home-podcast-bottom": gsap.matchMedia with isDesktop/isTablet/isMobile, two scrubbed timelines).
   ctx = { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   ========================================================================== */
export default function init(ctx) {
    const root = document.getElementById("s-12-visit-listen");
    if (!root) return;
    const { gsap, reduceMotion, mm } = ctx;

    const bg = root.querySelector(".twin-cards__bg img");           // IC:1345  t.selector(".home-podcast-bottom__bg img")[0]
    const card = root.querySelector(".twin-card--listen");          // IC:1359  t.selector(".home-podcast-bottom__card--blur")[0]
    if (!bg) return;

    // DD Pick 19 / spec 12 (d): reduced motion -> end state, no triggers (photo and card at rest)
    if (reduceMotion) {
        gsap.set(bg, { yPercent: 0 });
        if (card) gsap.set(card, { yPercent: 0 });
        return;
    }

    // IC:1334-1337  n.matchMedia().add({ isDesktop:"(min-width: 1025px)", isTablet:"(min-width: 769px)", isMobile:"(max-width: 768px)" }, ...)
    // same numbers in em: 1025px = 64.0625em, 769px = 48.0625em, 768px = 48em (spec 12 (d))
    mm.add({
        isDesktop: "(min-width: 64.0625em)",
        isTablet: "(min-width: 48.0625em)",
        isMobile: "(max-width: 48em)"
    }, (c) => {
        const { isDesktop: o, isTablet: s } = c.conditions;    // IC:1339-1343

        gsap.timeline({                                         // IC:1346-1352
            scrollTrigger: {
                trigger: root,                                  // IC:1348  trigger: a.value (the section)
                start: () => "top bottom",                      // IC:1349
                end: () => "bottom top",                        // IC:1350
                scrub: .1,                                      // IC:1351
                invalidateOnRefresh: true                       // brief "register scrubbed tweens with invalidateOnRefresh" - INFERRED (not in the source)
            }
        }).fromTo(bg, { yPercent: -40 }, {                      // IC:1353-1354
            yPercent: o ? 40 : 30,                              // IC:1356
            ease: "none"                                        // IC:1357
        });

        if ((o || s) && card) {                                 // IC:1358  o || s  (desktop + tablet only; the phone gets no card tween)
            gsap.timeline({                                     // IC:1360-1366
                scrollTrigger: {
                    trigger: root,                              // IC:1362
                    start: () => "top bottom",                  // IC:1363
                    end: () => "bottom top",                    // IC:1364
                    scrub: .1,                                  // IC:1365
                    invalidateOnRefresh: true                   // INFERRED (see above)
                }
            }).from(card, {
                yPercent: o ? -50 : 40,                         // IC:1368
                ease: "none"                                    // IC:1369
            });
        }
        // IC:1371-1380 texture tween DROPPED (no texture image - spec 12 (a))
    });
}
