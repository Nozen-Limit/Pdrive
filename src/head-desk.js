import * as T from "three";
let active = null,
  cleanup = null;
function mount(host) {
  let r;
  try {
    r = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    return () => {};
  }
  r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  r.shadowMap.enabled = true;
  r.shadowMap.type = T.PCFSoftShadowMap;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.35;
  const canvas = r.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(32, 1, 0.1, 70);
  camera.position.set(4, 7, 9);
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight("#f3f6ff", "#8f8677", 2));
  const light = new T.DirectionalLight("#fff1dc", 3);
  light.position.set(-5, 12, 5);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, {
    left: -12,
    right: 12,
    top: 10,
    bottom: -10,
  });
  light.shadow.normalBias = 0.025;
  scene.add(light);
  const woodCanvas = document.createElement("canvas");
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const ctx = woodCanvas.getContext("2d");
  ctx.fillStyle = "#a38465";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 170; i++) {
    ctx.strokeStyle = `rgba(70,43,24,${0.025 + (i % 5) * 0.008})`;
    ctx.beginPath();
    ctx.moveTo(0, i * 1.6);
    ctx.bezierCurveTo(70, i * 1.6 + 4, 180, i * 1.6 - 3, 256, i * 1.6 + 2);
    ctx.stroke();
  }
  const texture = new T.CanvasTexture(woodCanvas);
  texture.colorSpace = T.SRGBColorSpace;
  const wood = new T.MeshStandardMaterial({ map: texture, roughness: 0.65 }),
    paper = new T.MeshStandardMaterial({ color: "#f8f5eb", roughness: 0.9 }),
    metal = new T.MeshStandardMaterial({
      color: "#a7b2bc",
      metalness: 0.8,
      roughness: 0.26,
    });
  function box(parent, w, h, d, x, y, z, material) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const mat = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.65 });
  box(scene, 14, 0.35, 7.3, 0, -0.4, 0, wood);
  const teacher = host.dataset.deskRole === "teacher";
  const targets = [],
    objects = [],
    labels = [];
  const labelNames = teacher
    ? { reviews: "Submit module", library: "My modules", teachers: "My notes" }
    : {
        reviews: "Pending reviews",
        library: "Approved modules",
        teachers: "Teachers",
      };
  const routes = teacher
    ? { reviews: "submit", library: "modules", teachers: "notes" }
    : { reviews: "reviews", library: "library", teachers: "teachers" };
  function group(route, x, z) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.userData.route = routes[route];
    scene.add(g);
    targets.push(g);
    objects.push(g);
    const label = document.createElement("button");
    label.className = "desk-object-label";
    label.textContent = labelNames[route];
    label.addEventListener("click", () => window.go(routes[route]));
    host.append(label);
    labels.push({ label, group: g });
    return g;
  }
  const navy = mat("#4b6285");
  if (teacher) {
    const notebook = group("reviews", -4, 0.3);
    box(notebook, 3.5, 0.13, 3.2, 0, 0.02, 0, navy);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const sheet = box(
          notebook,
          1.65,
          0.035,
          3,
          side * 0.85,
          0.12 + i * 0.035,
          0,
          paper,
        );
        sheet.rotation.z = side * -0.025;
      }
      for (let row = 0; row < 10; row++)
        box(
          notebook,
          1.26,
          0.008,
          0.017,
          side * 0.85,
          0.32,
          -1.1 + row * 0.23,
          mat("#c5ced9"),
        );
    }
    box(notebook, 0.055, 0.045, 3.05, 0, 0.32, 0, mat("#a7a19b"));
    const ribbon = box(
      notebook,
      0.09,
      0.018,
      3.2,
      0.5,
      0.33,
      0.2,
      mat("#bd8c7d"),
    );
    ribbon.rotation.y = 0.04;
    const folders = group("library", 0, 0.1);
    for (let i = 0; i < 3; i++) {
      const cover = box(
        folders,
        3,
        0.075,
        3.45,
        (i - 1) * 0.13,
        0.07 + i * 0.19,
        (i - 1) * 0.09,
        mat(["#708697", "#89a69a", "#a0acc4"][i]),
      );
      cover.rotation.y = (i - 1) * 0.045;
      box(
        folders,
        2.85,
        0.1,
        3.2,
        (i - 1) * 0.13,
        0.14 + i * 0.19,
        (i - 1) * 0.09,
        paper,
      );
      box(
        folders,
        0.85,
        0.08,
        0.3,
        -0.85 + i * 0.16,
        0.11 + i * 0.19,
        -1.8,
        mat(["#708697", "#89a69a", "#a0acc4"][i]),
      );
    }
    box(folders, 1.8, 0.016, 0.65, 0, 0.64, -0.65, paper);
    for (let i = 0; i < 3; i++)
      box(
        folders,
        1.2 - i * 0.1,
        0.009,
        0.022,
        0,
        0.655,
        -0.8 + i * 0.15,
        mat("#aeb9c7"),
      );
    const notes = group("teachers", 4, 0.1);
    for (let i = 0; i < 9; i++)
      box(
        notes,
        2,
        0.035,
        2.15,
        (i % 3) * 0.015,
        0.06 + i * 0.036,
        0,
        mat(i === 8 ? "#e6cc7d" : "#f1dda2"),
      );
    for (let i = 0; i < 4; i++)
      box(
        notes,
        1.35 - i * 0.13,
        0.012,
        0.022,
        -0.07,
        0.39,
        -0.6 + i * 0.3,
        mat("#aa9b73"),
      );
    const pencil = box(scene, 0.09, 0.09, 3, -2, 0.12, 2.7, mat("#c6a565"));
    pencil.rotation.y = 0.55;
    box(scene, 0.13, 0.12, 0.3, -1.25, 0.13, 3.9, mat("#c49a94"));
  } else {
    const stack = group("reviews", -4, 0.3);
    for (let i = 0; i < 8; i++) {
      const p = box(
        stack,
        2.75,
        0.065,
        3.25,
        (i % 3) * 0.045,
        i * 0.07,
        0,
        paper,
      );
      p.rotation.y = ((i % 3) - 1) * 0.015;
    }
    box(stack, 2.85, 0.05, 3.3, 0.03, 0.59, 0, navy);
    box(stack, 1.9, 0.015, 0.7, 0, 0.625, -0.6, mat("#e9edf4"));
    for (let i = 0; i < 5; i++)
      box(
        stack,
        1.8 - i * 0.15,
        0.008,
        0.025,
        -0.1,
        0.63,
        0.1 + i * 0.2,
        mat("#b4c1d3"),
      );
    const folder = group("library", 0, 0.1),
      green = mat("#6f8a79");
    box(folder, 3.1, 0.1, 3.5, 0, 0.04, 0, green);
    box(folder, 1, 0.13, 0.4, -0.8, 0.08, -1.8, green);
    for (let i = 0; i < 4; i++)
      box(folder, 2.8, 0.04, 3.1, 0, 0.13 + i * 0.045, 0, paper);
    const cover = box(folder, 3.1, 0.07, 3.5, 0, 0.37, -0.1, green);
    cover.rotation.x = -0.09;
    box(folder, 0.85, 0.02, 0.85, 0.7, 0.61, 0.4, mat("#e5eee6"));
    const checkMaterial = mat("#64836c");
    const check1 = box(
      folder,
      0.14,
      0.03,
      0.43,
      0.55,
      0.64,
      0.45,
      checkMaterial,
    );
    check1.rotation.y = -0.7;
    const check2 = box(
      folder,
      0.14,
      0.03,
      0.75,
      0.79,
      0.64,
      0.37,
      checkMaterial,
    );
    check2.rotation.y = 0.65;
    const cards = group("teachers", 4, 0.1);
    for (let i = 0; i < 3; i++) {
      const card = box(
        cards,
        2.4,
        0.08,
        1.5,
        i * 0.08,
        0.1 + i * 0.1,
        (i - 1) * 0.55,
        paper,
      );
      card.rotation.y = -0.12 + i * 0.07;
    }
    box(cards, 0.65, 0.035, 0.7, -0.65, 0.37, 0.7, mat("#b5c4db"));
    for (let i = 0; i < 3; i++)
      box(
        cards,
        0.9 - i * 0.15,
        0.02,
        0.035,
        0.35,
        0.37,
        0.4 + i * 0.2,
        mat("#8398b3"),
      );
    const stamp = new T.Group();
    stamp.position.set(1.9, 0.05, -2.1);
    scene.add(stamp);
    box(stamp, 0.95, 0.18, 0.65, 0, 0.1, 0, mat("#353d42"));
    box(stamp, 0.85, 0.13, 0.58, 0, 0.25, 0, metal);
    const knob = new T.Mesh(
      new T.CylinderGeometry(0.22, 0.12, 0.65, 24),
      mat("#6b4937"),
    );
    knob.position.y = 0.6;
    knob.castShadow = true;
    stamp.add(knob);
    const cap = new T.Mesh(new T.SphereGeometry(0.27, 20, 12), mat("#6b4937"));
    cap.scale.y = 0.65;
    cap.position.y = 0.95;
    stamp.add(cap);
    const pen = box(scene, 0.11, 0.1, 2.8, -2, 0.1, 2.8, metal);
    pen.rotation.y = 0.4;
    const grip = box(scene, 0.15, 0.13, 0.65, -1.57, 0.12, 3.8, navy);
    grip.rotation.y = 0.4;
  }
  const ray = new T.Raycaster(),
    pointer = new T.Vector2();
  let hovered = null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function hit(e) {
    const b = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - b.left) / b.width) * 2 - 1,
      (-(e.clientY - b.top) / b.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    let o = ray.intersectObjects(targets, true)[0]?.object;
    while (o && !o.userData.route) o = o.parent;
    return o;
  }
  function move(e) {
    hovered = hit(e);
    canvas.style.cursor = hovered ? "pointer" : "default";
  }
  function click(e) {
    const g = hit(e);
    if (g) window.go(g.userData.route);
  }
  function draw() {
    for (const g of objects) {
      const target = hovered === g ? 0.18 : 0;
      g.position.y = reduced.matches
        ? 0
        : T.MathUtils.lerp(g.position.y, target, 0.14);
    }
    r.render(scene, camera);
    for (const [index, { label, group }] of labels.entries()) {
      const point = new T.Vector3(
        group.position.x,
        group.position.y + 1.1,
        group.position.z,
      ).project(camera);
      label.style.left =
        (host.clientWidth < 550
          ? ((index + 0.5) * host.clientWidth) / 3
          : (point.x * 0.5 + 0.5) * host.clientWidth) + "px";
      label.style.top =
        (host.clientWidth < 550
          ? host.clientHeight - 6
          : (-point.y * 0.5 + 0.5) * host.clientHeight) + "px";
    }
  }
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    r.setSize(w, h);
    camera.aspect = w / h;
    camera.position.z = w < 550 ? 19 : 9;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    draw();
  }
  function animate() {
    r.setAnimationLoop(
      !document.hidden && !reduced.matches && innerWidth > 760 ? draw : null,
    );
    draw();
  }
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", () => (hovered = null));
  canvas.addEventListener("click", click);
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", animate);
  reduced.addEventListener("change", animate);
  resize();
  animate();
  return () => {
    r.setAnimationLoop(null);
    removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", animate);
    reduced.removeEventListener("change", animate);
    const geos = new Set(),
      mats = new Set();
    scene.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) mats.add(o.material);
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texture.dispose();
    labels.forEach(({ label }) => label.remove());
    r.dispose();
    canvas.remove();
  };
}
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
