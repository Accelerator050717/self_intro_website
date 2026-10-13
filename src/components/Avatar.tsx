import { Component, useCallback, useEffect, useRef, useState, lazy, Suspense, type ReactNode } from 'react';
import { ui, type Lang } from '../i18n/ui';
import { GREETING_MS, REDUCED_GREETING_MS, gestureTimeline, greetingFrames, greetingPhaseAt, parseRig, type AvatarRig, type GreetingPhase, type MovingJoint } from '../lib/avatar-motion';
import SceneFallback from './ice/SceneFallback';
import AvatarJointSurface from './AvatarJointSurface';
import '../styles/avatar-interaction.css';

const HeroBricks = lazy(() => import('./ice/HeroBricks'));
const rigBase = '/images/avatar/rig/';
const layerNames = ['body', 'head', 'upper-arm', 'forearm', 'hand'];

class IceBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <SceneFallback /> : this.props.children; }
}

export default function Avatar({ lang }: { lang: Lang }) {
  const t = ui[lang];
  const [rig, setRig] = useState<AvatarRig | null>(null);
  const [resourceFailed, setResourceFailed] = useState(false);
  const [backgroundPaused, setBackgroundPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [phase, setPhase] = useState<GreetingPhase>('idle');
  const [accepted, setAccepted] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneSettled, setSceneSettled] = useState(false);
  const [sceneTimedOut, setSceneTimedOut] = useState(false);
  const [dark, setDark] = useState(false);
  const person = useRef<HTMLButtonElement>(null);
  const shoulder = useRef<SVGGElement>(null);
  const elbow = useRef<SVGGElement>(null);
  const wrist = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const phaseRef = useRef<GreetingPhase>('idle');
  const mounted = useRef(false);
  const animations = useRef<Animation[]>([]);
  const sequence = useRef(0);
  const raf = useRef(0);
  const suspended = useRef(false);
  const printing = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ready = preferencesReady && (!!rig || resourceFailed);
  // Intentional finite gestures remain available while ambient motion is paused.
  // The optional WebGL scene is never a character readiness dependency.
  const canTrigger = ready && visible && pageVisible;
  const current = useRef({ canTrigger, reduced, resourceFailed, greeting: t.greeting });
  current.current = { canTrigger, reduced, resourceFailed, greeting: t.greeting };
  const onSceneSettled = useCallback(() => setSceneSettled(true), []);

  const resetPose = useCallback(() => {
    for (const joint of [shoulder, elbow, wrist, head]) if (joint.current) joint.current.style.transform = '';
  }, []);
  const releaseResources = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
    timers.current.forEach(clearTimeout); timers.current = [];
    for (const animation of animations.current) animation.cancel();
    animations.current = [];
    resetPose();
  }, [resetPose]);
  const changePhase = useCallback((next: GreetingPhase) => {
    phaseRef.current = next;
    if (mounted.current) setPhase(next);
  }, []);
  const cancelGesture = useCallback(() => {
    sequence.current++;
    releaseResources();
    changePhase('idle');
  }, [releaseResources, changePhase]);

  useEffect(() => {
    mounted.current = true;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { cancelGesture(); setReduced(media.matches); };
    update(); media.addEventListener('change', update);
    try {
      setBackgroundPaused(localStorage.getItem('ice-paused') === 'true');
      localStorage.removeItem('mingyang:ice-play:v1');
    } catch { /* Storage is optional. */ }
    setPreferencesReady(true);
    const pausePreference = (event: Event) => setBackgroundPaused((event as CustomEvent<boolean>).detail);
    const storedPreference = (event: StorageEvent) => { if (event.key === 'ice-paused') setBackgroundPaused(event.newValue === 'true'); };
    window.addEventListener('ice-pause-change', pausePreference);
    window.addEventListener('storage', storedPreference);
    const theme = () => setDark(document.documentElement.dataset.theme === 'dark');
    theme(); window.addEventListener('ice-theme-change', theme);
    const observer = new IntersectionObserver(([entry]) => {
      const shown = entry.isIntersecting && entry.intersectionRatio >= .2;
      if (!shown) cancelGesture();
      setVisible(shown);
    }, { threshold: [0, .2] });
    if (person.current) observer.observe(person.current);
    const onVisibility = () => { if (document.hidden) cancelGesture(); setPageVisible(!document.hidden); };
    onVisibility(); document.addEventListener('visibilitychange', onVisibility);
    const pageHide = () => { suspended.current = true; cancelGesture(); };
    const pageShow = () => { suspended.current = false; onVisibility(); theme(); };
    window.addEventListener('pagehide', pageHide); window.addEventListener('pageshow', pageShow);
    const beforePrint = () => { printing.current = true; cancelGesture(); };
    const afterPrint = () => { printing.current = false; };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    const idle = window.setTimeout(() => setSceneReady(true), 450);
    return () => {
      mounted.current = false;
      clearTimeout(idle); observer.disconnect(); media.removeEventListener('change', update);
      window.removeEventListener('ice-theme-change', theme);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('ice-pause-change', pausePreference);
      window.removeEventListener('storage', storedPreference);
      window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', pageShow);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
      cancelGesture();
    };
  }, [cancelGesture]);

  useEffect(() => {
    if (!sceneReady || sceneSettled) return;
    const timeout = setTimeout(() => { setSceneTimedOut(true); setSceneSettled(true); }, 10000);
    return () => clearTimeout(timeout);
  }, [sceneReady, sceneSettled]);

  useEffect(() => {
    if (!visible || rig || resourceFailed) return;
    let disposed = false;
    const controller = new AbortController();
    async function prepare() {
      try {
        const response = await fetch(`${rigBase}rig.json`, { signal: controller.signal });
        if (!response.ok) throw new Error('Avatar rig unavailable');
        const nextRig = parseRig(await response.json());
        await Promise.all(layerNames.map(async name => {
          const image = new Image(); image.src = `${rigBase}${name}.webp`; await image.decode();
        }));
        if (!disposed) setRig(nextRig);
      } catch { if (!disposed) setResourceFailed(true); }
    }
    void prepare();
    return () => { disposed = true; controller.abort(); };
  }, [visible, rig, resourceFailed]);

  const sayHello = useCallback(() => {
    if (phaseRef.current !== 'idle' || !current.current.canTrigger || suspended.current || printing.current || document.hidden) return;
    // Lock before React state, announcements or any .animate call can race.
    changePhase('preparing');
    const ticket = ++sequence.current;
    setAccepted(count => count + 1); setAnnouncement('');
    const showPhase = (next: GreetingPhase) => {
      if (sequence.current !== ticket || !mounted.current) return;
      changePhase(next);
      if (next === 'waving') setAnnouncement(current.current.greeting);
    };
    const finish = () => {
      if (sequence.current !== ticket || !mounted.current) return;
      // Remove effects and restore every joint before unlocking input.
      releaseResources(); changePhase('idle');
    };
    if (current.current.reduced || current.current.resourceFailed || !shoulder.current || !elbow.current || !wrist.current || !head.current) {
      resetPose();
      for (const [time, next] of [[80, 'raising'], [160, 'waving'], [320, 'recovering']] as const) {
        timers.current.push(setTimeout(() => showPhase(next), time));
      }
      timers.current.push(setTimeout(finish, REDUCED_GREETING_MS));
      return;
    }
    try {
      const initialHead = new DOMMatrix(getComputedStyle(head.current).transform);
      const headDegrees = Math.atan2(initialHead.b, initialHead.a) * 180 / Math.PI;
      resetPose();
      const joints = { shoulder, elbow, wrist, head };
      const start = document.timeline.currentTime;
      const created: Animation[] = [];
      animations.current = created;
      for (const name of Object.keys(joints) as MovingJoint[]) {
        const animation = joints[name].current!.animate(greetingFrames(name, headDegrees), {
          duration: gestureTimeline[name].duration, fill: 'forwards', easing: 'linear',
        });
        animation.id = `avatar-greeting:${name}`;
        // Each promise is handled even if a later joint fails to initialize.
        void animation.finished.catch(() => {});
        created.push(animation);
        if (typeof start === 'number') animation.startTime = start;
      }
      const clock = created[0];
      const trackPhase = () => {
        if (sequence.current !== ticket || !mounted.current) return;
        const elapsed = typeof clock.currentTime === 'number' ? clock.currentTime : 0;
        const next = greetingPhaseAt(elapsed);
        if (phaseRef.current !== next) showPhase(next);
        raf.current = requestAnimationFrame(trackPhase);
      };
      raf.current = requestAnimationFrame(trackPhase);
      timers.current.push(setTimeout(() => { if (sequence.current === ticket) cancelGesture(); }, GREETING_MS + 2000));
      void Promise.all(created.map(animation => animation.finished)).then(finish).catch(() => {
        if (sequence.current === ticket) cancelGesture();
      });
    } catch { cancelGesture(); }
  }, [cancelGesture, changePhase, releaseResources, resetPose]);

  const layer = (name: string) => <image href={`${rigBase}${name}.webp`} x="0" y="0" width="720" height="960" />;
  const origin = (joint: keyof AvatarRig['joints']) => ({ transformOrigin: `${rig!.joints[joint][0]}px ${rig!.joints[joint][1]}px` });
  const moving = phase !== 'idle';
  // A ready character can greet before optional scene initialization. Defer the
  // first shader compile while it is moving; keep an already settled scene mounted.
  const mountScene = sceneReady && !sceneTimedOut && (sceneSettled || !moving);
  return <div className={`avatar-exhibit ${reduced || !canTrigger ? 'is-still' : ''}`} data-ambient data-state={phase} data-greeting-count={accepted} data-rig={rig ? 'ready' : resourceFailed ? 'fallback' : 'loading'} data-action-ready={ready} data-scene-settled={sceneSettled}>
    <div className="brick-stage" aria-hidden="true">{mountScene ? <IceBoundary onFailure={onSceneSettled}><Suspense fallback={<SceneFallback />}><HeroBricks paused={backgroundPaused || reduced || !visible || !pageVisible || moving} dark={dark} onSettled={onSceneSettled} /></Suspense></IceBoundary> : <SceneFallback />}</div>
    <div className="person-wrap" onPointerMove={event => {
      if (!current.current.canTrigger || reduced || backgroundPaused || phaseRef.current !== 'idle' || event.pointerType !== 'mouse' || !head.current) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const degrees = Math.max(-2, Math.min(2, ((event.clientX - bounds.left) / bounds.width - .5) * 4));
      head.current.style.transform = `rotate(${degrees}deg)`;
    }} onPointerLeave={() => { if (phaseRef.current === 'idle') resetPose(); }}>
      <button ref={person} className="person-button" onClick={sayHello} aria-label={t.greet} aria-busy={moving} disabled={!ready} onKeyDown={event => {
        if ((event.key === 'Enter' || event.key === ' ') && (event.repeat || phaseRef.current !== 'idle')) event.preventDefault();
      }}>
        <img className={`avatar-image ${rig ? 'rig-replaced' : ''}`} src="/images/avatar/front-960.webp" srcSet="/images/avatar/front-480.webp 360w, /images/avatar/front-960.webp 720w" sizes="(max-width: 600px) 280px, 390px" width="720" height="960" fetchPriority="high" alt={lang === 'en' ? 'Mingyang’s ice-blue-haired character in a black hoodie' : '冰蓝发、黑色连帽衫的明阳公仔'} draggable={false} />
        {rig && <svg className="avatar-rig" viewBox="0 0 720 960" width="720" height="960" aria-hidden="true" data-moving={moving}>
          <AvatarJointSurface joint="shoulder" at={rig.joints.shoulder} />
          <g data-part="body">{layer('body')}</g>
          <g ref={shoulder} data-joint="shoulder" style={origin('shoulder')}>
            <AvatarJointSurface joint="elbow" at={rig.joints.elbow} />
            {layer('upper-arm')}
            <g ref={elbow} data-joint="elbow" style={origin('elbow')}>
              <g ref={wrist} data-joint="wrist" style={origin('wrist')}>{layer('hand')}</g>
              {layer('forearm')}
            </g>
          </g>
          <g ref={head} data-joint="head" style={origin('neck')}>{layer('head')}</g>
        </svg>}
      </button>
    </div>
    <span className="avatar-announcement sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
