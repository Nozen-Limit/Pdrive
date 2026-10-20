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
  cleanup = null,
  activeMenu = null,
  cleanupMenu = null;
function menuWaves(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "menu-waves";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => canvas.remove();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0,
    inView = true,
    time = 0,
    last = 0,
    tint = "#b7c7df";
  const color = () => {
    tint =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--sikap-accent")
        .trim() || "#b7c7df";
  };
  const draw = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio, 1.5);
    if (
      canvas.width !== Math.round(w * ratio) ||
      canvas.height !== Math.round(h * ratio)
    ) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = tint;
    for (let i = 0; i < 34; i++) {
      ctx.beginPath();
      ctx.lineWidth = i % 5 === 0 ? 1 : 0.55;
      ctx.globalAlpha =
        0.035 + 0.045 * Math.pow(Math.sin(i * 0.3 + time * 0.12), 2);
      for (let x = -20; x <= w + 20; x += 6) {
        const y =
          h * 0.79 +
          (i - 17) * 7 +
          Math.sin((x / w) * 4.7 + time * 0.33 + i * 0.065) * h * 0.095 +
          Math.sin((x / w) * 8 - time * 0.2) * 10;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };
  const tick = (now) => {
    if (now - last >= 40) {
      time += Math.min((now - last) / 1000, 0.1);
      last = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  };
  const loop = () => {
    cancelAnimationFrame(frame);
    draw();
    if (!document.hidden && inView && !reduced.matches) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };
  const theme = () => {
    color();
    draw();
  };
  const resize = new ResizeObserver(draw);
  resize.observe(host);
  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    loop();
  });
  visibility.observe(host);
  color();
  loop();
  document.addEventListener("visibilitychange", loop);
  reduced.addEventListener("change", loop);
  window.addEventListener("sikap-appearance", theme);
  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    visibility.disconnect();
    document.removeEventListener("visibilitychange", loop);
    reduced.removeEventListener("change", loop);
    window.removeEventListener("sikap-appearance", theme);
    canvas.remove();
  };
}
function sync() {
  const menu = document.querySelector(".app:not(.overview-app) .sidebar");
  if (menu !== activeMenu) {
    cleanupMenu?.();
    activeMenu = menu;
    cleanupMenu = menu ? menuWaves(menu) : null;
  }
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
