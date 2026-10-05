/* ==========================================================================
   Latte with Lata - js/page.js (SHELL lane: sub-page bootstrap, PAGES-SPEC 2)
   The js/main.js of every generated sub-page (cafe, menu, podcast, episodes, events, contact, book). Loads after the classic vendor
   scripts (gsap, ScrollTrigger, SplitText, ScrollToPlugin, Splide globals) as <script type="module">.

     onReady (DOMContentLoaded + document.fonts.ready)
       -> shared section inits: 00-header (plate / hide-show keyed off the first [data-banner]), 13-newsletter, 14-footer
       -> generic sweep: page hero exit drift, core.initAll() (split titles -> reveals -> stamps -> image-anime -> parallax strips),
          carousels on every [data-carousel], in-page anchor chips (.page-nav)
       -> import("./pages/<body data-page>.js") and call its default export with ctx (awaited, 5 s guard; a missing module is skipped quietly -
          build-site.cjs writes body[data-page-module="false"] when the file does not exist, so no 404 is ever requested)
       -> generic sweep again (idempotent: only touches what the page module injected)
       -> await core.waitForImages() -> refreshCarousels() (Splide re-measure + ScrollTrigger.refresh())
       -> html[data-page-ready="ready"], document "latte:ready" event, window.__latte.ready resolves with a plain summary

   ctx (same object shape as the home page, PLUS the extras marked +):
     { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel,
       api          the shared fetch client js/lib/api.js (get / post / patch / put / del / available / formatDate / formatTime / form helpers)
     + core         the js/core.js namespace: call ctx.core.initAll(root) / initReveals(root) after you inject DOM (all idempotent)
     + page         document.body.dataset.page
     + refreshCarousels }
   Page module contract (js/pages/<page>.js): `export default function init(ctx) { ... }` - may be async, must no-op when its DOM is absent.
   Verification hook: window.__latte = { ctx, ScrollTrigger, gsap, core, carousels(), sections, errors, status, ready, page }.
   ========================================================================== */
import * as core from "./core.js";
import { initCarousel, refreshCarousels, getCarousels } from "./carousel.js";
import api from "./lib/api.js";

import initHeader from "./sections/00-header.js";
import initNewsletter from "./sections/13-newsletter.js";
import initFooter from "./sections/14-footer.js";

const page = document.body.dataset.page || "";
const ctx = core.makeCtx({ initCarousel, api, core, page, refreshCarousels });

const state = {
    ctx,
    page,
    ScrollTrigger: core.ScrollTrigger,
    gsap: core.gsap,
    core,
    carousels: getCarousels,
    sections: {},          // name -> whatever init(ctx) returned ("page" = the page module)
    errors: [],            // { section, error } for inits that threw (the page keeps going)
    status: "loading",     // "loading" -> "ready" (or "failed")
    ready: null
};
window.__latte = state;

const SHARED = [["00-header", initHeader], ["13-newsletter", initNewsletter], ["14-footer", initFooter]];
const PAGE_INIT_GUARD_MS = 5000;   // an async page init that waits on the API never blocks the ready state for longer than this

function guard(name, fn) {
    try { return fn(); }
    catch (err) {
        state.errors.push({ section: name, error: String(err && err.stack || err) });
        console.error(`[page.js] ${name} init failed:`, err);
        return undefined;
    }
}

/* ---- generic inits (every one idempotent: data-init tokens / instance lists) ---- */

/** Page hero exit drift: the photo box (.page-hero__media, 12% taller than the hero) slides down while the hero scrolls away - the home hero's
    M5 idea, lighter. The entrance (photo settle + copy rise) is CSS-only in css/pages/_shell.css, so nothing is ever hidden by a script.
    Reduced motion: no trigger at all (DD Pick 19). */
function initPageHero() {
    document.querySelectorAll(".page-hero").forEach((hero) => {
        if (hero.dataset.heroInit) return;
        hero.dataset.heroInit = "1";
        if (core.reduceMotion) return;
        const box = hero.querySelector(".page-hero__media");
        if (!box) return;
        core.gsap.fromTo(box, { yPercent: 0 }, {
            yPercent: 10, ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true }
        });
    });
}

/** Opt-in rails: <div class="strip__gallery" data-carousel data-splide-sizes='{"all":1,"576":2,"800":3}'> ... .splide__slide items.
    Rails that need custom options are mounted by the page module with ctx.initCarousel(el, opts) instead (leave data-carousel off). */
function initCarousels() {
    document.querySelectorAll("[data-carousel]").forEach((el) => {
        if (el.dataset.carouselInit) return;
        el.dataset.carouselInit = "1";
        let opts = {};
        const raw = el.getAttribute("data-carousel");
        if (raw && raw.trim().startsWith("{")) { try { opts = JSON.parse(raw); } catch (_) { opts = {}; } }
        guard("carousel", () => initCarousel(el, opts));
    });
}

/** .page-nav chips: aria-current on the chip whose section is in view (the jump itself is a plain anchor; html has scroll-padding-top) */
function initPageNav() {
    document.querySelectorAll(".page-nav").forEach((nav) => {
        if (nav.dataset.navInit) return;
        nav.dataset.navInit = "1";
        const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
        links.forEach((a) => {
            const target = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
            if (!target) return;
            core.ScrollTrigger.create({
                trigger: target, start: "top 55%", end: "bottom 55%",
                onToggle: (self) => {
                    if (!self.isActive) { if (a.getAttribute("aria-current")) a.removeAttribute("aria-current"); return; }
                    links.forEach((l) => l.removeAttribute("aria-current"));
                    a.setAttribute("aria-current", "true");
                }
            });
        });
    });
}

function sweep() {
    guard("page-hero", initPageHero);
    guard("core.initAll", () => core.initAll());
    guard("carousels", initCarousels);
    guard("page-nav", initPageNav);
}

async function runPageModule() {
    if (!page || !/^[a-z0-9_-]+$/i.test(page)) return;
    if (document.body.dataset.pageModule === "false") return;          // build-site.cjs: js/pages/<page>.js does not exist - do not request it
    let mod;
    try { mod = await import(`./pages/${page}.js`); }
    catch (err) {                                                       // missing module (or a syntax error in it): the shell keeps working
        console.warn(`[page.js] no page module for "${page}" (${err && err.message ? err.message : err})`);
        return;
    }
    if (!mod || typeof mod.default !== "function") return;
    let result;
    try { result = mod.default(ctx); }
    catch (err) {
        state.errors.push({ section: "page:" + page, error: String(err && err.stack || err) });
        console.error(`[page.js] pages/${page}.js init failed:`, err);
        return;
    }
    state.sections.page = result;
    if (result && typeof result.then === "function") {
        const late = result.then((v) => { state.sections.page = v; return v; }, (err) => {
            state.errors.push({ section: "page:" + page, error: String(err && err.stack || err) });
            console.error(`[page.js] pages/${page}.js init rejected:`, err);
        });
        const timedOut = Symbol("timeout");
        const winner = await Promise.race([late, new Promise((res) => setTimeout(() => res(timedOut), PAGE_INIT_GUARD_MS))]);
        if (winner === timedOut) late.then(() => { sweep(); refreshCarousels(); });   // finished after the guard: pick up what it injected
    }
}

state.ready = core.onReady(async () => {
    for (const [name, init] of SHARED) state.sections[name] = guard(name, () => init(ctx));
    sweep();
    await runPageModule();
    sweep();
    await core.waitForImages();
    refreshCarousels();

    state.status = state.errors.length ? "failed" : "ready";
    document.documentElement.setAttribute("data-page-ready", state.status);
    document.dispatchEvent(new CustomEvent("latte:ready", { detail: state }));
    return summary();
}).catch((err) => {
    state.status = "failed";
    state.errors.push({ section: "page.js", error: String(err && err.stack || err) });
    document.documentElement.setAttribute("data-page-ready", "failed");
    console.error("[page.js] bootstrap failed:", err);
    return summary();
});

function summary() {
    return {
        page,
        status: state.status,
        errors: state.errors.slice(),
        sections: Object.keys(state.sections),
        scrollTriggers: core.ScrollTrigger.getAll().length,
        carousels: getCarousels().length,
        reduceMotion: core.reduceMotion,
        isTouch: core.isTouch
    };
}

/* window resize -> debounced plain refresh (same guard as js/main.js: height-only resizes on touch devices are ignored) */
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
