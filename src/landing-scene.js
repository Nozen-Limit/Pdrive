import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
let stop = null;
function mount(host) {
  let renderer;
  try {
    renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch {
    return () => {};
  }
  const canvas = renderer.domElement;
  canvas.className = "campus-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.fog = new T.Fog("#182c37", 32, 88);
  const pmrem = new T.PMREMGenerator(renderer),
    room = new RoomEnvironment(),
    environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.35;
  room.dispose();
  pmrem.dispose();
  const camera = new T.PerspectiveCamera(36, 1, 0.1, 160);
  camera.position.set(23, 13, 32);
  scene.add(new T.HemisphereLight("#cddedc", "#394840", 1.5));
  const sun = new T.DirectionalLight("#ffdfad", 4.2);
  sun.position.set(-14, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -35,
    right: 35,
    top: 28,
    bottom: -28,
    near: 0.5,
    far: 90,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  const campus = new T.Group();
  scene.add(campus);
  campus.position.x = -8;
  campus.rotation.y = -0.13;
  const textures = [];
  let noiseSeed = 91;
  const noise = () => {
    noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
    return noiseSeed / 4294967296;
  };
  function surface(base, grain) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const c = canvas.getContext("2d");
    c.fillStyle = base;
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 12000; i++) {
      c.fillStyle =
        noise() > 0.5 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.045)";
      c.fillRect(noise() * 256, noise() * 256, grain, grain);
    }
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(3, 3);
    textures.push(texture);
    return texture;
  }
  const plaster = surface("#ded9c9", 2),
    stone = surface("#c6c4b6", 3),
    grass = surface("#69745a", 3);
  const mats = {};
  const mat = (color) =>
    (mats[color] ??= new T.MeshStandardMaterial({
      color,
      roughness: 0.82,
      map:
        color === "#d7d4c9"
          ? plaster
          : color === "#e9e3da"
            ? stone
            : color === "#727f68"
              ? grass
              : null,
    }));
  function box(w, h, d, x, y, z, color, parent = campus) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(70, 0.2, 65, 0, -0.65, -7, "#727f68");
  box(26, 0.15, 20, 0, -0.47, 0, "#e9e3da");
  box(3.8, 0.08, 27, 0, -0.34, 11, "#c0c1b8");
  // A pitched metal roof with real eaves, ridge, and standing seams.
  function roof(x, z, w, d) {
    const pitch = 0.24,
      depth = d + 0.9,
      length = w + 0.9,
      half = depth / 2,
      slant = Math.sqrt(half * half + (half * pitch) ** 2);
    for (const side of [-1, 1]) {
      const panel = box(
        length,
        0.1,
        slant,
        x,
        4.5 + (half * pitch) / 2,
        z + (side * half) / 2,
        "#546879",
      );
      panel.rotation.x = side * Math.atan(pitch);
      for (let i = -length / 2; i < length / 2; i += 0.65) {
        const seam = box(
          0.035,
          0.045,
          slant,
          x + i,
          4.57 + (half * pitch) / 2,
          z + (side * half) / 2,
          "#6b7d88",
        );
        seam.rotation.x = side * Math.atan(pitch);
      }
    }
    box(length, 0.11, 0.14, x, 4.5 + half * pitch, z, "#748791");
  }
  function building(x, z, w, d) {
    box(w, 4.2, d, x, 2, z, "#d7d4c9");
    box(w + 0.08, 0.3, d + 0.08, x, 0.04, z, "#aaa99e");
    roof(x, z, w, d);
    box(w + 0.15, 0.16, d + 0.15, x, 2.12, z, "#a5b2bc");
    for (let i = 0; i < Math.floor(w / 1.6); i++) {
      const wx = x - w / 2 + 1 + i * 1.6;
      for (const y of [1, 3.12]) {
        const front = z + d / 2;
        box(1.03, 1.25, 0.12, wx, y, front + 0.03, "#6c7a7f");
        const glass = box(0.86, 1.08, 0.06, wx, y, front + 0.105, "#77939c");
        glass.material = glassMaterial;
        box(0.04, 1.15, 0.07, wx, y, front + 0.15, "#c6cdd0");
        box(0.92, 0.045, 0.07, wx, y + 0.04, front + 0.15, "#c6cdd0");
        box(1.15, 0.1, 0.35, wx, y - 0.63, front + 0.14, "#e4e1d5");
        box(1.17, 0.09, 0.5, wx, y + 0.7, front + 0.19, "#a8b6bf");
      }
    }
    // Covered veranda gives the facade depth rather than a flat wall of windows.
    const edge = z + d / 2 + 1.1;
    box(w + 0.6, 0.15, 1.8, x, 2.05, edge - 0.2, "#bec6c7");
    box(w + 0.7, 0.12, 1.9, x, 4.22, edge - 0.2, "#c5cccb");
    for (let px = x - w / 2 + 0.3; px < x + w / 2; px += 2.2) {
      box(0.14, 4.2, 0.14, px, 2, edge + 0.55, "#b6c1c4");
      box(0.25, 0.12, 0.25, px, 0, edge + 0.55, "#989e9d");
    }
    box(w, 0.08, 0.065, x, 2.85, edge + 0.55, "#8496a1");
    for (let px = x - w / 2; px < x + w / 2; px += 0.42)
      box(0.035, 0.75, 0.035, px, 2.45, edge + 0.55, "#8c9fa9");
  }
  const glassMaterial = new T.MeshPhysicalMaterial({
    color: "#6a8c97",
    metalness: 0.25,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  });
  building(-6, -4, 10, 4);
  building(6, -4, 10, 4);
  building(-11, 1, 3.5, 9);
  box(2.1, 2.8, 0.35, 0, 1.25, -1.8, "#465b63");
  box(0.06, 2.7, 0.08, 0, 1.3, -1.57, "#b4c4c5");
  box(3.8, 0.18, 2.4, 0, 3.1, -0.8, "#d1d4cc");
  for (const x of [-1.65, 1.65]) box(0.15, 3.2, 0.15, x, 1.2, 0.2, "#8f9c99");
  // Recessed entrance and a timber pergola at the edge of the courtyard.
  box(4.2, 0.25, 1.1, 0, -0.22, 0.5, "#b8b9ae");
  for (let i = 0; i < 3; i++)
    box(
      4.6 + i * 0.45,
      0.1,
      0.38,
      0,
      -0.25 - i * 0.08,
      1.05 + i * 0.38,
      "#c9c6b9",
    );
  for (const x of [-7, -3])
    for (const z of [2, 5]) box(0.14, 2.7, 0.14, x, 1.1, z, "#816b53");
  for (let x = -7.3; x <= -2.7; x += 0.42)
    box(0.12, 0.15, 3.7, x, 2.5, 3.5, "#9c8669");
  box(3, 0.1, 16, 0, -0.15, 2, "#d3ddea");
  // Architectural rhythm: entrance steps, courtyard seating and warm walkway lamps.
  for (let i = 0; i < 3; i++)
    box(
      3.5 - i * 0.25,
      0.14,
      1.3 - i * 0.2,
      0,
      -0.1 + i * 0.14,
      -1 + i * 0.2,
      "#c3d1e1",
    );
  for (let x of [-7, 7])
    for (let z of [2, 6]) {
      box(2, 0.17, 0.7, x, 0.5, z, "#8b6953");
      box(0.12, 0.6, 0.5, x - 0.7, 0.15, z, "#60738b");
      box(0.12, 0.6, 0.5, x + 0.7, 0.15, z, "#60738b");
    }
  for (let x of [-2.3, 2.3])
    for (let z of [2, 7]) {
      box(0.08, 1.4, 0.08, x, 0.6, z, "#526884");
      const bulb = new T.Mesh(
        new T.SphereGeometry(0.15, 8, 6),
        new T.MeshStandardMaterial({
          color: "#ffe1a6",
          emissive: "#ffce82",
          emissiveIntensity: 1.8,
        }),
      );
      bulb.position.set(x, 1.4, z);
      campus.add(bulb);
    }
  // Layered irregular foliage, branching trunks and understory planting.
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const foliage = new T.IcosahedronGeometry(1, 2),
    trunkGeo = new T.CylinderGeometry(0.09, 0.16, 1, 8);
  for (const x of [-9, -5, 5, 9])
    for (const z of [5, 9]) {
      box(2.5, 0.25, 2.2, x, -0.07, z, "#b9b8aa");
      box(2.3, 0.07, 2, x, 0.1, z, "#5f7258");
      const trunk = new T.Mesh(trunkGeo, mat("#71624e"));
      trunk.scale.y = 2.3;
      trunk.position.set(x, 1.2, z);
      trunk.castShadow = true;
      campus.add(trunk);
      for (let j = 0; j < 9; j++) {
        const angle = j * 2.4,
          r = 0.4 + random() * 0.7;
        const leaf = new T.Mesh(
          foliage,
          mat(["#526e54", "#698261", "#7c9069", "#5c795b"][j % 4]),
        );
        leaf.position.set(
          x + Math.cos(angle) * r,
          2.5 + random() * 0.95,
          z + Math.sin(angle) * r,
        );
        leaf.scale.set(
          0.65 + random() * 0.3,
          0.75 + random() * 0.4,
          0.6 + random() * 0.35,
        );
        leaf.castShadow = true;
        leaf.receiveShadow = true;
        campus.add(leaf);
      }
      for (let j = 0; j < 5; j++) {
        const shrub = new T.Mesh(foliage, mat("#748166"));
        shrub.scale.set(0.35, 0.27, 0.35);
        shrub.position.set(x - 1 + random() * 2, 0.3, z - 0.8 + random() * 1.6);
        campus.add(shrub);
      }
    }
  // Fine paving joints and lawn edging establish scale at courtyard level.
  for (let x = -10; x <= 10; x += 1.2)
    box(0.013, 0.008, 14, x, -0.19, 1, "#c7c4ba");
  for (let z = -5; z <= 8; z += 1.2)
    box(21, 0.008, 0.013, 0, -0.185, z, "#c7c4ba");
  for (let i = 0; i < 16; i++) {
    const angle = i * 0.7,
      x = Math.sin(angle) * 23,
      z = -14 - Math.cos(angle) * 8;
    const foliageMesh = new T.Mesh(
      new T.IcosahedronGeometry(2 + random(), 2),
      mat(["#485f4d", "#596e54", "#6c7e5c"][i % 3]),
    );
    foliageMesh.position.set(x, 2.6 + random() * 2, z);
    foliageMesh.scale.y = 1.25;
    foliageMesh.castShadow = true;
    scene.add(foliageMesh);
  }
  const clouds = [];
  let px = 0,
    py = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const move = (e) => {
    px = (e.clientX / innerWidth - 0.5) * 2;
    py = (e.clientY / innerHeight - 0.5) * 2;
  };
  const resize = () => {
    const width = host.clientWidth * (innerWidth > 760 ? 0.72 : 1),
      height = host.clientHeight * (innerWidth > 760 ? 0.65 : 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw(0);
  };
  function draw(time) {
    camera.position.x +=
      (21 + (reduced.matches ? 0 : px * 1.5) - camera.position.x) * 0.04;
    camera.position.y +=
      (13 + (reduced.matches ? 0 : py * 0.7) - camera.position.y) * 0.04;
    camera.lookAt(-7, 0.6, 0);
    if (!reduced.matches)
      clouds.forEach(
        (c, i) =>
          (c.position.x = -12 + i * 8 + Math.sin(time * 0.00015 + i) * 1.1),
      );
    renderer.render(scene, camera);
  }
  function loop() {
    renderer.setAnimationLoop(
      !document.hidden && !reduced.matches ? draw : null,
    );
    draw(0);
  }
  addEventListener("pointermove", move, { passive: true });
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", loop);
  reduced.addEventListener("change", loop);
  resize();
  loop();
  return () => {
    renderer.setAnimationLoop(null);
    removeEventListener("pointermove", move);
    removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", loop);
    reduced.removeEventListener("change", loop);
    const materials = new Set();
    scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) materials.add(o.material);
    });
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    environment.dispose();
    renderer.dispose();
    canvas.remove();
  };
}
let current = null;
function sync() {
  const host = document.querySelector(".clean-login");
  if (host === current) return;
  stop?.();
  current = host;
  stop = host ? mount(host) : null;
}
new MutationObserver(sync).observe(document.querySelector("#app"), {
  childList: true,
});
sync();
