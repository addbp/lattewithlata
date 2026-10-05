/* ==========================================================================
   Latte with Lata - core.js (foundation engine, ES module)
   Ported from the Paszkowski teardown. Source keys:
     PS = teardowns/2026-09-14-caffepaszkowski-com/source/js/modules/_page-scroll.beautified.js
     UT = .../source/js/modules/_utils.beautified.js
     IM = .../source/js/modules/_init-more.beautified.js
     DD = teardowns/BEST-PARTS-latte-with-lata.md
   Requires the classic vendor scripts loaded first (globals gsap, ScrollTrigger, SplitText, ScrollToPlugin).
   All init*() functions are idempotent: every element they touch is marked in data-init.
   ========================================================================== */

const W = window;
const D = document;
const html = D.documentElement;

if (!W.gsap) throw new Error("core.js: window.gsap missing - load vendor/gsap.min.js before js/main.js");

/* ---- registration ---- */
const gsap = W.gsap;
const ScrollTrigger = W.ScrollTrigger;
const SplitText = W.SplitText;
const ScrollToPlugin = W.ScrollToPlugin;
gsap.registerPlugin(...[ScrollTrigger, SplitText, ScrollToPlugin].filter(Boolean));

/* ---- environment flags - UT:116 ----
   np_root.isTouch = matchMedia("(pointer: coarse)").matches -> html.is-touch | is-mouse
   np_root.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches                       */
export const reduceMotion = W.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isTouch = W.matchMedia("(pointer: coarse)").matches;
export const isMouse = !isTouch;
html.classList.add(isTouch ? "is-touch" : "is-mouse");
if (reduceMotion) html.classList.add("reduce-motion");

/* ---- shared gsap.matchMedia() - PS:19 (d = gsap.matchMedia()) ---- */
export const mm = gsap.matchMedia();

export { gsap, ScrollTrigger, SplitText };

/* ---- ready: DOMContentLoaded + document.fonts.ready (DD s7 "Always ScrollTrigger.refresh() after document.fonts.ready") ---- */
const domReady = new Promise((res) => {
    if (D.readyState !== "loading") res();
    else D.addEventListener("DOMContentLoaded", () => res(), { once: true });
});
const fontsReady = domReady.then(() => (D.fonts && D.fonts.ready ? D.fonts.ready.catch(() => {}) : null));

/** onReady(fn): runs fn after DOMContentLoaded AND document.fonts.ready. Returns a promise of fn's result. */
export function onReady(fn) {
    return fontsReady.then(() => fn());
}

/** refresh(): plain ScrollTrigger.refresh() (DD Pick 20 / s7: never refresh(true) after decode). */
export function refresh() {
    ScrollTrigger.refresh();
}

/* window load -> refresh - PS:1117-1119 (source calls refresh(true); DD s7 mandates the plain call) */
W.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });

/* ---- helpers ---- */
const REFRESH_BASE = 1000;                                   // PS:21 (f = 1e3)

/** refreshPriority = 1000 - 10 * index of the closest .strip (top-to-bottom refresh order) - PS:356,559,1003,1042 */
function stripPriority(el) {
    const strip = el.closest(".strip");
    if (!strip) return REFRESH_BASE;
    const strips = D.querySelectorAll(".strip");
    return REFRESH_BASE - 10 * Array.prototype.indexOf.call(strips, strip);
}

/** idempotency mark: appends key to data-init; returns false when already present */
function mark(el, key) {
    const have = (el.dataset.init || "").split(" ").filter(Boolean);
    if (have.includes(key)) return false;
    have.push(key);
    el.dataset.init = have.join(" ");
    return true;
}

function toArray(root, selector) {
    root = root || D;
    const list = Array.from(root.querySelectorAll(selector));
    if (root !== D && root.matches && root.matches(selector)) list.unshift(root);
    return list;
}

/** jQuery .offset().top equivalent (document-relative) */
function offsetTop(el) {
    return el.getBoundingClientRect().top + W.pageYOffset;
}

/** Paszkowski's start formula: `top ${min(offsetTop / innerHeight * 100, 100)}%` -> "top 100%" (= "top bottom") for anything below the first viewport - PS:375,1020,1040 */
function startPercent(el) {
    return () => `top ${Math.min(offsetTop(el) / W.innerHeight * 100, 100)}%`;
}

/* ==========================================================================
   initReveals(root) - class-flip reveals .waiting -> .animated
   PS:554-568: every [class*="anima--"] gets .waiting, then two ScrollTriggers:
     #1 start "top bottom-=min(height/4,100)px"  onEnter    -> -waiting +animated
     #2 end   "top bottom"                        onLeaveBack -> +waiting -animated
   Reduced motion: PS:284 returns before this block (nothing gets .waiting) -> we set .animated directly.
   ========================================================================== */
export function initReveals(root) {
    const els = toArray(root, '[class*="anima--"]').filter((el) => mark(el, "reveal"));
    els.forEach((el) => {
        if (reduceMotion) {
            el.classList.remove("waiting");
            el.classList.add("animated");
            return;
        }
        el.classList.add("waiting");                          // PS:554
        const priority = stripPriority(el);
        ScrollTrigger.create({                                // PS:556-561
            trigger: el,
            refreshPriority: priority,
            start: () => `top bottom-=${Math.min(el.offsetHeight / 4, 100)}px`,
            onEnter: () => { el.classList.remove("waiting"); el.classList.add("animated"); }
        });
        ScrollTrigger.create({                                // PS:562-567
            trigger: el,
            refreshPriority: priority - 1,
            end: () => "top bottom",
            onLeaveBack: () => { el.classList.add("waiting"); el.classList.remove("animated"); }
        });
    });
    return els;
}

/* ==========================================================================
   initStamps(root) - .strip--stamp drift: --stamp-y -25% -> 25%
   PS:992-1006: gsap.fromTo(el, {"--stamp-y":"-25%"}, {"--stamp-y":"25%",
     scrollTrigger:{trigger: el, start:"top bottom", end:"top top", scrub:.75, refreshPriority}})
   No ease in the source -> gsap default (power1.out); measured 12.5% at 50% progress agrees (build-analysis effect 9).
   ========================================================================== */
export function initStamps(root) {
    const els = toArray(root, ".strip--stamp").filter((el) => mark(el, "stamp"));
    els.forEach((el) => {
        if (reduceMotion) { gsap.set(el, { "--stamp-y": "0%" }); return; }   // DD Pick 19: skip scrubbed triggers
        gsap.fromTo(el, { "--stamp-y": "-25%" }, {
            "--stamp-y": "25%",
            scrollTrigger: {
                trigger: el,
                start: () => "top bottom",                      // PS:1001
                end: () => "top top",                           // PS:1002
                refreshPriority: stripPriority(el),             // PS:1003
                scrub: .75                                      // PS:1004
            }
        });
    });
    return els;
}

/* ==========================================================================
   initSplitTitles(root) - word rise on .strip__title1 / .strip__title2
   PS:28: targets .strip__title1/.strip__title2 inside .strip, skipping .strip__title--splitted / --static
   PS:149-153: split into words, each wrapped in span.word-wrapper (overflow hidden, base.css s9)
   PS:340-359: gsap.fromTo(words, {yPercent:110}, {opacity:1, yPercent:0, rotation:0, stagger:.05, delay:.1,
     duration:1.2, ease:"power2.inOut", scrollTrigger:{trigger: heading, start:"top bottom-=50px",
     toggleActions:"play none none reset", refreshPriority}})
   Reduced motion: gsap.set end state (DD Pick 5 / _animate.scss:94-97).
   Splitter: GSAP 3.13 SplitText (type "words", aria "auto") instead of Splitting.js - DD Pick 5 "Change".
   ========================================================================== */
export function initSplitTitles(root) {
    const els = toArray(root, ".strip__title1, .strip__title2, .js-split-title")
        .filter((el) => !el.matches(".strip__title--splitted, .strip__title--static") && mark(el, "split"));
    els.forEach((el) => {
        let words;
        if (SplitText) {
            const split = SplitText.create(el, { type: "words", wordsClass: "word", aria: "auto" });
            words = split.words;
            el._split = split;
        } else {
            words = manualSplit(el);                              // PS:154-160 fallback (regex split on whitespace)
        }
        words.forEach((w) => {                                    // PS:153 $(this).find(".word").wrap('<span class="word-wrapper">')
            const wrap = D.createElement("span");
            wrap.className = "word-wrapper";
            w.parentNode.insertBefore(wrap, w);
            wrap.appendChild(w);
        });
        el.classList.add("strip__title--splitted");
        if (reduceMotion) { gsap.set(words, { yPercent: 0, opacity: 1 }); return; }
        gsap.fromTo(words, { yPercent: 110 }, {                   // PS:342-344
            opacity: 1, yPercent: 0, rotation: 0,                  // PS:345-347
            stagger: .05, delay: .1, duration: 1.2,                // PS:348-350
            ease: "power2.inOut",                                  // PS:351
            scrollTrigger: {
                trigger: el,                                       // PS:354
                start: () => "top bottom-=50px",                   // PS:355
                refreshPriority: stripPriority(el),                // PS:356
                toggleActions: "play none none reset"              // PS:357
            }
        });
    });
    return els;
}

/** PS:154-160 fallback splitter: keeps <br>, wraps each word in span.word */
function manualSplit(el) {
    let h = el.innerHTML.replace(/<br\s*\/?>/gi, " <br> ").replace(/\s+/g, " ").trim().split(" ");
    el.innerHTML = h.map((t) => (t === "<br>" ? t : `<span class="word">${t}</span>`)).join(" ");
    return Array.from(el.querySelectorAll(".word"));
}

/* ==========================================================================
   initImageAnime(root) - zoom-settle of images inside .js-image-anime wrappers
   PS:1031-1046: for each .js-image-anime -> each .strip__image -> gsap.from(img/video, {scale:1.2, yPercent:-40,
     scrollTrigger:{trigger: wrapper, start: top min(offsetTop/innerHeight*100,100)%, end:"bottom top", scrub:1, refreshPriority}})
   PS:143-144: the images lose loading="lazy" (they must be decoded for the measurement)
   CSS window: .js-image-anime .strip__image { overflow: hidden } (base.css s6)
   ========================================================================== */
export function initImageAnime(root) {
    const els = toArray(root, ".js-image-anime").filter((el) => mark(el, "anime"));
    els.forEach((wrapper) => {
        wrapper.querySelectorAll("img[loading]").forEach((img) => img.removeAttribute("loading"));   // PS:143-145
        if (reduceMotion) return;
        const priority = stripPriority(wrapper);
        wrapper.querySelectorAll(".strip__image").forEach((box) => {
            const media = box.querySelectorAll("img, video");
            if (!media.length) return;
            gsap.from(media, {
                scale: 1.2, yPercent: -40,                          // PS:1036-1037
                scrollTrigger: {
                    trigger: wrapper,                               // PS:1039 (trigger: t = the .js-image-anime element)
                    start: startPercent(wrapper),                   // PS:1040
                    end: () => "bottom top",                        // PS:1041
                    refreshPriority: priority,                      // PS:1042
                    scrub: 1                                        // PS:1043
                }
            });
        });
    });
    return els;
}

/* ==========================================================================
   initParallaxStrips(root) - the 65vh window parallax (.parallax inside .strip--image)
   PS:360-381 non-banner branch: img = .strip__image img|video, box = closest .strip__image (overflow hidden),
     inside .strip--image -> o = -1 -> y: box.height - img.height (negative = slides up by its overflow)
     gsap.fromTo(img, {y:0}, {y, scrollTrigger:{trigger: box, start: top min(offsetTop/innerHeight*100,100)%, end:"bottom top", scrub:true, refreshPriority}})
   Measured: y 0 -> -292.5px = -(877.5 - 585) at 1440x900 (build-analysis effect 8).
   Outside .strip--image (o = 1) the source drifts the element by data-parallax % of its own height (default 20) - kept.
   ========================================================================== */
export function initParallaxStrips(root) {
    const els = toArray(root, ".parallax").filter((el) => mark(el, "parallax"));
    els.forEach((el) => {
        if (reduceMotion) return;
        const inImageStrip = !!el.closest(".strip--image");
        let media = el.querySelectorAll(".strip__image img, .strip__image video");
        let box;
        if (media.length) {
            box = media[0].closest(".strip__image");
            box.style.overflow = "hidden";                          // PS:366-367
        } else {
            media = el.querySelectorAll(".strip__text");            // PS:368 fallback
            box = el;
        }
        if (!media.length) return;
        const img = media[0];
        gsap.fromTo(media, { y: 0 }, {
            y: () => inImageStrip
                ? box.getBoundingClientRect().height - img.getBoundingClientRect().height       // PS:371 (o < 0)
                : img.getBoundingClientRect().height / 100 * Number(img.getAttribute("data-parallax") || 20),
            // no ease in the source (PS:368-380) -> gsap default power1.out; measured -219.5px at 50% = .75 x -292.5 confirms it (build-analysis effect 8)
            scrollTrigger: {
                trigger: box,                                       // PS:374
                start: startPercent(img),                           // PS:375
                end: () => "bottom top",                            // PS:376
                refreshPriority: stripPriority(el),                 // PS:377
                scrub: true,                                        // PS:378
                invalidateOnRefresh: true                           // DD s7 "wrap in invalidateOnRefresh" - INFERRED for the source, required so y() re-measures after decode
            }
        });
    });
    return els;
}

/* ==========================================================================
   waitForImages(root) - resolves after img.decode() of the visible images, then refresh()
   DD Pick 20 / s7: "call plain ScrollTrigger.refresh() after Promise.all(imgs.map(i => i.decode()))"
   Lazy images not yet requested are not awaited (they would never resolve); a 4s guard caps the wait - INFERRED.
   ========================================================================== */
export function waitForImages(root, timeoutMs = 4000) {
    root = root || D;
    const imgs = Array.from(root.querySelectorAll("img")).filter((img) => {
        if (!img.getClientRects().length) return false;                  // display:none / detached
        const lazyPending = img.loading === "lazy" && !img.complete && !img.currentSrc;
        return !lazyPending;
    });
    const one = (img) => new Promise((res) => {
        const done = () => (img.decode ? img.decode().then(res, res) : res());
        if (img.complete) return done();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", res, { once: true });
    });
    const guard = new Promise((res) => setTimeout(res, timeoutMs));
    return Promise.race([Promise.all(imgs.map(one)), guard]).then(() => { refresh(); return imgs; });
}

/* ==========================================================================
   initAll(root) - convenience: the five inits in Paszkowski's order (split -> reveals -> stamps -> image-anime -> parallax)
   ========================================================================== */
export function initAll(root) {
    initSplitTitles(root);
    initReveals(root);
    initStamps(root);
    initImageAnime(root);
    initParallaxStrips(root);
}

/** ctx object handed to every section module's init(ctx) (file contract) */
export function makeCtx(extra) {
    return Object.assign({ gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh }, extra || {});
}

export default { gsap, ScrollTrigger, SplitText, mm, reduceMotion, isTouch, isMouse, onReady, refresh,
    initReveals, initStamps, initSplitTitles, initImageAnime, initParallaxStrips, waitForImages, initAll, makeCtx };
