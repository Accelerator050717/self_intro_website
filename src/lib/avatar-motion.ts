export const GREETING_MS = 2600;
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

// Checked against the actual image layers. Child rotations are relative to their parent joint.
// Browser compositor animations leave the fixed body/feet untouched and need no per-frame React updates.
export const greetingTracks: Record<'shoulder' | 'elbow' | 'wrist' | 'head', [number, number][]> = {
  shoulder: [[0, 0], [.1, -8], [.28, -68], [.39, -68], [.49, -68], [.59, -68], [.69, -68], [.88, -9], [1, 0]],
  elbow: [[0, 0], [.1, -6], [.28, -64], [.39, -64], [.49, -64], [.59, -64], [.69, -64], [.88, -7], [1, 0]],
  wrist: [[0, 0], [.1, 0], [.28, -8], [.39, 12], [.49, -12], [.59, 12], [.69, -8], [.88, 0], [1, 0]],
  head: [[0, 0], [.1, -1], [.28, -2], [.39, -2], [.49, -2], [.59, -1.5], [.69, -1], [.88, -.5], [1, 0]],
};
