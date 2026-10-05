/* ==========================================================================
   Latte with Lata - carousel.js (foundation, ES module)
   Splide 4.1.4 rail with the Paszkowski config + fan-in entrance + hover zoom (CSS, base.css s12).
   Source keys:
     SP = teardowns/2026-09-14-caffepaszkowski-com/source/js/modules/_splide.beautified.js
     IM = .../source/js/modules/_init-more.beautified.js
     DD = teardowns/BEST-PARTS-latte-with-lata.md
   Requires vendor/splide.min.js (global Splide) loaded before js/main.js.
   ========================================================================== */
import { gsap, ScrollTrigger, reduceMotion, refresh } from "./core.js";

const D = document;
const instances = [];                                              // { root, splide }

/* default perPage ladder (mediaQuery "min") - SP:74-80; overridden/merged by data-splide-sizes JSON - SP:81-86 */
const DEFAULT_SIZES = { base: 3, 1600: 3, 900: 2, 750: 2, 576: 1 };

/** relative URL of the icon sprite; carousels inside sub-folders (harness) pass opts.sprite */
let spriteUrl = "assets/svg/icons.svg";
export function setIconSprite(url) { spriteUrl = url; }

function stripPriority(el) {                                        // IM:135 (1e3 - 10 * e.index(o))
    const strip = el.closest(".strip");
    if (!strip) return 1000;
    return 1000 - 10 * Array.prototype.indexOf.call(D.querySelectorAll(".strip"), strip);
}

/** Splide-compatible arrow markup with the sprite icons (Splide adopts existing .splide__arrows - Arrows component) */
function buildArrows(sprite) {
    const wrap = D.createElement("div");
    wrap.className = "splide__arrows";
    wrap.innerHTML =
        `<button class="splide__arrow splide__arrow--prev button button--icon" type="button">` +
        `<svg class="icon" aria-hidden="true" focusable="false"><use href="${sprite}#i-arrow-left"></use></svg></button>` +
        `<button class="splide__arrow splide__arrow--next button button--icon" type="button">` +
        `<svg class="icon" aria-hidden="true" focusable="false"><use href="${sprite}#i-arrow-right"></use></svg></button>`;
    return wrap;
}

/**
 * initCarousel(el, opts)
 * el   : the .strip__gallery element (gets .splide; .splide__track/.splide__list are created if absent - SP:48-54)
 * opts : Splide option overrides merged last (perPage, breakpoints, gap, speed, arrows, ...). Extra keys:
 *        opts.sprite (icon sprite url), opts.fanIn (false to skip the entrance), opts.perMove
 * returns the Splide instance (or the existing one when already initialised)
 */
export function initCarousel(el, opts = {}) {
    if (!el) return null;
    const existing = instances.find((i) => i.root === el);
    if (existing) return existing.splide;
    if (!window.Splide) throw new Error("carousel.js: window.Splide missing - load vendor/splide.min.js");

    const strip = el.closest(".strip") || el;                       // SP:43 (t)
    let slides = el.querySelectorAll(".splide__slide");

    /* markup completion - SP:48-54 */
    if (!el.classList.contains("splide")) el.classList.add("splide");
    if (!el.querySelector(".splide__track") && slides.length) {
        const list = D.createElement("div");
        const track = D.createElement("div");
        list.classList.add("splide__list");
        track.classList.add("splide__track");
        slides[0].parentNode.insertBefore(track, slides[0]);
        slides.forEach((s) => list.append(s));
        track.appendChild(list);
    }
    slides = el.querySelectorAll(".splide__slide");
    slides.forEach((s) => s.classList.add("strip__gallery__item"));   // the rail's item class (margin-right 1em - base.css s12)

    /* options - SP:55-70 */
    const options = {
        arrows: true,                                               // SP:56 (.js-splide-arrows on both rails) / contract
        pagination: false,                                          // SP:57 / contract
        type: "loop",                                               // SP:58 (.carousel without .js-splide-noloop)
        drag: true,                                                 // SP:59
        pauseOnHover: true,                                         // SP:60
        autoplay: false,                                            // SP:61
        interval: Number(strip.getAttribute("data-splide-speed") || 5000),   // SP:62
        speed: 2000,                                                // SP:63
        classes: {                                                  // SP:64-67 (icon font classes -> sprite arrows built above)
            prev: "splide__arrow--prev button button--icon",
            next: "splide__arrow--next button button--icon"
        },
        cloneStatus: true,                                          // SP:68
        mediaQuery: "min",                                          // SP:69
        rewind: false,                                              // SP:71 (loop -> rewind false)
        gap: "1em"                                                  // SP:71 reads the first slide's margin-right = 1em (_strip_site.scss:195)
    };
    if (slides.length) {
        const mr = getComputedStyle(slides[0]).marginRight;         // SP:71
        if (mr && mr !== "0px") options.gap = mr;
    }
    strip.style.setProperty("--sliderSpeed", `${options.speed}ms`); // SP:99
    el.style.setProperty("--sliderTime", `${options.interval}ms`);  // SP:71

    /* perPage ladder from data-splide-sizes - SP:74-86, 106-111 */
    let sizes = { ...DEFAULT_SIZES };
    if (el.hasAttribute("data-splide-sizes")) {
        const a = JSON.parse(el.getAttribute("data-splide-sizes") || "null") || {};
        if (a.all != null) { sizes = { base: a.all }; delete a.all; }
        sizes = { ...sizes, ...a };
    }
    const perMove = Number(opts.perMove || strip.getAttribute("data-splide-permove")) || 0;   // SP:73
    options.perPage = sizes.base;                                   // SP:106
    options.perMove = perMove || options.perPage;
    delete sizes.base;
    options.breakpoints = {};
    for (const bp in sizes) options.breakpoints[bp] = { perPage: sizes[bp], perMove: perMove || sizes[bp] };   // SP:107-110
    if (strip.matches(".js-splide-center")) { options.focus = "center"; options.padding = strip.getAttribute("data-splide-padding") || "25%"; }   // SP:106

    /* merge caller overrides (public API) */
    const { sprite, fanIn, perMove: _pm, ...overrides } = opts;
    Object.assign(options, overrides);

    /* arrows markup (sprite) unless the builder wrote its own */
    if (options.arrows && !el.querySelector(".splide__arrows")) {
        el.insertBefore(buildArrows(sprite || spriteUrl), el.firstChild);
    }

    const splide = new window.Splide(el, options);                  // SP:115
    splide.on("resized", () => ScrollTrigger.refresh());            // DD s7 "Splide re-measures on resize" - INFERRED hook
    splide.mount();                                                 // SP:127
    instances.push({ root: el, splide });
    el.dataset.init = ((el.dataset.init || "") + " carousel").trim();

    /* fan-in entrance - IM:117-140 (initGalleryStart) */
    if (fanIn !== false && !reduceMotion) {
        const items = el.querySelectorAll(".strip__gallery__item:not(.splide__slide--clone)");   // IM:121
        items.forEach((item, i) => {                                // IM:123-127
            const n = 1 - i;
            if (n === 0) item.style.zIndex = 1;
            gsap.set(item, { x: (item.clientWidth + parseInt(getComputedStyle(item).marginRight, 10)) * n });
        });
        gsap.to(items, {                                            // IM:128-138
            x: 0,
            duration: 1,
            ease: "power1.out",
            scrollTrigger: {
                trigger: el,
                start: () => "bottom bottom",
                refreshPriority: stripPriority(el),
                toggleActions: "play none none reverse"
            }
        });
    }
    return splide;
}

/** initCarousels(root) - every .strip__gallery[data-splide-sizes], .strip__gallery.splide or .js-carousel under root */
export function initCarousels(root, opts) {
    root = root || D;
    const els = Array.from(root.querySelectorAll(".strip__gallery.splide, .strip__gallery[data-splide-sizes], .js-carousel"));
    return els.map((el) => initCarousel(el, opts));
}

/** refreshCarousels() - Splide.refresh() on every instance, then ScrollTrigger.refresh() (call after images decode / fonts) */
export function refreshCarousels() {
    instances.forEach((i) => { try { i.splide.refresh(); } catch (e) { /* destroyed */ } });
    refresh();
}

export function getCarousels() { return instances.map((i) => i.splide); }

export default { initCarousel, initCarousels, refreshCarousels, getCarousels, setIconSprite };
