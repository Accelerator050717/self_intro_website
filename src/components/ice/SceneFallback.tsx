import { useId } from 'react';
import './ice.css';

function FlatBrick({ x, y, columns = 4, scale = 1, tone = 0, gradient }: { x: number; y: number; columns?: 2 | 4; scale?: number; tone?: number; gradient: string }) {
  const width = columns * 30;
  const depth = 60;
  const height = 28;
  const point = (u: number, v: number, h = 0) => [(u - width / 2 - v + depth / 2) * 0.88, (u - width / 2 + v - depth / 2) * 0.44 - h];
  const poly = (vertices: number[][]) => vertices.map(p => p.join(',')).join(' ');
  const a = point(0, 0), b = point(width, 0), c = point(width, depth), d = point(0, depth);
  const lower = ([px, py]: number[]) => [px, py + height];
  const studs = [];
  for (let u = 15; u < width; u += 30) for (let v = 15; v < depth; v += 30) studs.push(point(u, v));
  return <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={tone === 1 ? 0.78 : 1} strokeLinejoin="round">
    <polygon points={poly([d, c, lower(c), lower(d)])} fill={`url(#${gradient}-front)`} stroke="var(--ice-svg-edge)" strokeWidth="1.4" />
    <polygon points={poly([b, c, lower(c), lower(b)])} fill={`url(#${gradient}-side)`} stroke="var(--ice-svg-edge)" strokeWidth="1.4" />
    <polygon points={poly([a, b, c, d])} fill={`url(#${gradient}-top)`} stroke="var(--ice-svg-rim)" strokeWidth="2" />
    <path d={`M ${d[0] + 5} ${d[1] + 6} L ${c[0]} ${c[1] + 6} L ${b[0] - 5} ${b[1] + 6}`} fill="none" stroke="white" strokeOpacity=".6" />
    {studs.map(([px, py], i) => <g key={i}>
      <path d={`M ${px - 9} ${py - 7} v 8 a 9 4.5 0 0 0 18 0 v -8`} fill={`url(#${gradient}-front)`} stroke="var(--ice-svg-edge)" strokeWidth="1" />
      <ellipse cx={px} cy={py - 7} rx="9" ry="4.5" fill={`url(#${gradient}-top)`} stroke="var(--ice-svg-rim)" strokeWidth="1.2" />
    </g>)}
  </g>;
}

/** The hero platform remains visible before a real frame and if WebGL fails. */
export default function SceneFallback({ className = '' }: { mode?: 'hero'; className?: string }) {
  const gradient = `ice${useId().replace(/:/g, '')}`;
  return <svg className={`ice-fallback ${className}`} viewBox="0 0 550 600" fill="none" aria-hidden="true" focusable="false" data-scene-fallback="hero">
    <defs>
      <linearGradient id={`${gradient}-top`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--ice-svg-top)" /><stop offset=".52" stopColor="var(--ice-svg-cyan)" /><stop offset="1" stopColor="var(--ice-svg-violet)" /></linearGradient>
      <linearGradient id={`${gradient}-front`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--ice-svg-cyan)" stopOpacity=".86" /><stop offset="1" stopColor="var(--ice-svg-blue)" stopOpacity=".72" /></linearGradient>
      <linearGradient id={`${gradient}-side`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--ice-svg-violet)" stopOpacity=".8" /><stop offset="1" stopColor="var(--ice-svg-side)" stopOpacity=".7" /></linearGradient>
      <radialGradient id={`${gradient}-shadow`}><stop stopColor="#4d7898" stopOpacity=".2" /><stop offset="1" stopColor="#4d7898" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="275" cy="550" rx="215" ry="42" fill={`url(#${gradient}-shadow)`} />
    <FlatBrick x={419} y={376} columns={2} scale={0.8} tone={1} gradient={gradient} />
    <FlatBrick x={281} y={497} columns={4} scale={1.55} gradient={gradient} />
    <FlatBrick x={118} y={545} columns={2} scale={0.8} gradient={gradient} />
    <FlatBrick x={450} y={544} columns={2} scale={0.64} tone={1} gradient={gradient} />
  </svg>;
}
