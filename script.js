if ("scrollRestoration" in history) history.scrollRestoration = "manual";

if (!window.location.hash) {
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  requestAnimationFrame(() => document.documentElement.style.removeProperty("scroll-behavior"));
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
