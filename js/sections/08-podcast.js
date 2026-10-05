/* ==========================================================================
   08-podcast - blurred glow marquee ticker (build-C)
   Engine ported from the Iceberg "BlurSentence" component:
     IC = teardowns/2026-09-14-icebergdoc-org/source/js/D51_WxQ5.beautified.js
          :282-305 setup + gsap.matchMedia({ isDesktop: "(min-width: 1025px)", isMobile: "(max-width: 1024px)" })
          :314-362 horizontalLoop helper (the public GSAP docs helper, transcribed with its documented names)
          :363-368 loop creation { paused, repeat -1, speed }   :369-380 play/pause ScrollTrigger
          :381-398 SplitText chars + per-char animation delay/duration + .is-animated toggle
          :505-510 <BlurSentence speed="3.5" speed-mobile="3"> (home-blur instance)
   Stamp (spacer row) and the paragraph reveal are foundation helpers (initStamps / initReveals via initAll).
   ctx contract: { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   ========================================================================== */
export default function init(ctx) {
    const root = document.getElementById("s-08-podcast");
    if (!root) return;                                                   // section absent -> no-op
    const { gsap, ScrollTrigger, SplitText, reduceMotion, isMouse } = ctx;
    const marquee = root.querySelector(".marquee");
    if (!marquee || marquee.dataset.init || !gsap || !ScrollTrigger) return;
    marquee.dataset.init = "marquee";
    const copies = gsap.utils.toArray(marquee.querySelectorAll(".marquee__copy"));   // IC:363 querySelectorAll(".blur-sentence__sentence")
    if (copies.length < 2) return;

    if (reduceMotion) return;                                            // DD Pick 9 / Pick 19: static white text, no loop, no glow (CSS end state)

    /* IC:304-305 isDesktop = "(min-width: 1025px)"; SPEC 08 (d)/(i): gate by width + pointer instead of the UA (INFERRED) */
    const isDesktop = window.matchMedia("(min-width: 1025px)").matches && isMouse;
    const speed = isDesktop ? 3.5 : 3;                                   // IC:509-510 speed 3.5 / speed-mobile 3  (-> 350 / 300 px/s, IC:333 p = 100*speed)

    /* IC:363-368  r = horizontalLoop(copies, { paused: !0, repeat: -1, speed: i ? t.speed : t.speedMobile }) */
    const loop = horizontalLoop(gsap, copies, { paused: true, repeat: -1, speed });
    marquee._loop = loop;

    /* UPDATE-3 (2026-09-17, client decision): NO visible pause / play control. The loop and the glow run only while the row is on screen
       (the two in-view triggers below) and never under reduced motion (the early return above leaves the static CSS end state). */

    /* IC:369-380  play while in view */
    ScrollTrigger.create({
        trigger: marquee,                                                // IC:370 (u.value = the .blur-sentence wrapper)
        start: "top bottom",                                             // IC:371
        end: "bottom top",                                               // IC:372
        endTrigger: marquee,                                             // IC:373
        invalidateOnRefresh: true,                                       // IC:374
        onToggle: (e) => (e.isActive ? loop.play() : loop.pause())       // IC:375-377
        // IC:378-380 onUpdate: e => { e.getVelocity() } - no-op in the source, dropped
    });

    /* IC:381-387  new SplitText(copies, { type: "chars", charsClass: "chars" }).chars.forEach((el, i) => { delay .4*i s, duration 4s })
       charsClass "char" per the shared selector registry (SPEC G6 `.marquee .char`) */
    if (SplitText) {
        const split = new SplitText(copies, { type: "chars", charsClass: "char", aria: "none" });   // copies are aria-hidden; the sr text is the .visual-hide <p>
        split.chars.forEach((el, i) => {
            el.style.animationDelay = .4 * i + "s";                      // IC:386
            el.style.animationDuration = "4s";                           // IC:386
        });
        marquee._split = split;
    }

    /* IC:388-397  gsap.timeline({ scrollTrigger: { trigger, start "top bottom", end "bottom top", endTrigger, onToggle: e => o.value = e.isActive } })
       o.value drives the `.is-animated` class binding on both copies (glow keyframes only run while the row is in view) */
    ScrollTrigger.create({
        trigger: marquee,                                                // IC:390
        start: "top bottom",                                             // IC:391
        end: "bottom top",                                               // IC:392
        endTrigger: marquee,                                             // IC:393
        onToggle: (e) => copies.forEach((c) => c.classList.toggle("is-animated", e.isActive))   // IC:394-396 (copies .is-animated = e.isActive)
    });
}

/* --------------------------------------------------------------------------
   horizontalLoop - IC:314-362 (= the GSAP docs "seamless loop" helper: https://gsap.com/docs/v3/HelperFunctions/helpers/seamlessLoop)
   Transcribed line for line with the documented variable names (the bundle's minified names are e/t/o/r/s/a/n/i/c/d/p/_/u/m/g/h/v/b).
   -------------------------------------------------------------------------- */
function horizontalLoop(gsap, items, config) {
    items = gsap.utils.toArray(items);                                   // IC:318
    config = config || {};                                               // IC:318
    const tl = gsap.timeline({                                           // IC:319-326
        repeat: config.repeat,
        paused: config.paused,
        defaults: { ease: "none" },
        onReverseComplete: () => tl.totalTime(tl.rawTime() + 100 * tl.duration())
    });
    const length = items.length;                                         // IC:327
    const startX = items[0].offsetLeft;                                  // IC:328
    const times = [];                                                    // IC:329
    const widths = [];                                                   // IC:330
    const xPercents = [];                                                // IC:331
    let curIndex = 0;                                                    // IC:332
    const pixelsPerSecond = 100 * (config.speed || 1);                   // IC:333  p = 100 * (t.speed || 1)
    const snap = config.snap === false ? (v) => v : gsap.utils.snap(config.snap || 1);   // IC:334
    let totalWidth, curX, distanceToStart, distanceToLoop, item, i;      // IC:335
    gsap.set(items, {                                                    // IC:336-341  xPercent from the current x so the loop starts where the item is
        xPercent: (i, el) => {
            const w = (widths[i] = parseFloat(gsap.getProperty(el, "width", "px")));
            xPercents[i] = snap((parseFloat(gsap.getProperty(el, "x", "px")) / w) * 100 + gsap.getProperty(el, "xPercent"));
            return xPercents[i];
        }
    });
    gsap.set(items, { x: 0 });                                           // IC:341-343
    totalWidth = items[length - 1].offsetLeft + (xPercents[length - 1] / 100) * widths[length - 1] - startX   // IC:343
        + items[length - 1].offsetWidth * gsap.getProperty(items[length - 1], "scaleX") + (parseFloat(config.paddingRight) || 0);
    for (i = 0; i < length; i++) {                                       // IC:343-352
        item = items[i];
        curX = (xPercents[i] / 100) * widths[i];
        distanceToStart = item.offsetLeft + curX - startX;
        distanceToLoop = distanceToStart + widths[i] * gsap.getProperty(item, "scaleX");
        tl.to(item, { xPercent: snap(((curX - distanceToLoop) / widths[i]) * 100), duration: distanceToLoop / pixelsPerSecond }, 0)
          .fromTo(item, { xPercent: snap(((curX - distanceToLoop + totalWidth) / widths[i]) * 100) },
                        { xPercent: xPercents[i], duration: (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond, immediateRender: false },
                        distanceToLoop / pixelsPerSecond)
          .add("label" + i, distanceToStart / pixelsPerSecond);
        times[i] = distanceToStart / pixelsPerSecond;
    }
    function toIndex(index, vars) {                                      // IC:354-360
        vars = vars || {};
        Math.abs(index - curIndex) > length / 2 && (index += index > curIndex ? -length : length);
        const newIndex = gsap.utils.wrap(0, length, index);
        let time = times[newIndex];
        if (time > tl.time() !== index > curIndex) {
            vars.modifiers = { time: gsap.utils.wrap(0, tl.duration()) };
            time += tl.duration() * (index > curIndex ? 1 : -1);
        }
        curIndex = newIndex;
        vars.overwrite = true;
        return tl.tweenTo(time, vars);
    }
    tl.next = (vars) => toIndex(curIndex + 1, vars);                     // IC:361
    tl.previous = (vars) => toIndex(curIndex - 1, vars);
    tl.current = () => curIndex;
    tl.toIndex = (index, vars) => toIndex(index, vars);
    tl.times = times;
    tl.progress(1, true).progress(0, true);                              // IC:361 pre-render for performance
    if (config.reversed) { tl.vars.onReverseComplete(); tl.reverse(); } // IC:361
    return tl;                                                           // IC:362
}
