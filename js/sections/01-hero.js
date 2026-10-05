/* ==========================================================================
   01-hero - Iceberg intro reveal (M6 clip slot, M7 char roll, M8 header fade, M9 tagline) on the Paszkowski
   banner container (M5 exit drift, scroll-driven video play/pause; no autoplay under reduced motion / Save-Data)
   PAGES UPDATE (2026-09-17, PAGES-SPEC 1b): the visible play / pause disc and the click-to-play binding were removed - there is no video control.
   Sources: IB = IC(eberg)/source/js/D51_WxQ5.beautified.js (Intro component, lines 86-210)
            PS = PZ/source/js/modules/_page-scroll.beautified.js
            SP = PZ/source/js/modules/_splide.beautified.js
            DD = teardowns/BEST-PARTS-latte-with-lata.md
   ctx = { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   Init order: call before core.initAll() (this module injects the three .hero__row copies per line and owns the
   `.parallax` drift of .hero__media - it marks the element data-init="parallax" so core.initParallaxStrips skips it).
   ========================================================================== */
const FULL_CLIP = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";   // IB:131-132

export default function init(ctx) {
    const section = document.getElementById("s-01-hero");
    if (!section || section.dataset.heroInit) return;                       // absent or already initialised
    section.dataset.heroInit = "1";

    const { gsap, ScrollTrigger, SplitText, reduceMotion } = ctx;
    const media = section.querySelector(".hero__media");
    const video = section.querySelector(".hero__video");
    const lines = Array.from(section.querySelectorAll(".hero__line"));
    const tagline = section.querySelector(".hero__tagline");
    const mark = section.querySelector(".hero__mark");                       // BK: the white cup mark above the wordmark (decorative <img>)
    const header = document.getElementById("page-header");                  // IB:150 document.querySelector(".header")
    const saveData = !!(navigator.connection && navigator.connection.saveData);   // DD s7: never autoplay on Save-Data
    const autoplayOK = !reduceMotion && !saveData;                           // DD Pick 19 / s7

    /* ---- 1. the three stacked rows per line (IC rows .intro__logo-inner x3, split to .chars) - IB:123-125
            new SplitText(".intro__logo-inner", { type: "chars", charsClass: "chars" })  (charsClass "char" per BUILD-SPEC G6) ---- */
    const rowsPerLine = lines.map((line) => buildRows(line, SplitText));

    /* ---- 2. video: scroll play/pause (IB:115-122), loop cut (assets.md loopHint); autoplay withheld = the poster stays (no control) ---- */
    if (video) {
        const safePlay = () => { const p = video.play(); if (p && p.catch) p.catch(() => {}); };
        ScrollTrigger.create({                                              // IB:115-122
            trigger: section,                                               // IB:116 (y.value = section.intro)
            start: "top bottom",                                            // IB:117
            end: "bottom top",                                              // IB:118
            onToggle: (e) => {                                              // IB:119-121: e.isActive && !isLoading ? play() : pause()
                if (!autoplayOK) return;                                    // reduced motion / Save-Data: the video never plays, the poster shows
                if (e.isActive) safePlay(); else video.pause();
            }
        });
        const loopEnd = Number(video.dataset.loopEnd);                     // assets.md loopHint: restart before the timer shot (INFERRED cut point 33.5 s)
        if (loopEnd > 0) {
            video.addEventListener("timeupdate", () => {                    // IB:94 pattern (currentTime = 0, play) on a time cue instead of "ended"
                if (video.currentTime >= loopEnd) video.currentTime = 0;
            });
        }
        video.addEventListener("playing", () => section.classList.add("hero--playing"), { once: true });   // poster -> video swap marker (DD Pick 4 "swap in the video on canplay") - INFERRED class

        if (autoplayOK) {
            safePlay();                                                     // the autoplay attribute already started it; explicit call covers late init
        } else {
            video.removeAttribute("autoplay");                              // DD s7 "never autoplay on prefers-reduced-motion or Save-Data"
            video.pause();                                                  // there is no control to start it (PAGES-SPEC 1b)
            if (video.currentTime > 0 || video.played.length) video.load();  // the autoplay attribute may have rendered a few frames before this module ran: reset the element so the POSTER shows again
        }
    }

    /* ---- 3. the intro timeline - IB:126-158 verbatim (labels, durations, eases, offsets) ---- */
    if (reduceMotion) {                                                     // DD Pick 19: gsap.set the end state, no timeline
        if (video) gsap.set(video, { webkitClipPath: FULL_CLIP, clipPath: FULL_CLIP });
        rowsPerLine.forEach((rows) => settleRows(rows, gsap));
        rowsPerLine.forEach(unsplitVisibleRow);                             // one text run per line (no per-char seams) - brand pass
        if (tagline) gsap.set(tagline, { opacity: 1 });
        section.classList.add("hero--settled");
    } else {
        const tl = gsap.timeline({                                          // IB:126-129 (onComplete emitted "enable-scroll" - no scroll lock here; class INFERRED)
            paused: true,                                                   // INFERRED (verify-A): started on the next frame, see tl.play(0) below
            onComplete: () => {
                section.classList.add("hero--settled");
                rowsPerLine.forEach(unsplitVisibleRow);                     // brand pass (review POLISH 1): revert the SplitText on the settled row so the
            }                                                               // wordmark is one text run again (no hairline seam between the overlapping Ts)
        }).addLabel("initial");                                             // IB:130
        if (video) {
            tl.to(video, {                                                  // IB:130-134
                webkitClipPath: FULL_CLIP,                                  // IB:131
                clipPath: FULL_CLIP,                                        // IB:132
                duration: 2.2,                                              // IB:133
                ease: "power4.inOut"                                        // IB:134
            }, "initial");
        }
        rowsPerLine.forEach((rows) => {                                     // IB:135-141: per .intro__logo-inner row -> .to(chars, ...) at "initial+=0.6"
            rows.forEach((row) => {                                         // both wordmark lines roll at the same label - INFERRED (Iceberg has one line)
                tl.to(row.chars, {
                    yPercent: -300,                                         // IB:137
                    duration: 3,                                            // IB:138
                    stagger: .07,                                           // IB:139
                    ease: "power4.out"                                      // IB:140
                }, "initial+=0.6");                                         // IB:141
            });
        });
        tl.call(() => rowsPerLine.forEach((rows) => settleRows(rows, gsap)));   // IB:142-149
        const fadeIn = [header, mark].filter(Boolean);                      // BK: the hero mark rides the same header fade (brand pass) - no extra tween label / trigger
        if (fadeIn.length) {
            tl.from(fadeIn, {                                               // IB:150-154 (.header -> #page-header; 00 sets no opacity of its own; the mark sets none either)
                opacity: 0, duration: 1, ease: "power4.out"                 // IB:151-153
            }, "initial+=1.5");                                             // IB:154
        }
        if (tagline) {
            tl.to(tagline, {                                                 // IB:154-158: from(".intro__sentence path", { duration: 1, ease: "power1.inOut", drawSVG: 0 }, "initial+=2")
                opacity: 1, duration: 1, ease: "power1.inOut"               // DrawSVG -> opacity fade of live text (INFERRED substitution, BUILD-SPEC M9)
            }, "initial+=2");                                               // IB:158
        }
        section._heroTimeline = tl;                                         // harness / debugging hook - INFERRED
        // INFERRED (verify-A round 1): the source starts its timeline after the loader; here it is created inside the synchronous
        // bootstrap (all 15 section inits + SplitText + Splide mounts run in the same task), so a timeline started immediately was
        // already at t = 0.30 s on the first paint (measured) and the slot's first 300 ms never showed. Start it on the next frame.
        requestAnimationFrame(() => tl.play(0));
    }

    /* ---- 4. exit drift (M5) - PS:363-380, banner branch: i = the .parallax element, s = i.parent().css({ overflow: "hidden" }) ---- */
    if (media) {
        const i = media;
        const s = i.parentElement;                                          // PS:364 (i.parent())
        s.style.overflow = "hidden";                                        // PS:364-366 (.css({overflow:"hidden"}))
        markInit(i, "parallax");                                            // core.js idempotency token: initParallaxStrips skips this element (it cannot handle the banner branch)
        if (!reduceMotion) {                                                // PS:284 returns before this block under reduceMotion (DD Pick 19)
            gsap.fromTo(i, { y: 0 }, {                                      // PS:368-370
                y: () => i.offsetHeight / 100 * Number(i.getAttribute("data-parallax") || 20),   // PS:371 (o = 1 branch: i.height()/100 * data-parallax) -> 180 @900, 168.8 @844
                // no ease in the source (PS:368-380) -> gsap default power1.out; measured y 86.1 @250 = 180*(1-(1-250/900)^2) confirms it (BUILD-SPEC 01 midScroll)
                scrollTrigger: {
                    trigger: s,                                             // PS:374 (s[0] = .banner)
                    start: () => `top ${Math.min(docTop(s) / window.innerHeight * 100, 100)}%`,   // PS:375 (i.offset().top measured on the untransformed parent - INFERRED) -> "top 0%"
                    end: () => "bottom top",                                // PS:376
                    refreshPriority: stripPriority(s),                      // PS:377 (f - 10 * g.index(r), f = 1e3 PS:21)
                    scrub: true,                                            // PS:378
                    invalidateOnRefresh: true                               // BUILD-SPEC M30 (function-valued start/y)
                }
            });
        }
    }
    return section;
}

/* ---- helpers ---- */

/** Builds the Iceberg row stack inside one .hero__line: three .hero__row copies of the text, each split into .char spans.
    Returns [{ el, chars }] x3. Keeps the plain text when SplitText is unavailable (manual split, same DOM shape). */
function buildRows(line, SplitText) {
    const text = line.textContent.replace(/\s+/g, " ").trim();
    line.textContent = "";
    const rows = [];
    for (let n = 0; n < 3; n++) {                                           // IC markup: .intro__logo-inner x3 (BUILD-SPEC 01 (b))
        const row = document.createElement("span");
        row.className = "hero__row";
        row.textContent = text;
        line.appendChild(row);
        let chars;
        if (SplitText && SplitText.create) {
            const split = SplitText.create(row, { type: "chars", charsClass: "char", aria: "none" });   // IB:123-125 (charsClass "chars" -> "char")
            chars = split.chars;
            row._split = split;
        } else {
            chars = manualChars(row, text);
        }
        rows.push({ el: row, chars });
    }
    return rows;
}

/** fallback splitter: span.char per non-space character, spaces kept as text - INFERRED */
function manualChars(row, text) {
    row.textContent = "";
    const chars = [];
    for (const ch of text) {
        if (ch === " ") { row.appendChild(document.createTextNode(" ")); continue; }
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = ch;
        row.appendChild(span);
        chars.push(span);
    }
    return chars;
}

/** IB:142-149 cleanup: rows 1-2 hidden, row 3 reset to rest (the visible, settled copy). Also the reduced-motion end state. */
function settleRows(rows, gsap) {
    gsap.set([rows[0].el, rows[1].el], { opacity: 0 });                     // IB:143-145
    gsap.set(rows[2].el, { yPercent: 0 });                                  // IB:145-147
    gsap.set(rows[2].chars, { transform: "translateY(0%)" });               // IB:147-149
}

/** brand pass: revert the SplitText of the visible (third) row once it has settled - the row becomes one text run again, so the
    overlapping anti-aliased glyph edges are painted together (no hairline seam, review POLISH 1). Rows 1-2 stay split but hidden. */
function unsplitVisibleRow(rows) {
    const row = rows[2] && rows[2].el;
    if (!row || !row._split || !row._split.revert) return;
    row._split.revert();
    row._split = null;
}

/** document-relative top of an untransformed element (jQuery .offset().top) */
function docTop(el) {
    return el.getBoundingClientRect().top + window.pageYOffset;
}

/** refreshPriority = 1000 - 10 * index of the closest .strip among all .strip (PS:21, PS:377; = core.js stripPriority) */
function stripPriority(el) {
    const strip = el.closest(".strip");
    if (!strip) return 1000;
    return 1000 - 10 * Array.prototype.indexOf.call(document.querySelectorAll(".strip"), strip);
}

/** core.js data-init token convention (idempotency shared with initParallaxStrips) */
function markInit(el, key) {
    const have = (el.dataset.init || "").split(" ").filter(Boolean);
    if (!have.includes(key)) { have.push(key); el.dataset.init = have.join(" "); }
}
