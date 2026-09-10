if ("scrollRestoration" in history) history.scrollRestoration = "manual";

if (!window.location.hash) {
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  requestAnimationFrame(() => document.documentElement.style.removeProperty("scroll-behavior"));
}

const gradientBlindsCanvas = document.querySelector(".gradient-blinds-background");

if (gradientBlindsCanvas) {
  const blindsGl = gradientBlindsCanvas.getContext("webgl2", { alpha: true, antialias: true });

  if (blindsGl) {
    const vertexSource = `#version 300 es
      in vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
    const fragmentSource = `#version 300 es
      precision mediump float;
      uniform vec3 iResolution;
      uniform vec2 iMouse;
      uniform float iTime;
      uniform float uBlindCount;
      out vec4 outColor;

      vec3 getGradientColor(float t) {
        return mix(vec3(1.0, .6235294, .8627451), vec3(.3215686, .1529412, 1.0), clamp(t, 0.0, 1.0));
      }

      void main() {
        vec2 uv0 = gl_FragCoord.xy / iResolution.xy;
        float aspect = iResolution.x / iResolution.y;
        vec2 p = uv0 * 2.0 - 1.0;
        p.x *= aspect;
        float angle = radians(-45.0);
        float c = cos(angle);
        float s = sin(angle);
        vec2 pr = mat2(c, -s, s, c) * p;
        pr.x /= aspect;
        vec2 uv = pr * .5 + .5;
        vec3 base = getGradientColor(uv.x);
        vec2 offset = iMouse / iResolution.xy;
        float d = length(uv0 - offset);
        float spot = (1.0 - 2.0 * pow(d / .5, 1.0)) * .72;
        float stripe = fract(uv.x * max(uBlindCount, 1.0));
        float stripeAA = clamp(max(uBlindCount, 1.0) * 1.25 / min(iResolution.x, iResolution.y), .001, .12);
        float edgeDistance = min(stripe, 1.0 - stripe);
        float edgeBlend = 1.0 - smoothstep(0.0, stripeAA, edgeDistance);
        stripe = mix(stripe, .5, edgeBlend);
        vec3 revealSignal = vec3(spot) + base - vec3(stripe);
        vec3 color = revealSignal * .78;
        outColor = vec4(color, 1.0);
      }`;

    function compileBlindsShader(type, source) {
      const shader = blindsGl.createShader(type);
      blindsGl.shaderSource(shader, source);
      blindsGl.compileShader(shader);
      return shader;
    }

    const blindsProgram = blindsGl.createProgram();
    blindsGl.attachShader(blindsProgram, compileBlindsShader(blindsGl.VERTEX_SHADER, vertexSource));
    blindsGl.attachShader(blindsProgram, compileBlindsShader(blindsGl.FRAGMENT_SHADER, fragmentSource));
    blindsGl.linkProgram(blindsProgram);
    blindsGl.useProgram(blindsProgram);

    const geometry = blindsGl.createBuffer();
    blindsGl.bindBuffer(blindsGl.ARRAY_BUFFER, geometry);
    blindsGl.bufferData(blindsGl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), blindsGl.STATIC_DRAW);
    const position = blindsGl.getAttribLocation(blindsProgram, "position");
    blindsGl.enableVertexAttribArray(position);
    blindsGl.vertexAttribPointer(position, 2, blindsGl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: blindsGl.getUniformLocation(blindsProgram, "iResolution"),
      mouse: blindsGl.getUniformLocation(blindsProgram, "iMouse"),
      time: blindsGl.getUniformLocation(blindsProgram, "iTime"),
      blindCount: blindsGl.getUniformLocation(blindsProgram, "uBlindCount")
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };
    let width = 0;
    let height = 0;
    let lastFrame = 0;

    function resizeGradientBlinds() {
      const dpr = window.devicePixelRatio || 1;
      width = Math.round(window.innerWidth * dpr);
      height = Math.round(window.innerHeight * dpr);
      gradientBlindsCanvas.width = width;
      gradientBlindsCanvas.height = height;
      blindsGl.viewport(0, 0, width, height);
      const blindCount = Math.min(16, Math.max(1, Math.floor(window.innerWidth / 60)));
      blindsGl.uniform1f(uniforms.blindCount, blindCount);
      if (!lastFrame) {
        pointer.currentX = pointer.targetX = width / 2;
        pointer.currentY = pointer.targetY = height / 2;
      }
    }

    function renderGradientBlinds(time) {
      const dt = lastFrame ? (time - lastFrame) / 1000 : 0;
      lastFrame = time;
      const factor = 1 - Math.exp(-dt / .15);
      pointer.currentX += (pointer.targetX - pointer.currentX) * factor;
      pointer.currentY += (pointer.targetY - pointer.currentY) * factor;
      blindsGl.uniform3f(uniforms.resolution, width, height, 1);
      blindsGl.uniform2f(uniforms.mouse, pointer.currentX, pointer.currentY);
      blindsGl.uniform1f(uniforms.time, time * .001);
      blindsGl.drawArrays(blindsGl.TRIANGLES, 0, 3);
    }

    function animateGradientBlinds(time) {
      renderGradientBlinds(reducedMotion ? 0 : time);
      if (!reducedMotion && !document.hidden) requestAnimationFrame(animateGradientBlinds);
    }

    window.addEventListener("resize", () => { resizeGradientBlinds(); renderGradientBlinds(0); }, { passive: true });
    window.addEventListener("pointermove", (event) => {
      const dpr = window.devicePixelRatio || 1;
      pointer.targetX = event.clientX * dpr;
      pointer.targetY = (window.innerHeight - event.clientY) * dpr;
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !reducedMotion) requestAnimationFrame(animateGradientBlinds);
    });
    resizeGradientBlinds();
    requestAnimationFrame(animateGradientBlinds);
  } else {
    gradientBlindsCanvas.classList.add("gradient-blinds-background--fallback");
  }
}

const sidebar = document.querySelector(".line-sidebar");
const sidebarItems = [...document.querySelectorAll(".line-sidebar__item")];
const sidebarLinks = [...document.querySelectorAll(".line-sidebar__label")];
const currentEffects = sidebarItems.map((item) => Number(item.style.getPropertyValue("--effect")) || 0);
const targetEffects = [...currentEffects];
let animationFrame;
let lastFrameTime = performance.now();

function animateSidebar(now) {
  const elapsed = Math.min((now - lastFrameTime) / 1000, 0.05);
  const smoothing = 1 - Math.exp(-elapsed / 0.045);
  lastFrameTime = now;
  let isMoving = false;

  sidebarItems.forEach((item, index) => {
    const next = currentEffects[index] + (targetEffects[index] - currentEffects[index]) * smoothing;
    currentEffects[index] = Math.abs(targetEffects[index] - next) < 0.002 ? targetEffects[index] : next;
    item.style.setProperty("--effect", currentEffects[index].toFixed(4));
    isMoving ||= Math.abs(targetEffects[index] - currentEffects[index]) >= 0.002;
  });

  animationFrame = isMoving ? requestAnimationFrame(animateSidebar) : undefined;
}

function startSidebarAnimation() {
  // Do not restart the frame loop for every pointer event: doing so makes a
  // rapidly moving pointer continually postpone the visual update.
  if (animationFrame) return;
  lastFrameTime = performance.now();
  animationFrame = requestAnimationFrame(animateSidebar);
}

function setActiveSidebarItem(activeIndex) {
  sidebarItems.forEach((item, index) => {
    if (index === activeIndex) {
      item.setAttribute("aria-current", "true");
    } else {
      item.removeAttribute("aria-current");
    }
    targetEffects[index] = index === activeIndex ? 1 : 0;
  });
  startSidebarAnimation();
}

if (sidebar) {
  sidebar.addEventListener("pointermove", (event) => {
    sidebarItems.forEach((item, index) => {
      const bounds = item.getBoundingClientRect();
      const distance = Math.abs(event.clientY - (bounds.top + bounds.height / 2));
      const proximity = Math.max(0, 1 - distance / 115);
      targetEffects[index] = proximity * proximity * (3 - 2 * proximity);
    });
    startSidebarAnimation();
  });

  sidebar.addEventListener("pointerleave", () => {
    const activeIndex = sidebarItems.findIndex((item) => item.hasAttribute("aria-current"));
    targetEffects.fill(0);
    if (activeIndex >= 0) targetEffects[activeIndex] = 1;
    startSidebarAnimation();
  });

  sidebarLinks.forEach((link, index) => link.addEventListener("click", () => setActiveSidebarItem(index)));

  const navigationSections = [...document.querySelectorAll("main, main section[id]")];
  let lastScrollActiveIndex = 0;

  function updateSidebarFromScroll() {
    const readingLine = window.innerHeight * 0.2;
    let activeIndex = 0;

    navigationSections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= readingLine) activeIndex = index;
    });

    if (activeIndex !== lastScrollActiveIndex) {
      lastScrollActiveIndex = activeIndex;
      setActiveSidebarItem(activeIndex);
    }
  }

  window.addEventListener("scroll", updateSidebarFromScroll, { passive: true });
  updateSidebarFromScroll();
}

const galleryPanels = [...document.querySelectorAll(".gallery-panel")];
const galleryEffects = galleryPanels.map((panel) => panel.classList.contains("is-active") ? 1 : 0);
const galleryTargets = [...galleryEffects];
const reduceGalleryMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let activeGalleryIndex = galleryEffects.findIndex(Boolean);
let galleryAnimationFrame;
let lastGalleryFrame = performance.now();

function setActiveGalleryPanel(activeIndex) {
  activeGalleryIndex = activeIndex;
  galleryPanels.forEach((panel, index) => {
    const isActive = index === activeIndex;
    panel.classList.toggle("is-active", isActive);
    panel.setAttribute("aria-pressed", String(isActive));
    galleryTargets[index] = isActive ? 1 : 0;
  });
  startGalleryAnimation();
}

function animateGallery(now) {
  const elapsed = Math.min((now - lastGalleryFrame) / 1000, 0.05);
  const smoothing = reduceGalleryMotion ? 1 : 1 - Math.exp(-elapsed / 0.19);
  lastGalleryFrame = now;
  let isMoving = false;

  galleryPanels.forEach((panel, index) => {
    const next = galleryEffects[index] + (galleryTargets[index] - galleryEffects[index]) * smoothing;
    const effect = Math.abs(galleryTargets[index] - next) < 0.0015 ? galleryTargets[index] : next;
    galleryEffects[index] = effect;

    const tiltDirection = index < activeGalleryIndex ? -1 : 1;
    const image = panel.querySelector("img");
    const isCompactGallery = window.matchMedia("(max-width: 640px)").matches;
    panel.style.flexGrow = (1 + effect * 4.2).toFixed(4);
    panel.style.transform = isCompactGallery ? "none" : `rotateY(${(tiltDirection * (1 - effect) * 6).toFixed(3)}deg)`;
    image.style.filter = `grayscale(${(1 - effect).toFixed(4)})`;
    image.style.transform = `translate(-50%, -50%) scale(${(1.12 - effect * .12).toFixed(4)})`;
    isMoving ||= Math.abs(galleryTargets[index] - effect) >= 0.0015;
  });

  galleryAnimationFrame = isMoving ? requestAnimationFrame(animateGallery) : undefined;
}

function startGalleryAnimation() {
  if (galleryAnimationFrame) cancelAnimationFrame(galleryAnimationFrame);
  lastGalleryFrame = performance.now();
  galleryAnimationFrame = requestAnimationFrame(animateGallery);
}

galleryPanels.forEach((panel, index) => {
  panel.addEventListener("click", () => setActiveGalleryPanel(index));
  panel.addEventListener("focus", () => setActiveGalleryPanel(index));
  panel.addEventListener("pointerenter", () => {
    if (window.matchMedia("(hover: hover)").matches) setActiveGalleryPanel(index);
  });
  panel.addEventListener("keydown", (event) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (index + direction + galleryPanels.length) % galleryPanels.length;
    galleryPanels[nextIndex].focus();
  });
});

if (galleryPanels.length) startGalleryAnimation();
window.addEventListener("resize", () => galleryPanels.length && startGalleryAnimation(), { passive: true });
