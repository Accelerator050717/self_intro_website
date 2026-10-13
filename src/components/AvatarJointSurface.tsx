import { useId } from 'react';

export type AvatarJointSurfaceProps = {
  joint: 'shoulder' | 'elbow' | 'wrist';
  at: readonly [number, number];
};

const surfaces = {
  shoulder: { rx: 21, ry: 19, light: '#605a5c', middle: '#4b474a', shade: '#343137' },
  elbow: { rx: 20, ry: 19, light: '#656063', middle: '#585457', shade: '#3f3c40' },
  wrist: { rx: 10, ry: 8, light: '#595054', middle: '#494347', shade: '#343137' },
} as const;

/** A small hidden garment backing in the original 720 × 960 registration space.
 * Place the shoulder under the body; place the elbow in the shoulder group
 * before the upper-arm image. Original image layers stay above the backing;
 * its small exposed edge fills the seam when the sleeve rotates.
 * The optional wrist backing belongs under the hand and cuff, not over skin.
 */
export default function AvatarJointSurface({ joint, at }: AvatarJointSurfaceProps) {
  const id = `joint-surface-${useId().replace(/:/g, '')}`;
  const surface = surfaces[joint];
  return <g data-avatar-joint-surface={joint} pointerEvents="none" aria-hidden="true">
    <defs>
      <radialGradient id={id} cx="36%" cy="28%" r="78%">
        <stop stopColor={surface.light} />
        <stop offset=".48" stopColor={surface.middle} />
        <stop offset="1" stopColor={surface.shade} />
      </radialGradient>
    </defs>
    <ellipse cx={at[0]} cy={at[1]} rx={surface.rx} ry={surface.ry} fill={`url(#${id})`} />
  </g>;
}
