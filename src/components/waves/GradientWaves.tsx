/** React Bits GradientWaves (user-supplied JS + CSS), adapted for site lifecycle.
 * Copyright 2026 David Haz. MIT + Commons Clause; see THIRD_PARTY_NOTICES.md.
 * Shader mathematics and desktop visual parameters are unchanged.
 */
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { vertex, fragment } from './gradient-waves-shaders';
import './GradientWaves.css';

export interface GradientWavesProps {
  horizonColor?: string; waveColor?: string; crestColor?: string;
  speed?: number; amplitude?: number; waveScale?: number; waveRatio?: number;
  swell?: number; turbulence?: number; tilt?: number; zoom?: number; height?: number;
  fogDepth?: number; detail?: 'low' | 'medium' | 'high'; brightness?: number;
  opacity?: number; mouseInteraction?: boolean; parallaxStrength?: number;
  grain?: boolean; grainIntensity?: number; className?: string;
}

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
};
const detailToSteps = (detail: string) => detail === 'low' ? 40 : detail === 'high' ? 110 : 70;

export default function GradientWaves({
  horizonColor = '#27cbff', waveColor = '#9fe3ff', crestColor = '#9de4e2',
  speed = 0.4, amplitude = 2.5, waveScale = 0.6, waveRatio = 0.9,
  swell = 35, turbulence = 20, tilt = 1.11, zoom = 1.0, height = 5.5,
  fogDepth = 15, detail = 'medium', brightness = 1.0, opacity = 1.0,
  mouseInteraction = true, parallaxStrength = 0.5, grain = true,
  grainIntensity = 0.05, className = '',
}: GradientWavesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const configure = useRef<(() => void) | null>(null);
  const settings = { horizonColor, waveColor, crestColor, speed, amplitude, waveScale,
    waveRatio, swell, turbulence, tilt, zoom, height, fogDepth, detail, brightness,
    opacity, mouseInteraction, parallaxStrength, grain, grainIntensity };
  const current = useRef(settings);

  useEffect(() => {
    current.current = { horizonColor, waveColor, crestColor, speed, amplitude, waveScale,
      waveRatio, swell, turbulence, tilt, zoom, height, fogDepth, detail, brightness,
      opacity, mouseInteraction, parallaxStrength, grain, grainIntensity };
    configure.current?.();
  }, [horizonColor, waveColor, crestColor, speed, amplitude, waveScale, waveRatio,
    swell, turbulence, tilt, zoom, height, fogDepth, detail, brightness, opacity,
    mouseInteraction, parallaxStrength, grain, grainIntensity]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: Renderer | undefined;
    let program: Program | undefined;
    let geometry: Triangle | undefined;
    let mesh: Mesh | undefined;
    let rawContext: WebGL2RenderingContext | null = null;
    let disposed = false;
    let failed = false;
    let raf = 0;
    let elapsed = 0;
    let previousTime = 0;
    let resolutionScale = 1;
    let sampleMilliseconds = 0;
    let sampleFrames = 0;
    let visible = true;
    let suspended = false;
    let printing = false;
    let paused = false;
    try { paused = localStorage.getItem('ice-paused') === 'true'; } catch { /* Optional storage. */ }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = matchMedia('(pointer: coarse), (max-width: 640px)');
    const printMedia = matchMedia('print');
    const currentMouse = [0.5, 0.5];
    const targetMouse = [0.5, 0.5];
    const running = () => !disposed && !failed && !paused && !reduced.matches && !document.hidden && visible && !suspended && !printing && !printMedia.matches;

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      previousTime = 0; // Resume from frozen simulation time, never wall-clock time.
    }
    function draw() {
      if (disposed || failed || !renderer || !program || !mesh) return;
      try { renderer.render({ scene: mesh }); }
      catch { fail(); }
    }
    function loop(time: number) {
      raf = 0;
      if (!running() || !program) {
        // A media preference can become observable before its change callback.
        // Keep the frozen timestamp and status consistent on this path as well.
        stop(); container!.dataset.motion = 'paused'; return;
      }
      if (previousTime) {
        const interval = time - previousTime;
        elapsed += Math.min(interval * 0.001, 0.1);
        // Measure actual active frame spacing before trading only pixel density.
        // Medium raymarch steps, wave mathematics and all visual props stay intact.
        sampleMilliseconds += interval; sampleFrames++;
        if (sampleFrames >= 18) {
          const average = sampleMilliseconds / sampleFrames;
          if (average > 38 && resolutionScale > 0.5) {
            resolutionScale = Math.max(0.5, Math.floor(resolutionScale * Math.sqrt(28 / average) * 20) / 20);
            resize();
            if (failed || disposed || !program) return;
          }
          sampleMilliseconds = 0; sampleFrames = 0;
        }
      }
      previousTime = time;
      program.uniforms.iTime.value = elapsed;
      const mouseEnabled = current.current.mouseInteraction && !coarse.matches;
      currentMouse[0] += 0.05 * ((mouseEnabled ? targetMouse[0] : 0.5) - currentMouse[0]);
      currentMouse[1] += 0.05 * ((mouseEnabled ? targetMouse[1] : 0.5) - currentMouse[1]);
      program.uniforms.uMouse.value.set(currentMouse);
      draw();
      if (running()) raf = requestAnimationFrame(loop);
    }
    function sync() {
      stop();
      container!.dataset.motion = running() ? 'running' : 'paused';
      if (running()) raf = requestAnimationFrame(loop);
    }
    function disposeGpu() {
      stop();
      if (!renderer) {
        rawContext?.getExtension('WEBGL_lose_context')?.loseContext();
        rawContext = null;
        return;
      }
      const { gl } = renderer;
      gl.canvas.removeEventListener('webglcontextlost', contextLost);
      geometry?.remove();
      if (program) { gl.deleteShader(program.vertexShader); gl.deleteShader(program.fragmentShader); }
      program?.remove();
      gl.canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      geometry = undefined; program = undefined; mesh = undefined; renderer = undefined;
      rawContext = null;
    }
    function fail() {
      failed = true;
      container!.dataset.state = 'fallback';
      container!.dataset.motion = 'paused';
      disposeGpu();
    }
    function contextLost(event: Event) { event.preventDefault(); fail(); }
    function apply() {
      if (!program) return;
      const p = current.current;
      const u = program.uniforms;
      u.uSpeed.value = p.speed; u.uAmplitude.value = p.amplitude;
      u.uWaveScale.value = p.waveScale; u.uWaveRatio.value = p.waveRatio;
      u.uSwell.value = p.swell; u.uTurbulence.value = p.turbulence;
      u.uTilt.value = p.tilt; u.uZoom.value = p.zoom; u.uHeight.value = p.height;
      u.uFogDepth.value = p.fogDepth;
      u.uSteps.value = detailToSteps(coarse.matches ? 'low' : p.detail);
      u.uBrightness.value = p.brightness; u.uOpacity.value = p.opacity;
      u.uGrain.value = p.grain ? 1 : 0; u.uGrainIntensity.value = p.grainIntensity;
      u.uParallax.value = p.parallaxStrength;
      u.uEnableMouse.value = p.mouseInteraction && !coarse.matches;
      u.uHorizonColor.value.set(hexToRgb(p.horizonColor));
      u.uWaveColor.value.set(hexToRgb(p.waveColor));
      u.uCrestColor.value.set(hexToRgb(p.crestColor));
      container!.dataset.quality = coarse.matches ? 'low' : p.detail;
      // A theme/size update may draw once while paused, never a continuous loop.
      if (!document.hidden && !printing && !printMedia.matches && !suspended) draw();
    }
    function resize() {
      if (!renderer || !program || disposed || failed) return;
      const bounds = container!.getBoundingClientRect();
      renderer.dpr = (coarse.matches ? Math.min(devicePixelRatio || 1, 1) : Math.min(devicePixelRatio || 1, 2)) * resolutionScale;
      renderer.setSize(Math.max(1, Math.floor(bounds.width)), Math.max(1, Math.floor(bounds.height)));
      program.uniforms.iResolution.value.set([renderer.gl.drawingBufferWidth, renderer.gl.drawingBufferHeight]);
      container!.dataset.resolutionScale = String(resolutionScale);
      apply();
    }
    function pointer(event: PointerEvent) {
      if (!running() || coarse.matches || !current.current.mouseInteraction || event.pointerType !== 'mouse') return;
      const bounds = container!.getBoundingClientRect();
      targetMouse[0] = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      targetMouse[1] = 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    }
    function leave() { targetMouse[0] = 0.5; targetMouse[1] = 0.5; }
    function preference(event: Event) { paused = (event as CustomEvent<boolean>).detail; sync(); }
    function stored(event: StorageEvent) { if (event.key === 'ice-paused') { paused = event.newValue === 'true'; sync(); } }
    function media() { leave(); resize(); sync(); }
    function beforePrint() { printing = true; sync(); }
    function afterPrint() { printing = false; resize(); sync(); }
    function pageHide(event: PageTransitionEvent) {
      suspended = true; sync();
      if (!event.persisted) cleanup();
    }
    function pageShow() {
      suspended = false;
      try { paused = localStorage.getItem('ice-paused') === 'true'; } catch { /* Keep current state. */ }
      sync();
    }
    const ro = new ResizeObserver(resize);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    function cleanup() {
      if (disposed) return;
      disposed = true;
      configure.current = null;
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', pointer);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('ice-pause-change', preference);
      window.removeEventListener('storage', stored);
      reduced.removeEventListener('change', media); coarse.removeEventListener('change', media);
      printMedia.removeEventListener('change', media);
      window.removeEventListener('beforeprint', beforePrint); window.removeEventListener('afterprint', afterPrint);
      window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', pageShow);
      disposeGpu();
    }

    try {
      if (new URLSearchParams(location.search).get('webgl') === '0') throw new Error('Explicit static fallback');
      const canvas = document.createElement('canvas');
      const attributes = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
      rawContext = canvas.getContext('webgl2', attributes) as WebGL2RenderingContext | null;
      if (!rawContext) throw new Error('WebGL2 is unavailable');
      renderer = new Renderer({ canvas, webgl: 2, ...attributes });
      if (!renderer.isWebgl2) throw new Error('WebGL2 is unavailable');
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.canvas.dataset.wavesCanvas = '';
      gl.canvas.addEventListener('webglcontextlost', contextLost);
      geometry = new Triangle(gl);
      program = new Program(gl, { vertex, fragment, depthTest: false, depthWrite: false, uniforms: {
        iTime: { value: 0 }, iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: speed }, uAmplitude: { value: amplitude }, uWaveScale: { value: waveScale }, uWaveRatio: { value: waveRatio },
        uSwell: { value: swell }, uTurbulence: { value: turbulence }, uTilt: { value: tilt }, uZoom: { value: zoom }, uHeight: { value: height },
        uFogDepth: { value: fogDepth }, uSteps: { value: detailToSteps(detail) }, uBrightness: { value: brightness }, uOpacity: { value: opacity },
        uGrain: { value: grain ? 1 : 0 }, uGrainIntensity: { value: grainIntensity }, uMouse: { value: new Float32Array([0.5, 0.5]) },
        uParallax: { value: parallaxStrength }, uEnableMouse: { value: mouseInteraction },
        uHorizonColor: { value: new Float32Array(hexToRgb(horizonColor)) },
        uWaveColor: { value: new Float32Array(hexToRgb(waveColor)) }, uCrestColor: { value: new Float32Array(hexToRgb(crestColor)) },
      } });
      if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) throw new Error('GradientWaves shader initialization failed');
      mesh = new Mesh(gl, { geometry, program });
      container.appendChild(gl.canvas);
      configure.current = apply;
      resize();
      if (failed) return cleanup;
      container.dataset.state = 'ready';
      ro.observe(container); io.observe(container);
      window.addEventListener('pointermove', pointer, { passive: true });
      document.documentElement.addEventListener('pointerleave', leave);
      document.addEventListener('visibilitychange', sync);
      window.addEventListener('ice-pause-change', preference);
      window.addEventListener('storage', stored);
      reduced.addEventListener('change', media); coarse.addEventListener('change', media);
      printMedia.addEventListener('change', media);
      window.addEventListener('beforeprint', beforePrint); window.addEventListener('afterprint', afterPrint);
      window.addEventListener('pagehide', pageHide); window.addEventListener('pageshow', pageShow);
      sync();
    } catch { fail(); }
    return cleanup;
    // Props update uniforms via configure, without creating another GL context.
  }, []);

  return <div ref={containerRef} className={`gradient-waves-container ${className}`.trim()} data-state="loading" aria-hidden="true" />;
}
