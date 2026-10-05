/* ==========================================================================
   07-manifesto - colour-scrub sentence (build-C)
   Engine ported from the Iceberg "Sentence" component:
     IC = teardowns/2026-09-14-icebergdoc-org/source/js/D51_WxQ5.beautified.js:798-835 (setup), 810-829 (the tween)
   The `.from(".home-sentence__svg path", {drawSVG:0})` half of the timeline is DROPPED (no ellipse scribble - DD Pick 11).
   ctx contract: { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   ========================================================================== */
export default function init(ctx) {
    const root = document.getElementById("s-07-manifesto");
    if (!root) return;                                                   // section absent -> no-op (file contract)
    const content = root.querySelector(".manifesto__content");
    if (!content || content.dataset.init) return;                        // idempotent
    content.dataset.init = "manifesto";

    const { gsap, SplitText, reduceMotion } = ctx;
    if (!gsap || !SplitText) return;

    /* colour target: IC:825 "#ffffff" -> DD Pick 11 "end --colBianco" (SPEC 07 (d): read the token).
       BRAND 2026-09-17: the end colour is --colOnBrand (white on the accent band); --colBianco stays as the alias fallback */
    const rootStyle = getComputedStyle(document.documentElement);
    const white = (rootStyle.getPropertyValue("--colOnBrand") || "").trim() || (rootStyle.getPropertyValue("--colBianco") || "").trim() || "#ffffff";

    /* IC:810  e && e.selector && document.fonts.ready.then(function () { ... })  - split only after the display font is in */
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    return fontsReady.then(() => {
        if (!content.isConnected) return;
        /* IC:811-813  const t = new n(content, { type: "words" }), o = new n(t.words, { type: "chars", charsClass: "chars" })
           charsClass "char" per the shared selector registry (SPEC G6: `.manifesto__content .char`) */
        const words = new SplitText(content, { type: "words", wordsClass: "word" });
        const chars = new SplitText(words.words, { type: "chars", charsClass: "char" });
        content._split = { words, chars };

        if (reduceMotion) {                                              /* DD Pick 19 / s7: short-circuit to the end state (white) */
            gsap.set(chars.chars, { color: white });
            return;
        }

        /* IC:816-826 verbatim (minus the drawSVG .from at :827-829):
             a.timeline({ scrollTrigger: { trigger: content, start: () => "top 90%", end: () => "bottom 60%", scrub: .75 } })
              .to(o.chars, { color: "#ffffff", stagger: .1, ease: "none" }, .1)
           invalidateOnRefresh added for the function-valued start/end (M30 refresh policy). */
        gsap.timeline({
            scrollTrigger: {
                trigger: content,                                        // IC:818
                start: () => "top 90%",                                  // IC:819
                end: () => "bottom 60%",                                 // IC:820
                scrub: .75,                                              // IC:821
                invalidateOnRefresh: true                                // M30 (INFERRED for the source)
            }
        }).to(chars.chars, {
            color: white,                                                // IC:825 (#ffffff -> --colBianco)
            stagger: .1,                                                 // IC:826
            ease: "none"                                                 // IC:827
        }, .1);                                                          // IC:828 position .1
    });
}
