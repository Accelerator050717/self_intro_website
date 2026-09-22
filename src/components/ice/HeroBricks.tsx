import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import SceneFallback from './SceneFallback';
import { supportsWebGL, useSceneStatus } from './scene-hooks';
import './ice.css';

const IceScene = lazy(() => import('./IceScene'));

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure?.(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function HeroBricks({ paused = false, dark: darkOverride, onSettled }: { paused?: boolean; dark?: boolean; onSettled?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { active, visible, reducedMotion, dark } = useSceneStatus(ref);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const checked = useRef(false);
  const onReady = useCallback(() => { setReady(true); onSettled?.(); }, [onSettled]);
  const onFailure = useCallback(() => { setEnabled(false); setReady(false); onSettled?.(); }, [onSettled]);
  useEffect(() => {
    if (visible && !checked.current) {
      checked.current = true;
      const supported = supportsWebGL();
      setEnabled(supported);
      if (!supported) onSettled?.();
    }
  }, [visible, onSettled]);
  return <div ref={ref} className="ice-hero-scene" aria-hidden="true" data-scene={enabled ? 'webgl' : 'svg'}>
    {!ready && <SceneFallback />}
    {enabled && <SceneBoundary fallback={<SceneFallback />} onFailure={onFailure}>
      <Suspense fallback={null}>
        <IceScene active={active} interactive={!paused && !reducedMotion} dark={darkOverride ?? dark} onReady={onReady} onFailure={onFailure} />
      </Suspense>
    </SceneBoundary>}
  </div>;
}
