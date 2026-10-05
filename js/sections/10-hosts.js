/* ==========================================================================
   10-hosts - section module (file contract: export default function init(ctx))
   Every engine of this row is a foundation helper (spec 10 (d): M10, M16, M18 + M11), called here in Paszkowski's init order so the
   section is self-sufficient; all four are idempotent (data-init marks), so the integrator's initAll() is a no-op on this root.
   PS = teardowns/2026-09-14-caffepaszkowski-com/source/js/modules/_page-scroll.beautified.js
     M10 word rise    h2.strip__title1 -> SplitText words in span.word-wrapper; fromTo yPercent 110 -> 0, opacity 1, stagger .05, delay .1,
                      1.2s power2.inOut, start "top bottom-=50px", toggleActions "play none none reset"          - PS:28, 149-153, 340-359 (core initSplitTitles)
     M11 reveals      col1 .anima--left-in / col2 .anima--right-in class flip .waiting -> .animated (col2 +.5s)  - PS:554-568 (core initReveals)
                      (rendered.html [280]/[281] carry these classes - kept although spec 10 (d) says "no anima--")
     M18 stamp        col1 .strip--stamp: --stamp-y -25% -> 25%, start "top bottom", end "top top", scrub .75    - PS:992-1006 (core initStamps)
                      (the mark itself is display:none in 10-hosts.css - DD Pick 13 four-instance cap; the tween is harmless)
     M16 zoom-settle  .js-image-anime -> .strip__image img: gsap.from {scale 1.2, yPercent -40}, trigger = the column,
                      start "top min(offsetTop/innerHeight*100,100)%" (= "top 100%" below the fold), end "bottom top", scrub 1
                      loading="lazy" stripped first (PS:143-145)                                                  - PS:1031-1046 (core initImageAnime)
                      Runtime note (spec 10 (d)): the source tween never completed because its page ended at 8705; here 11-14 follow, so
                      "bottom top" is reachable and no end clamp is needed.
   Reduced motion: each helper gsap.set()s its end state / skips its trigger (DD Pick 19).

   UPDATE-3 2026-09-17 (lane L2 HOST PHOTO) - the client's podcast photograph (assets/images/founder-podcast.jpg, 4:5 crop of
   assets/brand/lata-singh-podcast.jpg):
     DELIBERATE EXCEPTION to M16 for ONE image - the host photo in column 1. Same trigger, start, scrub and refreshPriority as
     core.initImageAnime, but (1) the tween starts at scale 1.06 / yPercent 0 about the BOTTOM centre (PORTRAIT_FROM / PORTRAIT_ORIGIN)
     instead of 1.2 / -40 about the centre: a 1.2 zoom would crop her head and push the real microphone and the latte under the frame
     layers. About the bottom centre with yPercent 0 the bottom edge never moves, so (fractions of the photo box) the hair top goes
     17.6% -> 12.7% (never cropped), the saucer's left edge 3.7% -> 0.9% (never cropped) and the mic base 94.1% -> 93.8% (moves up, away
     from the lower third that starts at 96.5%). yPercent must stay 0: any lift opens a gap under the photo, any drop crops the saucer.
     (2) it ENDS at "top 25%" (PORTRAIT_END) instead of "bottom top": the trigger is column 1, which is as tall as the text column
     (1588px @1440), so with the stock end the photo would still be at ~1.04 while she is read - the neon "Good Conversations" sign and the
     chalkboard's first word would stay trimmed under the ON AIR tab. Ending when the column top reaches a quarter of the viewport, the
     photo is at rest (scale 1 = the delivered crop) once it is on screen. (The office portrait used the same end for its 3% headroom.)
     Column 1 is still claimed here (data-init "anime") BEFORE the core sweep so core never adds its 1.2 tween to it; if the core got there
     first, its tween on the photo is killed and replaced. Column 2 (the recording-corner photo) keeps the stock M16 through core.initImageAnime.
     Trigger count of the row is unchanged: split 1 + reveals 4 + stamp 1 + image-anime 2 = 8.

     DROP-IN SLOT: figure.hosts__stage[data-podcast-photo] = "assets/images/founder-podcast.jpg" (the same URL as the <img>, so the Image()
     probe is served from the memory cache - one request). On load the figure image is (re)set to it (4:5 cover, optional
     data-podcast-focus = object-position) and the stage gets .hosts__stage--photo (state hook); on error the markup photo stays and
     data-podcast-photo-missing="true" is set. Empty attribute = no probe at all.

     Overlay loops (CSS) are paused while their block is off screen: .hosts__stage--idle (ON AIR pulse + level meter) and
     .hosts__byline--idle (the steam over the branded cup, which now heads the byline in column 2), IntersectionObserver, 80px margin.
   ========================================================================== */
import { initSplitTitles, initReveals, initStamps, initImageAnime } from "../core.js";

const PORTRAIT_FROM = { scale: 1.06, yPercent: 0 };                 // core M16 = { scale: 1.2, yPercent: -40 }
const PORTRAIT_ORIGIN = "50% 100%";                                 // core M16 = centre
const PORTRAIT_END = "top 25%";                                     // core M16 = "bottom top"

export default function init(ctx = {}) {
    const root = document.getElementById("s-10-hosts");
    if (!root) return null;                                        // section absent -> nothing to do (file contract)
    if (root.dataset.init) return { root };                        // idempotent
    root.dataset.init = "hosts";

    const stage = root.querySelector(".hosts__stage");
    const photo = stage && stage.querySelector(".hosts__portrait img");
    const col1 = photo && photo.closest(".js-image-anime");

    initSplitTitles(root);                                         // PS:340-359 (runs after document.fonts.ready - onReady guarantees it)
    initReveals(root);                                             // PS:554-568
    initStamps(root);                                              // PS:992-1006
    const coreWasFirst = col1 ? !claim(col1, "anime") : false;     // keep core's 1.2 / -40 tween off the host photo
    initImageAnime(root);                                          // PS:1031-1046 (column 2 only - column 1 is claimed)
    if (photo) initPortraitZoom(ctx, col1, photo, coreWasFirst);

    if (stage) initPodcastPhoto(stage, photo, ctx);
    initIdlePause([[stage, "hosts__stage--idle"], [root.querySelector(".hosts__byline"), "hosts__byline--idle"]]);
    return { root, stage };
}

/* same data-init token scheme as core.js mark(): returns false when the token was already there */
function claim(el, key) {
    const have = (el.dataset.init || "").split(" ").filter(Boolean);
    if (have.includes(key)) return false;
    have.push(key);
    el.dataset.init = have.join(" ");
    return true;
}

/* M16 with the gentle start values about the bottom centre and the early end - trigger / start / scrub / refreshPriority copied from core.initImageAnime (PS:1031-1046) */
function initPortraitZoom(ctx, wrapper, img, coreWasFirst) {
    const gsap = ctx.gsap || window.gsap;
    const ScrollTrigger = ctx.ScrollTrigger || window.ScrollTrigger;
    const reduce = "reduceMotion" in ctx ? ctx.reduceMotion : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!gsap || !ScrollTrigger || !wrapper) return;
    img.removeAttribute("loading");                                // PS:143-145
    if (coreWasFirst) {                                            // the sweep ran before this module: drop its close-up tween on the photo
        ScrollTrigger.getAll().forEach((st) => {
            const a = st.animation;
            if (a && a.targets && a.targets().includes(img)) { st.kill(); a.kill(); }
        });
        gsap.set(img, { clearProps: "transform" });
    }
    if (reduce) return;                                            // DD Pick 19: no scrubbed trigger under reduced motion
    const strips = document.querySelectorAll(".strip");
    const strip = wrapper.closest(".strip");
    const priority = 1000 - 10 * Math.max(0, Array.prototype.indexOf.call(strips, strip));   // core stripPriority (PS:1042)
    gsap.set(img, { transformOrigin: PORTRAIT_ORIGIN });
    gsap.from(img, {
        scale: PORTRAIT_FROM.scale, yPercent: PORTRAIT_FROM.yPercent,
        scrollTrigger: {
            trigger: wrapper,                                       // PS:1039
            start: () => `top ${Math.min((wrapper.getBoundingClientRect().top + window.pageYOffset) / window.innerHeight * 100, 100)}%`,   // PS:1040
            end: () => PORTRAIT_END,                                // exception (2) - PS:1041 has "bottom top"
            refreshPriority: priority,                              // PS:1042
            scrub: 1                                                // PS:1043
        }
    });
}

/* drop-in slot: empty attribute = no request; a path = probe, then (re)set (never a console error: a failed probe is handled here) */
function initPodcastPhoto(stage, photo, ctx) {
    const src = (stage.dataset.podcastPhoto || "").trim();
    if (!src || !photo) return;
    const probe = new Image();
    probe.onload = () => {
        if (!probe.naturalWidth) return;
        const swap = photo.getAttribute("src") !== src;              // same URL as the markup = nothing to swap (no second decode)
        if (swap) photo.src = src;
        photo.width = probe.naturalWidth;                           // the CSS locks the 4:5 window, these only keep the attributes truthful
        photo.height = probe.naturalHeight;
        const focus = (stage.dataset.podcastFocus || "").trim();
        if (focus) stage.style.setProperty("--hosts-focus", focus);
        stage.classList.add("hosts__stage--photo");
        if ((swap || focus) && ctx.refresh) ctx.refresh();
    };
    probe.onerror = () => { stage.dataset.podcastPhotoMissing = "true"; };
    probe.src = src;
}

/* pause the CSS loops of each block while it is out of view */
function initIdlePause(pairs) {
    if (!("IntersectionObserver" in window)) return;
    const map = new Map(pairs.filter(([el]) => el));
    if (!map.size) return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => e.target.classList.toggle(map.get(e.target), !e.isIntersecting));
    }, { rootMargin: "80px 0px" });
    map.forEach((_, el) => io.observe(el));
}
