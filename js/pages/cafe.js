/* ==========================================================================
   Latte with Lata - js/pages/cafe.js (PAGE lane cafe + menu; contract: export default function init(ctx), no-op when the DOM is absent)
   The page needs almost nothing of its own: split titles, reveals, the floating stamp, the zoom-settle windows and the gallery rail
   ([data-carousel]) are all started by js/page.js. The FAQ list is native <details>/<summary> and works without any script. This module only:
     - opens (and scrolls to) a FAQ item that is deep-linked (cafe.html#dogs), also on hashchange;
     - re-measures ScrollTrigger after an item opens or closes, because the page below it moves (debounced past the 300 ms height transition).
   ========================================================================== */
export default function init(ctx = {}) {
    const root = document.getElementById("p-cafe-06-faqs");
    if (!root) return null;                                             // not the cafe page (file contract)
    const items = Array.from(root.querySelectorAll("details.faq__item"));
    if (!items.length) return null;

    const refresh = typeof ctx.refresh === "function" ? ctx.refresh : () => {};
    let timer = 0;
    const later = () => { clearTimeout(timer); timer = setTimeout(refresh, 380); };
    items.forEach((d) => d.addEventListener("toggle", later));

    function openFromHash() {
        const id = decodeURIComponent(window.location.hash.slice(1));
        const el = id ? document.getElementById(id) : null;
        if (!el || !items.includes(el)) return;
        el.open = true;
        el.scrollIntoView({ block: "start" });
    }
    window.addEventListener("hashchange", openFromHash);
    openFromHash();

    return { faqs: items.length };
}
