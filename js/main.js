/* ==========================================================================
   Latte with Lata - js/main.js (integrator: page bootstrap)
   Loads after the classic vendor scripts (gsap, ScrollTrigger, SplitText, ScrollToPlugin, Splide globals) as
   <script type="module">. Imports the foundation (core.js, carousel.js) and every section module, builds the ctx
   object of the file contract and runs the init sequence agreed in the hand-off notes:

     onReady (DOMContentLoaded + document.fonts.ready)
       -> section inits 00..14 in page order   (01 injects the hero rows, 03/06/09 mount Splide - they must run first)
       -> core.initAll()                        (split -> reveals -> stamps -> image-anime -> parallax; idempotent sweep
                                                 for any engine a section did not wire itself: data-init tokens)
       -> await core.waitForImages()            (img.decode() of the rendered images, 4 s guard, then plain refresh())
       -> refreshCarousels()                    (Splide.refresh() on every rail + ScrollTrigger.refresh())

   Sources: foundation.md "Requests for others" (integrator sequence), build-A/B/C/D.md "Init requirements",
   BUILD-SPEC G4 (module contract), DD s7 "Always ScrollTrigger.refresh() after document.fonts.ready and image decode".
   Debugging / verification hook: window.__latte = { ctx, ScrollTrigger, gsap, core, sections, errors, status, ready }.
   PAGES UPDATE (2026-09-17): this is the HOME bootstrap only; the sub-pages run js/page.js (same ctx, same window.__latte surface).
   ctx.api = the shared fetch client js/lib/api.js (13-newsletter posts through it).
   ========================================================================== */
import * as core from "./core.js";
import { initCarousel, refreshCarousels, getCarousels } from "./carousel.js";
import api from "./lib/api.js";

import init00 from "./sections/00-header.js";
import init01 from "./sections/01-hero.js";
import init02 from "./sections/02-intro.js";
import init03 from "./sections/03-gallery.js";
import init04 from "./sections/04-story-a.js";
import init05 from "./sections/05-strip.js";
import init06 from "./sections/06-menu.js";
import init07 from "./sections/07-manifesto.js";
import init08 from "./sections/08-podcast.js";
import init09 from "./sections/09-episodes.js";
import init10 from "./sections/10-hosts.js";
import init11 from "./sections/11-live.js";
import init12 from "./sections/12-visit-listen.js";
import init13 from "./sections/13-newsletter.js";
import init14 from "./sections/14-footer.js";

/* page order = the file contract (sections/NN-name.html) */
const SECTIONS = [
    ["00-header", init00], ["01-hero", init01], ["02-intro", init02], ["03-gallery", init03],
    ["04-story-a", init04], ["05-strip", init05], ["06-menu", init06], ["07-manifesto", init07],
    ["08-podcast", init08], ["09-episodes", init09], ["10-hosts", init10], ["11-live", init11],
    ["12-visit-listen", init12], ["13-newsletter", init13], ["14-footer", init14]
];

/* ctx handed to every section module (file contract): { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel, api } */
const ctx = core.makeCtx({ initCarousel, api });

/* verification / debugging surface (brief: window.__latte = { ctx, ScrollTrigger }; extras are additive) */
const state = {
    ctx,
    ScrollTrigger: core.ScrollTrigger,
    gsap: core.gsap,
    core,
    carousels: getCarousels,
    sections: {},          // name -> whatever init(ctx) returned
    errors: [],            // { section, error } for inits that threw (the page keeps going)
    status: "loading",     // "loading" -> "ready" (or "failed")
    ready: null            // Promise that resolves with `state` once the whole sequence is done
};
window.__latte = state;

state.ready = core.onReady(async () => {
    /* 1. section inits in page order - each one returns early when its root is absent and is idempotent (data-init) */
    for (const [name, init] of SECTIONS) {
        try {
            state.sections[name] = init(ctx);
        } catch (err) {
            state.errors.push({ section: name, error: String(err && err.stack || err) });
            console.error(`[main.js] ${name} init failed:`, err);
        }
    }

    /* 2. foundation sweep (PS init order: split -> reveals -> stamps -> image-anime -> parallax); no-op on anything already marked */
    core.initAll();

    /* 3. decode what is on screen, then plain ScrollTrigger.refresh() (never refresh(true) - DD Pick 20 / s7) */
    await core.waitForImages();

    /* 4. Splide re-measures + re-clones (09 re-splits its blurb lines on the refresh event this fires) */
    refreshCarousels();

    state.status = state.errors.length ? "failed" : "ready";
    document.documentElement.setAttribute("data-page-ready", state.status);          // html[data-page-ready="ready"] - verifier hook (INFERRED, not in the registry)
    document.dispatchEvent(new CustomEvent("latte:ready", { detail: state }));
    return summary();
}).catch((err) => {
    state.status = "failed";
    state.errors.push({ section: "main", error: String(err && err.stack || err) });
    document.documentElement.setAttribute("data-page-ready", "failed");
    console.error("[main.js] bootstrap failed:", err);
    return summary();
});

/* plain, serialisable snapshot (what `ready` resolves to - safe for page.evaluate(() => window.__latte.ready)) */
function summary() {
    return {
        status: state.status,
        errors: state.errors.slice(),
        sections: Object.keys(state.sections),
        scrollTriggers: core.ScrollTrigger.getAll().length,
        carousels: getCarousels().length,
        reduceMotion: core.reduceMotion,
        isTouch: core.isTouch
    };
}

/* window resize -> debounced plain refresh (brief). ScrollTrigger already refreshes itself on resize; this covers
   the explicit request and the resize-driven layout of the section CSS. Height-only resizes on touch devices
   (address-bar show/hide) are ignored so a scrolling phone does not re-measure every trigger - INFERRED guard. */
let resizeTimer = 0;
let lastWidth = window.innerWidth;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (core.isTouch && window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        core.refresh();
    }, 250);
});
