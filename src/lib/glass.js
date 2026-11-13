// Pil kaca "liquid glass" otomatis untuk semua grup tombol (.seg, .tabs) dan menu samping:
// pil meluncur + memantul ke tombol yang aktif (aria-pressed / aria-current). Dipasang sekali di main.jsx.
const GROUPS = ".seg, .tabs, .side nav";
const ACTIVE = ':scope > [aria-pressed="true"], :scope > [aria-current="page"]';
function place(g) {
  const on = g.querySelector(ACTIVE);
  let pill = g.querySelector(":scope > .glass-pill");
  if (!on) { pill?.remove(); return; }
  const k = [on.offsetLeft, on.offsetTop, on.offsetWidth, on.offsetHeight].join(",");
  if (pill?.dataset.k === k) return;
  const first = !pill;
  if (first) { pill = document.createElement("span"); pill.className = "glass-pill"; pill.setAttribute("aria-hidden", "true"); pill.style.transition = "none"; g.prepend(pill); }
  pill.dataset.k = k;
  Object.assign(pill.style, { transform: `translate(${on.offsetLeft}px, ${on.offsetTop}px)`, width: on.offsetWidth + "px", height: on.offsetHeight + "px" });
  if (first) requestAnimationFrame(() => requestAnimationFrame(() => { pill.style.transition = ""; }));
  else { pill.classList.remove("wob"); void pill.offsetWidth; pill.classList.add("wob"); }
}
let raf = 0;
const all = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => document.querySelectorAll(GROUPS).forEach(place)); };
new MutationObserver(all).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed", "aria-current"] });
addEventListener("resize", all);
