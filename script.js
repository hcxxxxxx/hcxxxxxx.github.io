if ("scrollRestoration" in history) history.scrollRestoration = "manual";

if (!window.location.hash) {
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  requestAnimationFrame(() => document.documentElement.style.removeProperty("scroll-behavior"));
}

const topographyCanvas = document.querySelector(".topography-background");

if (topographyCanvas) {
  const topographyGl = topographyCanvas.getContext("webgl2", { antialias: false, powerPreference: "low-power" });

  if (topographyGl) {
    const vertexSource = `#version 300 es
      in vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
    const fragmentSource = `#version 300 es
      precision highp float;
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      uniform float uTime;
      uniform float uMouseActive;
      out vec4 outColor;

      float field(vec2 p) {
        float t = uTime * 0.045;
        float waves = sin(p.x * 2.15 + sin(p.y * 1.2 + t)) * .54;
        waves += cos(p.y * 2.4 - sin(p.x * 1.45 - t * .8)) * .42;
        waves += sin((p.x + p.y) * 2.7 + t * 1.2) * .28;
        waves += cos(length(p - vec2(.26, -.16)) * 5.2 - t) * .25;
        return waves;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        vec2 p = uv - .5;
        p.x *= uResolution.x / uResolution.y;
        float height = field(p);
        vec2 mouse = uMouse - .5;
        mouse.x *= uResolution.x / uResolution.y;
        float bump = exp(-dot(p - mouse, p - mouse) * 10.0) * .42 * uMouseActive;
        height += bump;

        float bands = height * 3.35;
        float edge = abs(fract(bands) - .5);
        float aa = fwidth(bands) * 1.55;
        float line = 1.0 - smoothstep(.026, .026 + aa, edge);
        float glow = 1.0 - smoothstep(.04, .12 + aa, edge);
        float elevation = clamp((height + 1.25) / 2.5, 0.0, 1.0);
        // Keep the palette in the blue family throughout: no white contour tier.
        // The broad colour field restores the original blue-gradient impression,
        // while each contour still receives its own elevation-based blue.
        float atmosphere = smoothstep(-.7, .9, p.y + sin(p.x * .9 - uTime * .016) * .18);
        vec3 nightBlue = vec3(.008, .025, .10);
        vec3 horizonBlue = vec3(.018, .105, .36);
        vec3 base = mix(nightBlue, horizonBlue, atmosphere);
        float halo = exp(-dot(p - vec2(-.28, .18), p - vec2(-.28, .18)) * 1.25);
        base += vec3(.012, .075, .25) * halo;

        vec3 deepBlue = vec3(.018, .12, .46);
        vec3 midBlue = vec3(.045, .38, .94);
        vec3 skyBlue = vec3(.20, .68, 1.0);
        vec3 blueGlow = mix(deepBlue, midBlue, smoothstep(.05, .78, elevation));
        vec3 contour = mix(midBlue, skyBlue, smoothstep(.35, .92, elevation));
        vec3 color = base;
        color += blueGlow * glow * (.26 + elevation * .22);
        color += contour * line * .88;
        outColor = vec4(color, 1.0);
      }`;

    function compileTopographyShader(type, source) {
      const shader = topographyGl.createShader(type);
      topographyGl.shaderSource(shader, source);
      topographyGl.compileShader(shader);
      return shader;
    }

    const topographyProgram = topographyGl.createProgram();
    const vertexShader = compileTopographyShader(topographyGl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileTopographyShader(topographyGl.FRAGMENT_SHADER, fragmentSource);
    topographyGl.attachShader(topographyProgram, vertexShader);
    topographyGl.attachShader(topographyProgram, fragmentShader);
    topographyGl.linkProgram(topographyProgram);
    topographyGl.useProgram(topographyProgram);

    const geometry = topographyGl.createBuffer();
    topographyGl.bindBuffer(topographyGl.ARRAY_BUFFER, geometry);
    topographyGl.bufferData(topographyGl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), topographyGl.STATIC_DRAW);
    const position = topographyGl.getAttribLocation(topographyProgram, "position");
    topographyGl.enableVertexAttribArray(position);
    topographyGl.vertexAttribPointer(position, 2, topographyGl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: topographyGl.getUniformLocation(topographyProgram, "uResolution"),
      mouse: topographyGl.getUniformLocation(topographyProgram, "uMouse"),
      time: topographyGl.getUniformLocation(topographyProgram, "uTime"),
      mouseActive: topographyGl.getUniformLocation(topographyProgram, "uMouseActive")
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { currentX: .5, currentY: .5, targetX: .5, targetY: .5, active: 0 };
    let width = 0;
    let height = 0;

    function resizeTopography() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.round(window.innerWidth * ratio);
      height = Math.round(window.innerHeight * ratio);
      topographyCanvas.width = width;
      topographyCanvas.height = height;
      topographyGl.viewport(0, 0, width, height);
    }

    function renderTopography(time) {
      pointer.currentX += (pointer.targetX - pointer.currentX) * .055;
      pointer.currentY += (pointer.targetY - pointer.currentY) * .055;
      topographyGl.uniform2f(uniforms.resolution, width, height);
      topographyGl.uniform2f(uniforms.mouse, pointer.currentX, 1 - pointer.currentY);
      topographyGl.uniform1f(uniforms.time, time * .001);
      topographyGl.uniform1f(uniforms.mouseActive, pointer.active);
      topographyGl.drawArrays(topographyGl.TRIANGLES, 0, 3);
    }

    function animateTopography(time) {
      renderTopography(reducedMotion ? 0 : time);
      if (!reducedMotion && !document.hidden) requestAnimationFrame(animateTopography);
    }

    window.addEventListener("resize", () => { resizeTopography(); renderTopography(0); }, { passive: true });
    window.addEventListener("pointermove", (event) => {
      pointer.targetX = event.clientX / window.innerWidth;
      pointer.targetY = event.clientY / window.innerHeight;
      pointer.active = 1;
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !reducedMotion) requestAnimationFrame(animateTopography);
    });
    resizeTopography();
    requestAnimationFrame(animateTopography);
  } else {
    topographyCanvas.classList.add("topography-background--fallback");
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
  const smoothing = 1 - Math.exp(-elapsed / 0.1);
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
  if (animationFrame) cancelAnimationFrame(animationFrame);
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
      const proximity = Math.max(0, 1 - distance / 100);
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
