import * as THREE from "three";

// The book is exclusively point particles; a separate fullscreen shader draws the flowing background.
function mount(host) {
  const stage = host.querySelector(".book-stage"),
    canvas = host.querySelector(".book-dust");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    host.classList.add("book-no-webgl");
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  camera.position.z = 5;
  let seed = 427;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  function pagePoint(u, v, side, layer = 0) {
    const top = 0.745 + 0.095 * Math.sin(u * Math.PI * 0.5);
    const bottom = -0.865 + 0.07 * Math.sin(u * Math.PI * 0.5);
    return [
      side * (u * 0.645 + layer * 0.0014),
      top * (1 - v) + bottom * v - layer * 0.0026,
      0.04 + Math.sin(u * Math.PI) * 0.09 - layer * 0.003,
    ];
  }
  const disposables = [];
  const shared = {
    time: { value: 0 },
    ratio: { value: 1 },
    pointer: { value: new THREE.Vector2(9, 9) },
    pulse: { value: -100 },
    formation: { value: reduced.matches ? 1 : 0 },
    pulseOrigin: { value: new THREE.Vector2(0, 0) },
  };
  const palette = window.sikapAppearance?.();
  shared.particleTint = {
    value: new THREE.Vector3(...(palette?.particles || [0.4, 0.49, 0.64])),
  };
  shared.particleHighlight = {
    value: new THREE.Vector3(...(palette?.highlight || [0.82, 0.88, 0.98])),
  };
  shared.waveTint = {
    value: new THREE.Vector3(...(palette?.waves || [0.09, 0.115, 0.16])),
  };
  shared.aspect = { value: 1 };
  const waveGeometry = new THREE.PlaneGeometry(2, 2);
  const waveMaterial = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: shared,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.999,1.);}`,
    fragmentShader: `precision highp float;varying vec2 vUv;uniform float time;uniform float aspect;uniform vec2 pointer;uniform vec3 waveTint;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      float fbm(vec2 p){float value=0.,a=.5;mat2 r=mat2(.8,-.6,.6,.8);for(int i=0;i<4;i++){value+=a*noise(p);p=r*p*2.03+vec2(3.7,2.1);a*=.5;}return value;}
      void main(){vec2 p=(vUv-.5)*vec2(aspect,1.);float t=time*.055;
        vec2 flow=vec2(fbm(p*2.+vec2(t*.4,-t*.2)),fbm(p*2.+vec2(4.1,-2.3+t*.3)));
        float n=fbm(p*2.3+flow*2.8+vec2(t*.1,-t*.35));
        float bands=pow(.5+.5*sin(p.y*29.+p.x*3.3+n*11.-t*1.3),18.);
        float fine=pow(1.-abs(sin(n*36.+p.x*2.-t*.4)),14.);
        float vignette=1.-smoothstep(.4,1.25,length(p*vec2(.7,1.)));
        vec3 color=vec3(.008,.011,.018)+waveTint*(pow(n,2.)*.9+bands*.24+fine*.12)*vignette;
        color+=(hash(gl_FragCoord.xy)-.5)/600.;gl_FragColor=vec4(color,1.);}`,
  });
  const waves = new THREE.Mesh(waveGeometry, waveMaterial);
  waves.frustumCulled = false;
  waves.renderOrder = -10;
  scene.add(waves);
  disposables.push(waveGeometry, waveMaterial);
  const particlePositions = [],
    particleSeeds = [];
  for (let i = 0; i < 56000; i++) {
    const side = i % 2 ? 1 : -1;
    let u = random(),
      v = random(),
      kind = 0;
    if (i < 18000) {
      kind = 1;
      const edge = Math.floor(i / 2) % 4;
      if (edge === 0) u = 1 - random() * 0.035;
      else if (edge === 1) v = random() * 0.025;
      else if (edge === 2) v = 1 - random() * 0.035;
      else u = random() * 0.02;
    }
    const p = pagePoint(u, v, side, kind ? Math.floor(random() * 12) : 0);
    if (kind) {
      p[0] += (random() - 0.5) * 0.012;
      p[1] += (random() - 0.5) * 0.012;
      p[2] += random() * 0.05;
    } else p[2] += 0.005;
    particlePositions.push(...p);
    particleSeeds.push(u, v, kind, random());
  }
  // Loose particles are drawn from the page silhouette, not an unrelated orbit.
  for (let i = 0; i < 5800; i++) {
    const side = i % 2 ? 1 : -1,
      u = 0.7 + random() * 0.3,
      v = random();
    const p = pagePoint(u, v, side);
    p[0] += side * Math.pow(random(), 2) * 0.19;
    p[1] += (random() - 0.5) * 0.25;
    p[2] += random() * 0.16;
    particlePositions.push(...p);
    particleSeeds.push(u, v, 2, random());
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(particlePositions, 3),
  );
  geometry.setAttribute(
    "seed",
    new THREE.Float32BufferAttribute(particleSeeds, 4),
  );
  disposables.push(geometry);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: shared,
    vertexShader: `attribute vec4 seed;uniform float time;uniform float ratio;uniform vec2 pointer;uniform float pulse;uniform vec2 pulseOrigin;uniform float formation;varying float opacity;varying float brightness;
      void main(){
      float loose=step(1.5,seed.z);float edge=step(.5,seed.z);vec3 target=position;
      if(seed.z>.5&&seed.z<1.5){
        float path=seed.y<.08?seed.x*.25:(seed.x>.9?.25+seed.y*.25:(seed.y>.92?.75-seed.x*.25:1.-seed.y*.25));
        float phase=fract(path+time*(.028+seed.w*.012));float u;float v;
        if(phase<.25){u=phase*4.;v=0.;}else if(phase<.5){u=1.;v=(phase-.25)*4.;}
        else if(phase<.75){u=1.-(phase-.5)*4.;v=1.;}else{u=0.;v=1.-(phase-.75)*4.;}
        target.x=sign(position.x)*(u*.645+seed.w*.012);
        target.y=mix(.745+.095*sin(u*1.5708),-.865+.07*sin(u*1.5708),v)-seed.w*.018;
        target.xy+=vec2(sin(time*.8+seed.w*30.),cos(time*.65+u*6.))*.009;
      }
      float life=fract(seed.y-time*.095);
      if(loose>.5){target.y=mix(.92,-.96,life);target.x+=sin(time*.55+seed.w*12.)*.045;}
      vec3 cloud=vec3(sin(seed.w*73.)*.98,cos(seed.w*57.+seed.x)*.9,seed.w*.25);vec3 p=mix(cloud,target,formation);
      p.x+=sin(time*.8+seed.w*40.)*.012*edge+loose*sin(time*.45+seed.y*9.)*.055;
      p.y+=cos(time*.7+seed.w*30.)*.013*edge+loose*sin(time*.55+seed.w*12.)*.07;
      vec2 delta=p.xy-pointer;float influence=exp(-dot(delta,delta)*40.)*edge;
      p.xy+=normalize(delta+vec2(.00001))*influence*.18;
      float age=max(0.,time-pulse);vec2 away=p.xy-pulseOrigin;
      float ripple=exp(-pow((length(away)-age*.7)*18.,2.))*exp(-age*1.3);
      p.xy+=normalize(away+vec2(.0001))*ripple*.14*edge;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      gl_PointSize=(.65+seed.w*1.3+edge*.35+loose*1.3)*ratio;
      float quiet=step(.12,seed.x)*step(seed.x,.93)*step(.12,seed.y)*step(seed.y,.9);
      opacity=mix(.24,.82,edge)*(1.-loose*.25)*(1.-quiet*.5);
      opacity*=mix(1.,smoothstep(0.,.1,life)*smoothstep(0.,.12,1.-life),loose);
      opacity*=.75+.25*sin(time*.65+seed.w*30.);brightness=seed.w+influence*.8+ripple*.5;}`,
    fragmentShader: `uniform vec3 particleTint;uniform vec3 particleHighlight;varying float opacity;varying float brightness;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;vec3 color=mix(particleTint,particleHighlight,clamp(brightness,0.,1.));gl_FragColor=vec4(color,pow(1.-r,1.4)*opacity);}`,
  });
  disposables.push(material);
  scene.add(new THREE.Points(geometry, material));
  let frame = 0,
    last = 0,
    time = 0,
    inView = true;
  function render() {
    shared.time.value = time;
    shared.formation.value = reduced.matches
      ? 1
      : THREE.MathUtils.smoothstep(time * 2, 0.1, 1.8);
    renderer.render(scene, camera);
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || !inView || reduced.matches) return;
    if (now - last > 32) {
      time += Math.min((now - last) / 1000, 0.05) * 0.5;
      last = now;
      render();
    }
    frame = requestAnimationFrame(tick);
  }
  function loop() {
    cancelAnimationFrame(frame);
    render();
    if (!document.hidden && inView && !reduced.matches) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  const resize = () => {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    if (w <= 700) {
      camera.left = -0.04;
      camera.right = 0.7;
    } else {
      camera.left = -1;
      camera.right = 1;
    }
    camera.updateProjectionMatrix();
    shared.ratio.value = renderer.getPixelRatio();
    shared.aspect.value = w / h;
    render();
  };
  const locate = (e) => {
    const b = stage.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width,
      y = (e.clientY - b.top) / b.height;
    return [camera.left + x * (camera.right - camera.left), 1 - y * 2];
  };
  const move = (e) => {
    if (reduced.matches) return;
    shared.pointer.value.set(...locate(e));
    if (!stage.contains(document.activeElement) && innerWidth > 700) {
      const b = stage.getBoundingClientRect();
      stage.style.setProperty(
        "--book-rx",
        `${(-(e.clientY - b.top - b.height * 0.5) / b.height) * 1.2}deg`,
      );
      stage.style.setProperty(
        "--book-ry",
        `${((e.clientX - b.left - b.width * 0.5) / b.width) * 1.6}deg`,
      );
    }
  };
  const leave = () => {
    shared.pointer.value.set(9, 9);
    stage.style.setProperty("--book-rx", "0deg");
    stage.style.setProperty("--book-ry", "0deg");
  };
  const click = (e) => {
    if (!reduced.matches && !e.target.closest("input,button,label,form")) {
      shared.pulse.value = time;
      shared.pulseOrigin.value.set(...locate(e));
    }
  };
  stage.addEventListener("pointermove", move, { passive: true });
  stage.addEventListener("pointerleave", leave);
  stage.addEventListener("click", click);
  const size = new ResizeObserver(resize);
  size.observe(stage);
  const visible = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    loop();
  });
  visible.observe(stage);
  document.addEventListener("visibilitychange", loop);
  reduced.addEventListener("change", loop);
  const changePalette = (e) => {
    shared.particleTint.value.set(...e.detail.particles);
    shared.particleHighlight.value.set(...e.detail.highlight);
    shared.waveTint.value.set(...e.detail.waves);
    render();
  };
  window.addEventListener("sikap-appearance", changePalette);
  host.classList.add("book-emerge");
  resize();
  loop();
  return () => {
    cancelAnimationFrame(frame);
    size.disconnect();
    visible.disconnect();
    stage.removeEventListener("pointermove", move);
    stage.removeEventListener("pointerleave", leave);
    stage.removeEventListener("click", click);
    document.removeEventListener("visibilitychange", loop);
    reduced.removeEventListener("change", loop);
    window.removeEventListener("sikap-appearance", changePalette);
    disposables.forEach((x) => x.dispose());
    renderer.dispose();
  };
}
let current = null,
  stop = null;
function sync() {
  const host = document.querySelector(".book-landing");
  if (host === current) return;
  stop?.();
  current = host;
  stop = host ? mount(host) : null;
}
new MutationObserver(sync).observe(document.querySelector("#app"), {
  childList: true,
});
sync();
