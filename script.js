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
