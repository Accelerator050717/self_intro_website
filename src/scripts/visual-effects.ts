/**
 * Spotlight positioning adapted from React Bits SpotlightCard, TS-CSS.
 * Copyright 2026 David Haz. MIT + Commons Clause; see THIRD_PARTY_NOTICES.md.
 * Astro keeps the links/content server-rendered. No animation runtime needed.
 */
export function enhanceVisuals() {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let paused = false;
  try { paused = localStorage.getItem('ice-paused') === 'true'; } catch { /* Optional storage. */ }
  const running = () => !paused && !reduced.matches && !document.hidden;
  const cleanups: (() => void)[] = [];
  const resetCards: (() => void)[] = [];
  const reveals = new Set<Animation>();

  function syncMotion() {
    root.dataset.motion = running() ? 'enabled' : 'still';
    document.querySelectorAll<HTMLButtonElement>('[data-global-pause]').forEach(button => {
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', (paused ? button.dataset.resumeLabel : button.dataset.pauseLabel)!);
    });
    if (!running() || !finePointer.matches) resetCards.forEach(reset => reset());
    if (!running()) {
      for (const animation of reveals) animation.cancel();
      reveals.clear();
    }
  }
  function preference(event: Event) {
    paused = (event as CustomEvent<boolean>).detail;
    syncMotion();
  }
  function storage(event: StorageEvent) {
    if (event.key === 'ice-paused') { paused = event.newValue === 'true'; syncMotion(); }
  }
  window.addEventListener('ice-pause-change', preference);
  window.addEventListener('storage', storage);
  function restorePreferences(event: PageTransitionEvent) {
    if (!event.persisted) return;
    try { paused = localStorage.getItem('ice-paused') === 'true'; } catch { /* Keep current state. */ }
    window.dispatchEvent(new CustomEvent('ice-pause-change', { detail: paused }));
  }
  window.addEventListener('pageshow', restorePreferences);
  document.addEventListener('visibilitychange', syncMotion);
  reduced.addEventListener('change', syncMotion);
  finePointer.addEventListener('change', syncMotion);
  document.querySelectorAll<HTMLButtonElement>('[data-global-pause]').forEach(button => {
    const toggle = () => {
      const next = !paused;
      try { localStorage.setItem('ice-paused', String(next)); } catch { /* Current-page control still works. */ }
      window.dispatchEvent(new CustomEvent('ice-pause-change', { detail: next }));
    };
    button.addEventListener('click', toggle);
    cleanups.push(() => button.removeEventListener('click', toggle));
  });

  document.querySelectorAll<HTMLElement>('[data-light-card]').forEach(card => {
    let frame = 0;
    let x = 0;
    let y = 0;
    let bounds: DOMRect | null = null;
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      bounds = null;
      card.removeAttribute('data-tracking');
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
    }
    function move(event: PointerEvent) {
      if (!running() || !finePointer.matches || event.pointerType !== 'mouse') return;
      bounds ??= card.getBoundingClientRect();
      x = event.clientX - bounds.left;
      y = event.clientY - bounds.top;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!bounds || !running()) return;
        card.style.setProperty('--light-x', `${x}px`);
        card.style.setProperty('--light-y', `${y}px`);
        card.style.setProperty('--tilt-x', `${(0.5 - y / bounds.height) * 6}deg`);
        card.style.setProperty('--tilt-y', `${(x / bounds.width - 0.5) * 6}deg`);
        card.dataset.tracking = 'true';
      });
    }
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerleave', reset);
    card.addEventListener('pointercancel', reset);
    card.addEventListener('blur', reset);
    resetCards.push(reset);
    cleanups.push(() => {
      reset();
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerleave', reset);
      card.removeEventListener('pointercancel', reset);
      card.removeEventListener('blur', reset);
    });
  });

  // The natural document remains visible if JS is absent, late, or interrupted.
  // Animate once when a section actually enters; never hide content in SSR CSS.
  const entryAnimations = new WeakMap<Element, Animation>();
  const entryObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        entryAnimations.get(entry.target)?.cancel();
        continue;
      }
      if (entryAnimations.has(entry.target)) continue;
      if (!running()) { entryObserver.unobserve(entry.target); continue; }
      const animation = entry.target.animate([
        { opacity: 0.35, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)' });
      reveals.add(animation);
      entryAnimations.set(entry.target, animation);
      const settled = () => { reveals.delete(animation); entryObserver.unobserve(entry.target); };
      void animation.finished.then(settled).catch(settled);
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-reveal], .selected-section > .section-heading, .about-preview, .contact-section').forEach(element => entryObserver.observe(element));

  // Scrolling can change the card's viewport coordinates while it is hovered.
  const resetOnScroll = () => resetCards.forEach(reset => reset());
  window.addEventListener('scroll', resetOnScroll, { passive: true });
  window.addEventListener('resize', resetOnScroll, { passive: true });
  syncMotion();
  function teardown(event: PageTransitionEvent) {
    if (event.persisted) return; // Keep enhancement intact when restored from bfcache.
    cleanups.forEach(cleanup => cleanup());
    entryObserver.disconnect();
    for (const animation of reveals) animation.cancel();
    window.removeEventListener('ice-pause-change', preference);
    window.removeEventListener('storage', storage);
    window.removeEventListener('pageshow', restorePreferences);
    window.removeEventListener('scroll', resetOnScroll);
    window.removeEventListener('resize', resetOnScroll);
    document.removeEventListener('visibilitychange', syncMotion);
    reduced.removeEventListener('change', syncMotion);
    finePointer.removeEventListener('change', syncMotion);
    window.removeEventListener('pagehide', teardown);
  }
  window.addEventListener('pagehide', teardown);
}
