/**
 * Spotlight positioning adapted from React Bits SpotlightCard, TS-CSS.
 * Copyright 2026 David Haz. MIT + Commons Clause; see THIRD_PARTY_NOTICES.md.
 * Layout continuity and reading feedback use site-authored DOM/WAAPI code.
 * Astro keeps the links/content server-rendered. No animation runtime needed.
 */
export function enhanceVisuals() {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const printMedia = matchMedia('print');
  let printing = false;
  let paused = false;
  try { paused = localStorage.getItem('ice-paused') === 'true'; } catch { /* Optional storage. */ }
  const running = () => !paused && !reduced.matches && !document.hidden && !printing && !printMedia.matches;
  const cleanups: (() => void)[] = [];
  const resetCards: (() => void)[] = [];
  const animations = new Map<HTMLElement, Animation>();
  const pageTransitions = new Set<ViewTransition>();

  function stop(element: HTMLElement) {
    animations.get(element)?.cancel();
    animations.delete(element);
    delete element.dataset.motionEffect;
  }
  function animate(element: HTMLElement, frames: Keyframe[], duration: number, effect: string) {
    stop(element);
    if (!running() || typeof element.animate !== 'function') return;
    const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    animations.set(element, animation);
    element.dataset.motionEffect = effect;
    const release = () => {
      if (animations.get(element) !== animation) return;
      animations.delete(element);
      delete element.dataset.motionEffect;
    };
    void animation.finished.then(release, release);
    return animation;
  }

  function syncMotion() {
    root.dataset.motion = running() ? 'enabled' : 'still';
    document.querySelectorAll<HTMLButtonElement>('[data-global-pause]').forEach(button => {
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', (paused ? button.dataset.resumeLabel : button.dataset.pauseLabel)!);
    });
    if (!running() || !finePointer.matches) resetCards.forEach(reset => reset());
    if (!running()) {
      for (const element of animations.keys()) stop(element);
      for (const transition of pageTransitions) transition.skipTransition();
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
  printMedia.addEventListener('change', syncMotion);
  const beforePrint = () => { printing = true; syncMotion(); };
  const afterPrint = () => { printing = false; syncMotion(); };
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', afterPrint);

  // Native cross-document transitions preserve real links and full Astro pages.
  // CSS names only main content; the viewport waves receive no fade or transform.
  const navigationTransition = (event: Event) => {
    const transition = (event as Event & { viewTransition?: ViewTransition }).viewTransition;
    if (!transition) return;
    pageTransitions.add(transition);
    const release = () => pageTransitions.delete(transition);
    // ready can reject on a skip while finished still resolves. Settle both
    // independently, including outgoing documents and preference changes.
    void transition.ready.catch(release);
    void transition.finished.then(release, release);
    if (!running()) transition.skipTransition();
  };
  window.addEventListener('pageswap', navigationTransition);
  window.addEventListener('pagereveal', navigationTransition);
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
      card.style.removeProperty('--art-shift-x');
      card.style.removeProperty('--art-shift-y');
      card.style.removeProperty('--light-x');
      card.style.removeProperty('--light-y');
    }
    function move(event: PointerEvent) {
      if (!running() || !finePointer.matches || event.pointerType !== 'mouse') return;
      bounds ??= card.getBoundingClientRect();
      x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
      y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!bounds || !running()) return;
        card.style.setProperty('--light-x', `${x}px`);
        card.style.setProperty('--light-y', `${y}px`);
        card.style.setProperty('--tilt-x', `${(0.5 - y / bounds.height) * 6}deg`);
        card.style.setProperty('--tilt-y', `${(x / bounds.width - 0.5) * 6}deg`);
        card.style.setProperty('--art-shift-x', `${(x / bounds.width - 0.5) * 10}px`);
        card.style.setProperty('--art-shift-y', `${(y / bounds.height - 0.5) * 8}px`);
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
  const entered = new WeakSet<Element>();
  const entryObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement;
      if (!entry.isIntersecting) {
        if (element.dataset.motionEffect === 'reveal') stop(element);
        continue;
      }
      if (entered.has(element)) continue;
      entered.add(element);
      entryObserver.unobserve(element);
      if (element.dataset.motionEffect === 'filter') continue;
      animate(element, [
        { opacity: 0.65, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], 420, 'reveal');
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-reveal], .selected-section > .section-heading, .about-preview, .contact-section').forEach(element => entryObserver.observe(element));

  const grid = document.querySelector<HTMLElement>('[data-work-grid]');
  const filters = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const projects = [...(grid?.querySelectorAll<HTMLElement>('.project-card') ?? [])];
  const status = document.querySelector<HTMLElement>('[data-filter-status]');
  for (const button of filters) {
    const filter = () => {
      if (!grid || button.getAttribute('aria-pressed') === 'true') return;
      // Capture the actual current visual position before cancelling an interrupted
      // transition. Hidden/count/pressed state changes immediately in this event.
      const before = new Map(projects.filter(card => !card.hidden).map(card => [card, card.getBoundingClientRect()]));
      projects.forEach(card => { stop(card); entryObserver.unobserve(card); entered.add(card); });
      resetCards.forEach(reset => reset());
      filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const category = button.dataset.filter!;
      grid.dataset.activeFilter = category;
      let count = 0;
      for (const card of projects) {
        card.hidden = category !== 'all' && !card.dataset.categories?.split(' ').includes(category);
        if (!card.hidden) count++;
      }
      if (status) status.textContent = status.dataset.lang === 'zh' ? `${count} 个项目` : `${count} ${count === 1 ? 'project' : 'projects'}`;
      if (!running()) return;
      // All final geometry reads precede animation writes; no per-frame layout.
      const after = new Map(projects.filter(card => !card.hidden).map(card => [card, card.getBoundingClientRect()]));
      for (const [card, rect] of after) {
        if (rect.bottom < 0 || rect.top > innerHeight) continue;
        const previous = before.get(card);
        if (previous) {
          const x = previous.left - rect.left;
          const y = previous.top - rect.top;
          if (Math.abs(x) + Math.abs(y) < 1) continue;
          animate(card, [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }], 380, 'filter');
        } else {
          animate(card, [{ opacity: 0.45, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], 300, 'filter');
        }
      }
    };
    button.addEventListener('click', filter);
    cleanups.push(() => button.removeEventListener('click', filter));
  }

  // The existing project contents list reports the section currently being read.
  // This is semantic position feedback, not a scroll animation or custom scroller.
  const contents = [...document.querySelectorAll<HTMLAnchorElement>('.project-aside nav a[href^="#"]')]
    .map(link => ({ link, section: document.getElementById(link.hash.slice(1)) }))
    .filter((item): item is { link: HTMLAnchorElement; section: HTMLElement } => Boolean(item.section));
  function updateContents() {
    if (!contents.length || document.hidden || printing || printMedia.matches) return;
    const readingLine = Math.min(innerHeight * 0.3, 220);
    let current = contents[0];
    for (const item of contents) {
      if (item.section.getBoundingClientRect().top <= readingLine) current = item;
    }
    for (const item of contents) {
      if (item === current) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    }
  }

  // Scrolling can change the card's viewport coordinates while it is hovered.
  let scrollFrame = 0;
  const onScroll = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      resetCards.forEach(reset => reset());
      updateContents();
    });
  };
  const onResize = () => {
    for (const element of animations.keys()) stop(element);
    onScroll();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('pageshow', updateContents);
  document.addEventListener('visibilitychange', updateContents);
  updateContents();
  syncMotion();
  function teardown(event: PageTransitionEvent) {
    if (event.persisted) return; // Keep enhancement intact when restored from bfcache.
    cleanups.forEach(cleanup => cleanup());
    entryObserver.disconnect();
    for (const element of animations.keys()) stop(element);
    cancelAnimationFrame(scrollFrame);
    pageTransitions.clear();
    window.removeEventListener('ice-pause-change', preference);
    window.removeEventListener('storage', storage);
    window.removeEventListener('pageshow', restorePreferences);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pageshow', updateContents);
    window.removeEventListener('pageswap', navigationTransition);
    window.removeEventListener('pagereveal', navigationTransition);
    window.removeEventListener('beforeprint', beforePrint);
    window.removeEventListener('afterprint', afterPrint);
    document.removeEventListener('visibilitychange', syncMotion);
    document.removeEventListener('visibilitychange', updateContents);
    reduced.removeEventListener('change', syncMotion);
    finePointer.removeEventListener('change', syncMotion);
    printMedia.removeEventListener('change', syncMotion);
    window.removeEventListener('pagehide', teardown);
  }
  window.addEventListener('pagehide', teardown);
}
