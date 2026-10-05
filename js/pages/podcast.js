/* ==========================================================================
   Latte with Lata - js/pages/podcast.js (lane PAGE podcast + episodes)
   Page module of podcast.html. Contract: js/page.js imports it and calls the default export with ctx
   { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel, api, core, page, refreshCarousels }.
   Every part no-ops when its DOM is absent, is idempotent (data-init), and leaves the page fully readable when it does not run:
     1. ticker      #p-podcast-08-listen .pod-marquee - the home 08 glow ticker as a CSS loop; this module only measures the duration, splits the
                    glow chars and runs it while it is on screen. No visible pause / play control (UPDATE-3, client decision). Reduced motion /
                    no JS: nothing moves (static white line).
     2. quote scrub #p-podcast-06-host [data-scrub] - the home 07 colour scrub, word by word (words keep the sentence readable for assistive
                    tech), --colAccentTint -> --colOnBrand. Reduced motion / no GSAP: the CSS default (white) stays.
     3. meter       the lower-third level meter only animates while the portrait is on screen (.is-live).
     4. hover lines #p-podcast-09-episodes-cta - the home 09 blurb lines on hover / focus (html.is-mouse, motion allowed).
   Reveals, split titles and the image zoom-settle are the shell's generic sweep (core.initAll) - nothing to do here.
   ========================================================================== */
export default function init(ctx = {}) {
    if (document.body.dataset.page !== "podcast") return null;
    const state = { ticker: initTicker(ctx), scrub: initQuoteScrub(ctx), meter: initMeter(ctx), lines: initHoverLines(ctx) };
    return state;
}

function once(el, key) {
    if (!el) return false;
    const have = (el.dataset.podInit || "").split(" ").filter(Boolean);
    if (have.includes(key)) return false;
    have.push(key);
    el.dataset.podInit = have.join(" ");
    return true;
}

/* ---- 1. ticker ---- */
function initTicker(ctx) {
    const marquee = document.querySelector("#p-podcast-08-listen .pod-marquee");
    if (!marquee || !once(marquee, "ticker")) return null;
    if (ctx.reduceMotion) return "static";                                   // static white line (the CSS loop only runs with .is-running)
    const track = marquee.querySelector(".pod-marquee__track");
    const copies = Array.from(marquee.querySelectorAll(".pod-marquee__copy"));
    if (!track || copies.length < 2) return null;

    const SPEED = window.matchMedia("(min-width: 1025px)").matches && ctx.isMouse ? 350 : 300;   // px / s - the home ticker's two tiers
    const measure = () => {
        const w = copies[0].getBoundingClientRect().width;
        if (w > 0) marquee.style.setProperty("--podMarqueeDur", (w / SPEED).toFixed(2) + "s");
    };

    if (ctx.SplitText) {                                                     // glow chars (the copies are aria-hidden: no aria needed)
        const split = new ctx.SplitText(copies, { type: "chars", charsClass: "char", aria: "none" });
        split.chars.forEach((el, i) => { el.style.animationDelay = (.4 * i).toFixed(1) + "s"; });
    }
    measure();

    /* in view (80px margin) = running; everywhere else .is-paused freezes the track and drops the glow (CSS). No pause control (UPDATE-3). */
    const setInView = (inView) => marquee.classList.toggle("is-paused", !inView);
    marquee.classList.add("is-running", "is-paused");
    if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => setInView(entries[entries.length - 1].isIntersecting), { rootMargin: "80px 0px" }).observe(marquee);   // latest entry wins when a batch holds more than one
    } else { setInView(true); }
    if (ctx.ScrollTrigger) ctx.ScrollTrigger.addEventListener("refresh", measure);   // resize / font swap -> same speed at the new width
    return { marquee };
}

/* ---- 2. pull-quote colour scrub (home 07 engine: start "top 90%", scrub .75, stagger .1, ease none; end "bottom 72%" instead of 60% so the sentence is fully white once it sits in the middle of the screen) ---- */
function initQuoteScrub(ctx) {
    const el = document.querySelector("#p-podcast-06-host [data-scrub]");
    if (!el || !once(el, "scrub")) return null;
    const { gsap, SplitText, reduceMotion } = ctx;
    if (reduceMotion || !gsap || !SplitText) return "static";
    const css = getComputedStyle(document.documentElement);
    const from = (css.getPropertyValue("--colAccentTint") || "").trim() || "#c9a98f";
    const to = (css.getPropertyValue("--colOnBrand") || "").trim() || "#ffffff";
    const split = new SplitText(el, { type: "words", wordsClass: "word", aria: "none" });   // words stay ordinary inline text for screen readers
    gsap.set(split.words, { color: from });
    gsap.timeline({
        scrollTrigger: { trigger: el, start: () => "top 90%", end: () => "bottom 72%", scrub: .75, invalidateOnRefresh: true }
    }).to(split.words, { color: to, stagger: .1, ease: "none" }, .1);
    return split;
}

/* ---- 3. lower-third meter: run only while the portrait is on screen ---- */
function initMeter(ctx) {
    const stage = document.querySelector("#p-podcast-06-host .pod-host__stage");
    if (!stage || !once(stage, "meter")) return null;
    if (ctx.reduceMotion || !("IntersectionObserver" in window)) return "static";
    new IntersectionObserver((entries) => stage.classList.toggle("is-live", entries[0].isIntersecting), { rootMargin: "80px 0px" }).observe(stage);
    return stage;
}

/* ---- 4. blurb hover lines on the three latest cards (home 09 engine) ---- */
function initHoverLines(ctx) {
    const root = document.getElementById("p-podcast-09-episodes-cta");
    const grid = root && root.querySelector(".pod-latest__grid");
    if (!grid || !once(root, "lines")) return null;
    const { gsap, SplitText, ScrollTrigger, isMouse, reduceMotion } = ctx;
    if (!isMouse || reduceMotion || !gsap || !SplitText) return "static";    // touch / reduced motion: the blurb is simply visible

    root.classList.add("pod-latest--lines");
    let splits = [];
    const blurbs = () => Array.from(grid.querySelectorAll(".episode-card__blurb"));
    const revertAll = () => {
        splits.forEach((s) => { try { s.revert(); } catch (_) { /* gone */ } });
        splits = [];
        blurbs().forEach((el) => el.classList.remove("is-split"));
    };
    const splitAll = () => {
        revertAll();
        blurbs().forEach((el) => {
            splits.push(new SplitText(el, { type: "lines", linesClass: "line", aria: "none" }));
            el.classList.add("is-split");
        });
    };
    const enter = (card) => gsap.to(card.querySelectorAll(".line"), { y: 0, opacity: 1, duration: .4, stagger: .05, ease: "power2.out", overwrite: true });
    const leave = (card) => {
        if (card.contains(document.activeElement)) return;                   // keyboard focus keeps the lines up
        const lines = card.querySelectorAll(".line");
        gsap.to(lines, { opacity: 0, duration: .4, overwrite: true, onComplete: () => gsap.set(lines, { clearProps: "all" }) });
    };
    grid.addEventListener("mouseenter", (e) => { if (e.target instanceof Element && e.target.matches(".episode-card")) enter(e.target); }, true);
    grid.addEventListener("mouseleave", (e) => { if (e.target instanceof Element && e.target.matches(".episode-card")) leave(e.target); }, true);
    grid.addEventListener("focusin", (e) => { const c = e.target.closest && e.target.closest(".episode-card"); if (c) enter(c); });
    grid.addEventListener("focusout", (e) => { const c = e.target.closest && e.target.closest(".episode-card"); if (c && !c.matches(":hover")) { const lines = c.querySelectorAll(".line"); gsap.to(lines, { opacity: 0, duration: .4, overwrite: true, onComplete: () => gsap.set(lines, { clearProps: "all" }) }); } });

    splitAll();
    if (ScrollTrigger) {
        ScrollTrigger.addEventListener("refreshInit", revertAll);
        ScrollTrigger.addEventListener("refresh", splitAll);
    }
    return { root };
}
