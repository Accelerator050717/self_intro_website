import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, LineBasicMaterial, Matrix4, MeshBasicMaterial, MeshPhysicalMaterial, SphereGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type BrickKind = '2x2' | '2x4';

const BODY_HEIGHT = 0.5;
const STUD_PITCH = 0.46;
// Decorative lines use Three's wide default line-hit threshold. Let the solid
// body/studs determine the local hit point instead of catching a distant rim.
const ignoreDecorativeRaycast = () => {};

function createGeometries() {
  const rim = (columns: number) => {
    const halfWidth = (STUD_PITCH * columns - 0.03) / 2 - 0.017;
    const halfDepth = (STUD_PITCH * 2 - 0.03) / 2 - 0.017;
    const radius = 0.055;
    const points: Vector3[] = [];
    for (const [x, z, angle] of [[halfWidth - radius, halfDepth - radius, 0], [-halfWidth + radius, halfDepth - radius, Math.PI / 2], [-halfWidth + radius, -halfDepth + radius, Math.PI], [halfWidth - radius, -halfDepth + radius, Math.PI * 1.5]]) {
      for (let step = 0; step <= 5; step++) {
        const turn = angle + step / 5 * Math.PI / 2;
        points.push(new Vector3(x + radius * Math.cos(turn), 0, z + radius * Math.sin(turn)));
      }
    }
    return new BufferGeometry().setFromPoints(points);
  };
  return {
    square: new RoundedBoxGeometry(STUD_PITCH * 2 - 0.03, BODY_HEIGHT, STUD_PITCH * 2 - 0.03, 3, 0.065),
    long: new RoundedBoxGeometry(STUD_PITCH * 4 - 0.03, BODY_HEIGHT, STUD_PITCH * 2 - 0.03, 3, 0.065),
    stud: new CylinderGeometry(0.14, 0.148, 0.14, 20, 1),
    squareRim: rim(2), longRim: rim(4),
    bubble: new SphereGeometry(0.023, 10, 8),
    vein: new BufferGeometry().setFromPoints(Array.from({ length: 26 }, (_, index) => { const step = Math.floor(index / 2) + index % 2; return new Vector3(-0.55 + step * 0.062, -0.065 + Math.sin(step * 0.38) * 0.025, 0.28); })),
  };
}

function createMaterials(dark: boolean) {
  const material = (color: string, roughness: number, attenuationColor: string) => new MeshPhysicalMaterial({
    color, roughness, metalness: 0, transmission: 0.94, opacity: 1,
    thickness: 0.65, ior: 1.31, attenuationColor, attenuationDistance: 3.2,
    // Keep the refracted display-referred light field as bright as its backdrop.
    // ACES on this surface alone turns the same pale background into grey paint.
    toneMapped: false,
    // Ice needs refraction and a smooth boundary, not an extra clearcoat lobe.
    clearcoat: 0, envMapIntensity: dark ? 1.35 : 1.1,
  });
  return {
    rimMaterial: new LineBasicMaterial({ color: '#e8fbff', transparent: true, opacity: dark ? 0.54 : 0.72, depthWrite: false }),
    bubbleMaterial: new MeshBasicMaterial({ color: '#ddfaff' }),
    veinMaterial: new LineBasicMaterial({ color: dark ? '#b6eff7' : '#c6f1f9' }),
    blue: material(dark ? '#bfeefa' : '#dffaff', 0.06, '#74dceb'),
    pale: material(dark ? '#d5e3fa' : '#e8f0ff', 0.075, '#a4c5ef'),
  };
}
type Resources = ReturnType<typeof createGeometries> & ReturnType<typeof createMaterials>;
const BrickResources = createContext<Resources | null>(null);

/** Geometry survives theme changes; each Canvas still owns and releases its resources. */
export function IceBrickResources({ dark = false, children }: { dark?: boolean; children: ReactNode }) {
  const geometries = useMemo(createGeometries, []);
  const materials = useMemo(() => createMaterials(dark), [dark]);
  const resources = useMemo(() => ({ ...geometries, ...materials }), [geometries, materials]);
  useEffect(() => () => Object.values(geometries).forEach(resource => resource.dispose()), [geometries]);
  useEffect(() => () => Object.values(materials).forEach(resource => resource.dispose()), [materials]);
  return <BrickResources.Provider value={resources}>{children}</BrickResources.Provider>;
}

export default function IceBrick({ kind = '2x4', position = [0, 0, 0], rotation = 0, scale = 1, pale = false, interactive = false }: {
  kind?: BrickKind; position?: [number, number, number]; rotation?: number; scale?: number; pale?: boolean; interactive?: boolean;
}) {
  const resources = useContext(BrickResources);
  if (!resources) throw new Error('IceBrick needs IceBrickResources');
  const invalidate = useThree(state => state.invalidate);
  const group = useRef<Group>(null);
  const studs = useRef<InstancedMesh>(null);
  const [hovered, setHovered] = useState(false);
  const columns = kind === '2x4' ? 4 : 2;
  const baseMaterial = pale ? resources.pale : resources.blue;
  const localPoint = useMemo(() => new Vector3(), []);
  const highlight = useMemo(() => {
    const result = baseMaterial.clone();
    result.color.lerp(new Color('#ebfbff'), 0.16);
    result.roughness = Math.max(0.025, baseMaterial.roughness * 0.64);
    return result;
  }, [baseMaterial]);
  useEffect(() => () => highlight.dispose(), [highlight]);
  const material = hovered && interactive ? highlight : baseMaterial;
  const resetHover = useCallback(() => {
    setHovered(false);
    if (group.current) {
      group.current.position.y = position[1];
      group.current.rotation.set(0, rotation, 0);
    }
    invalidate();
  }, [position[1], rotation, invalidate]);
  useEffect(() => { if (!interactive) resetHover(); }, [interactive, resetHover]);

  function moveHighlight(event: ThreeEvent<PointerEvent>) {
    if (!interactive || event.pointerType !== 'mouse' || !group.current) return;
    event.stopPropagation();
    if (!hovered) setHovered(true);
    group.current.worldToLocal(localPoint.copy(event.point));
    const x = Math.max(-1, Math.min(1, localPoint.x / (STUD_PITCH * columns / 2)));
    const z = Math.max(-1, Math.min(1, localPoint.z / STUD_PITCH));
    // A bounded rigid tilt and specular change follow the local hit point.
    // Only pointer events invalidate; no animation loop continues after a move.
    group.current.rotation.x = z * 0.018;
    group.current.rotation.z = -x * 0.022;
    // With scene.environment Three uses scene.environmentIntensity rather than
    // material.envMapIntensity. Roughness is a genuinely local material uniform.
    highlight.roughness = Math.max(0.025, baseMaterial.roughness * (0.64 - x * 0.1));
    invalidate();
  }
  useEffect(() => {
    const instance = studs.current;
    return () => instance?.dispose();
  }, [resources.stud, resources.blue, columns]);
  useLayoutEffect(() => {
    if (!studs.current) return;
    const matrix = new Matrix4();
    for (let x = 0; x < columns; x++) {
      for (let z = 0; z < 2; z++) {
        matrix.makeTranslation((x - (columns - 1) / 2) * STUD_PITCH, BODY_HEIGHT / 2 + 0.06, (z - 0.5) * STUD_PITCH);
        studs.current.setMatrixAt(x * 2 + z, matrix);
      }
    }
    studs.current.instanceMatrix.needsUpdate = true;
    studs.current.computeBoundingSphere();
  }, [columns, resources.stud, resources.blue]);
  return <group ref={group} position={[position[0], position[1] + (hovered && interactive ? 0.055 : 0), position[2]]} rotation={[0, rotation, 0]} scale={scale} dispose={null}
    onPointerOver={interactive ? moveHighlight : undefined}
    onPointerMove={interactive ? moveHighlight : undefined}
    onPointerOut={interactive ? resetHover : undefined}
    onPointerCancel={interactive ? resetHover : undefined}>
    <mesh geometry={kind === '2x4' ? resources.long : resources.square} material={material} castShadow receiveShadow />
    <lineLoop geometry={kind === '2x4' ? resources.longRim : resources.squareRim} material={resources.rimMaterial} position={[0, BODY_HEIGHT / 2 - 0.022, 0]} raycast={ignoreDecorativeRaycast} />
    <mesh geometry={resources.bubble} material={resources.bubbleMaterial} position={[columns * 0.066, -0.045, 0.31]} />
    <mesh geometry={resources.bubble} material={resources.bubbleMaterial} position={[columns * 0.075, 0.02, 0.295]} scale={0.48} />
    <mesh geometry={resources.bubble} material={resources.bubbleMaterial} position={[-columns * 0.07, 0.07, 0.26]} scale={0.7} />
    <lineSegments geometry={resources.vein} material={resources.veinMaterial} scale={[columns / 4, 1, 1]} raycast={ignoreDecorativeRaycast} />
    <instancedMesh ref={studs} args={[resources.stud, resources.blue, columns * 2]} material={material} castShadow receiveShadow />
  </group>;
}
