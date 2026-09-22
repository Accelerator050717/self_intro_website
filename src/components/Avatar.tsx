import { Component, useCallback, useEffect, useRef, useState, lazy, Suspense, type ReactNode } from 'react';
import { Hand, Pause, Play as ResumeIcon } from 'lucide-react';
import { ui, type Lang } from '../i18n/ui';
import { GREETING_MS, greetingTracks, parseRig, type AvatarRig } from '../lib/avatar-motion';
import SceneFallback from './ice/SceneFallback';

const HeroBricks = lazy(() => import('./ice/HeroBricks'));
const rigBase = '/images/avatar/rig/';
const layerNames = ['body', 'head', 'upper-arm', 'forearm', 'hand'];
const welcomeKey = 'mingyang:avatar-welcome:v1';

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
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [greeting, setGreeting] = useState(false);
  const [message, setMessage] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneSettled, setSceneSettled] = useState(false);
  const [sceneTimedOut, setSceneTimedOut] = useState(false);
  const [dark, setDark] = useState(false);
  const person = useRef<HTMLButtonElement>(null);
  const shoulder = useRef<SVGGElement>(null);
  const elbow = useRef<SVGGElement>(null);
  const wrist = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const animations = useRef<Animation[]>([]);
  const busy = useRef(false);
  const sequence = useRef(0);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canMove = preferencesReady && !!rig && sceneSettled && !paused && !reduced && visible && pageVisible;
  const onSceneSettled = useCallback(() => setSceneSettled(true), []);

  const resetPose = useCallback(() => {
    for (const joint of [shoulder, elbow, wrist, head]) if (joint.current) joint.current.style.transform = '';
  }, []);
  const cancelMotion = useCallback(() => {
    sequence.current++;
    for (const animation of animations.current) animation.cancel();
    animations.current = [];
    busy.current = false;
    resetPose();
  }, [resetPose]);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    try {
      setPaused(localStorage.getItem('ice-paused') === 'true');
      localStorage.removeItem('mingyang:ice-play:v1');
    } catch { /* Storage is optional; never clear unrelated preferences. */ }
    setPreferencesReady(true);
    const pausePreference = (event: Event) => setPaused((event as CustomEvent<boolean>).detail);
    const storedPreference = (event: StorageEvent) => { if (event.key === 'ice-paused') setPaused(event.newValue === 'true'); };
    window.addEventListener('ice-pause-change', pausePreference);
    window.addEventListener('storage', storedPreference);
    const theme = () => setDark(document.documentElement.dataset.theme === 'dark');
    theme(); window.addEventListener('ice-theme-change', theme);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.2), { threshold: [0, 0.2] });
    if (person.current) observer.observe(person.current);
    const onVisibility = () => setPageVisible(!document.hidden);
    onVisibility(); document.addEventListener('visibilitychange', onVisibility);
    const idle = window.setTimeout(() => setSceneReady(true), 450);
    return () => {
      clearTimeout(idle);
      if (messageTimer.current) clearTimeout(messageTimer.current);
      observer.disconnect(); media.removeEventListener('change', update);
      window.removeEventListener('ice-theme-change', theme);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('ice-pause-change', pausePreference);
      window.removeEventListener('storage', storedPreference);
      cancelMotion();
    };
  }, [cancelMotion]);

  useEffect(() => {
    if (!sceneReady || sceneSettled) return;
    // A stalled optional import/network must not disable the character forever.
    // Unmount the entire 3D island before enabling greetings on the static stage.
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
          const image = new Image();
          image.src = `${rigBase}${name}.webp`;
          await image.decode();
        }));
        if (!disposed) setRig(nextRig);
      } catch {
        if (!disposed) setResourceFailed(true);
      }
    }
    void prepare();
    return () => { disposed = true; controller.abort(); };
  }, [visible, rig, resourceFailed]);

  const sayHello = useCallback(() => {
    if (busy.current) return;
    setMessage(true);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(false), GREETING_MS + 600);
    if (!canMove || !shoulder.current || !elbow.current || !wrist.current || !head.current) return;
    resetPose(); busy.current = true; setGreeting(true);
    const ticket = ++sequence.current;
    const joints = { shoulder, elbow, wrist, head };
    animations.current = (Object.keys(joints) as (keyof typeof joints)[]).map(name =>
      joints[name].current!.animate(greetingTracks[name].map(([offset, degrees]) => ({
        offset, transform: `rotate(${degrees}deg)`, easing: 'cubic-bezier(.4,0,.2,1)',
      })), { duration: GREETING_MS, fill: 'none' }),
    );
    void Promise.all(animations.current.map(animation => animation.finished)).then(() => {
      if (sequence.current !== ticket) return;
      animations.current = []; busy.current = false; resetPose(); setGreeting(false);
    }).catch(() => { /* Cancellation deliberately restores idle, without a queued greeting. */ });
  }, [canMove, resetPose]);

  useEffect(() => {
    if (!canMove) { cancelMotion(); setGreeting(false); }
  }, [canMove, cancelMotion]);
  useEffect(() => {
    if (!canMove) return;
    try {
      if (sessionStorage.getItem(welcomeKey)) return;
      sessionStorage.setItem(welcomeKey, 'seen');
    } catch { return; /* No reliable session store: manual greetings remain available. */ }
    sayHello();
  }, [canMove, sayHello]);

  function togglePause() {
    cancelMotion(); setGreeting(false);
    const next = !paused; setPaused(next);
    try { localStorage.setItem('ice-paused', String(next)); } catch { /* Optional preference. */ }
    window.dispatchEvent(new CustomEvent('ice-pause-change', { detail: next }));
  }
  const layer = (name: string) => <image href={`${rigBase}${name}.webp`} x="0" y="0" width="720" height="960" />;
  const origin = (joint: keyof AvatarRig['joints']) => ({ transformOrigin: `${rig!.joints[joint][0]}px ${rig!.joints[joint][1]}px` });

  return <div className={`avatar-exhibit ${canMove ? '' : 'is-still'}`} data-ambient data-state={paused ? 'paused' : greeting ? 'greeting' : 'idle'} data-rig={rig ? 'ready' : resourceFailed ? 'fallback' : 'loading'} data-scene-settled={sceneSettled}>
    <div className="exhibit-halo" aria-hidden="true"><div className="spectral-facet" /><div className="spectral-glow" /></div>
    <div className="brick-stage" aria-hidden="true">{sceneReady && !sceneTimedOut ? <IceBoundary onFailure={onSceneSettled}><Suspense fallback={<SceneFallback />}><HeroBricks paused={!canMove || greeting} dark={dark} onSettled={onSceneSettled} /></Suspense></IceBoundary> : <SceneFallback />}</div>
    <div className="person-wrap" onPointerMove={event => {
      if (!canMove || busy.current || event.pointerType !== 'mouse' || !head.current) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const degrees = Math.max(-3, Math.min(3, ((event.clientX - bounds.left) / bounds.width - 0.5) * 6));
      head.current.style.transform = `rotate(${degrees}deg)`;
    }} onPointerLeave={() => { if (!busy.current) resetPose(); }}>
      <button ref={person} className="person-button" onClick={sayHello} aria-label={t.greet} disabled={!sceneSettled && !resourceFailed}>
        <img className={`avatar-image ${rig ? 'rig-replaced' : ''}`} src="/images/avatar/front-960.webp" srcSet="/images/avatar/front-480.webp 360w, /images/avatar/front-960.webp 720w" sizes="(max-width: 600px) 280px, 390px" width="720" height="960" fetchPriority="high" alt={lang === 'en' ? 'Mingyang’s ice-blue-haired character in a black hoodie' : '冰蓝发、黑色连帽衫的明阳公仔'} draggable={false} />
        {rig && <svg className="avatar-rig" viewBox="0 0 720 960" width="720" height="960" aria-hidden="true" data-moving={greeting}>
          <g data-part="body">{layer('body')}</g>
          <g ref={shoulder} data-joint="shoulder" style={origin('shoulder')}>
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
    <div className={`avatar-greeting ${message ? 'show' : ''}`} role="status">{message ? t.greeting : ''}</div>
    <div className="avatar-controls js-only">
      <button className="hello-button" onClick={sayHello} disabled={!sceneSettled && !resourceFailed}><Hand size={17} aria-hidden="true" />{t.hello}</button>
      <button className="animation-toggle" onClick={togglePause} aria-label={paused ? t.resumeAnimation : t.pause} aria-pressed={paused} title={paused ? t.resumeAnimation : t.pause}>{paused ? <ResumeIcon size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button>
    </div>
  </div>;
}
