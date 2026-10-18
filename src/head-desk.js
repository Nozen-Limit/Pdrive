function mount(host) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const move = (e) => {
    if (reduced.matches) return;
    const b = host.getBoundingClientRect();
    host.style.setProperty(
      "--desk-x",
      `${((e.clientX - b.left) / b.width - 0.5) * -10}px`,
    );
    host.style.setProperty(
      "--desk-y",
      `${((e.clientY - b.top) / b.height - 0.5) * -7}px`,
    );
  };
  const reset = () => {
    host.style.setProperty("--desk-x", "0px");
    host.style.setProperty("--desk-y", "0px");
  };
  host.addEventListener("pointermove", move, { passive: true });
  host.addEventListener("pointerleave", reset);
  reduced.addEventListener("change", reset);
  return () => {
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerleave", reset);
    reduced.removeEventListener("change", reset);
  };
}
let active = null,
  cleanup = null;
function sync() {
  const host = document.querySelector("#head-desk");
  if (host === active) return;
  cleanup?.();
  active = host;
  cleanup = host ? mount(host) : null;
}
new MutationObserver(sync).observe(document.querySelector("#app"), {
  childList: true,
});
sync();
