export const GREETING_MS = 3400;
export const REDUCED_GREETING_MS = 500;
export type GreetingPhase = 'idle' | 'preparing' | 'raising' | 'waving' | 'recovering';
export type MovingJoint = 'shoulder' | 'elbow' | 'wrist' | 'head';
export type AvatarRig = {
  width: 720;
  height: 960;
  joints: Record<'shoulder' | 'elbow' | 'wrist' | 'neck', [number, number]>;
};

export function parseRig(value: unknown): AvatarRig {
  const rig = value as AvatarRig | null;
  if (rig?.width !== 720 || rig?.height !== 960) throw new Error('Unexpected avatar canvas');
  for (const name of ['shoulder', 'elbow', 'wrist', 'neck'] as const) {
    const point = rig.joints?.[name];
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)
      || point[0] < 0 || point[0] > 720 || point[1] < 0 || point[1] > 960) {
      throw new Error('Invalid avatar joint');
    }
  }
  return rig;
}

// Idle is assigned only after ALL joint promises resolve and pose cleanup.
export function greetingPhaseAt(elapsed: number, reduced = false): Exclude<GreetingPhase, 'idle'> {
  const [raising, waving, recovering] = reduced ? [80, 160, 320] : [320, 1140, 2500];
  if (elapsed < raising) return 'preparing';
  if (elapsed < waving) return 'raising';
  if (elapsed < recovering) return 'waving';
  return 'recovering';
}

const soft = 'cubic-bezier(.42, 0, .58, 1)';
const lift = 'cubic-bezier(.28, .02, .2, 1)';
const settle = 'cubic-bezier(.18, .65, .32, 1)';
const returnEase = 'cubic-bezier(.4, 0, .25, 1)';
type PosePoint = { at: number; degrees: number; easing: string };
const point = (at: number, degrees: number, easing = soft): PosePoint => ({ at, degrees, easing });

// Reference images show viewer-left waving. This registered viewer-right rig
// adapts mirrored height/shape constraints without mirroring the face or making
// up unseen palm surfaces. Distinct starts/ends, preparation, a raised pause and
// per-segment easing replace the former common-offset/common-ease angle table.
export const gestureTimeline: Record<MovingJoint, { duration: number; points: PosePoint[] }> = {
  shoulder: { duration: GREETING_MS, points: [
    point(0, 0), point(160, 2.5), point(320, 1, lift),
    point(820, -54, settle), point(1080, -64), point(1300, -64),
    point(1600, -63.4), point(1940, -64), point(2300, -63.5), point(2500, -64, returnEase),
    point(2810, -38, returnEase), point(3160, -7, settle), point(3400, 0),
  ] },
  elbow: { duration: 3280, points: [
    point(0, 0), point(200, 0), point(350, -4, lift), point(610, -21, lift),
    point(920, -70, settle), point(1140, -86), point(1320, -86),
    point(1740, -85.5), point(2150, -86), point(2810, -86, returnEase),
    point(2980, -56, returnEase), point(3170, -9, settle), point(3280, 0),
  ] },
  wrist: { duration: 2780, points: [
    point(0, 0), point(430, 0), point(660, -2), point(1060, -5), point(1280, -5),
    point(1510, 11), point(1760, -10), point(2020, 8), point(2270, -6),
    point(2480, 2, settle), point(2680, -.5, settle), point(2780, 0),
  ] },
  head: { duration: 3340, points: [
    point(0, 0), point(100, .4), point(320, -.7), point(780, -1.5),
    point(1200, -1.8), point(1680, -1.25), point(2110, -1.5),
    point(2500, -1), point(2980, -.3, settle), point(3340, 0),
  ] },
};

export function greetingFrames(joint: MovingJoint, initialHeadDegrees = 0): Keyframe[] {
  const track = gestureTimeline[joint];
  return track.points.map(({ at, degrees, easing }, index) => ({
    offset: at / track.duration,
    transform: `rotate(${joint === 'head' && index === 0 ? initialHeadDegrees : degrees}deg)`,
    easing,
  }));
}

// Historical recording scripts can still read normalized points. Runtime uses
// the full independent durations and easing tracks above.
export const greetingTracks = Object.fromEntries(Object.entries(gestureTimeline).map(([joint, track]) =>
  [joint, track.points.map(({ at, degrees }) => [at / track.duration, degrees])],
)) as Record<MovingJoint, [number, number][]>;
