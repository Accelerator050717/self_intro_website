import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BufferGeometry, CylinderGeometry, InstancedMesh, LineBasicMaterial, Matrix4, MeshPhysicalMaterial, SphereGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type BrickKind = '2x2' | '2x4';

const BODY_HEIGHT = 0.5;
const STUD_PITCH = 0.46;

function createResources(dark: boolean) {
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
  const material = (color: string, roughness: number) => new MeshPhysicalMaterial({
    color, roughness, metalness: 0, transmission: 0.86, opacity: 1,
    thickness: 0.55, ior: 1.31, attenuationColor: '#aad8f0', attenuationDistance: 3.2,
    clearcoat: 0.72, clearcoatRoughness: 0.12, envMapIntensity: dark ? 1.4 : 1.2,
  });
  return {
    square: new RoundedBoxGeometry(STUD_PITCH * 2 - 0.03, BODY_HEIGHT, STUD_PITCH * 2 - 0.03, 3, 0.065),
    long: new RoundedBoxGeometry(STUD_PITCH * 4 - 0.03, BODY_HEIGHT, STUD_PITCH * 2 - 0.03, 3, 0.065),
    stud: new CylinderGeometry(0.14, 0.148, 0.14, 20, 1),
    squareRim: rim(2), longRim: rim(4),
    rimMaterial: new LineBasicMaterial({ color: '#e4f7ff', transparent: true, opacity: dark ? 0.46 : 0.65, depthWrite: false }),
    bubble: new SphereGeometry(0.023, 10, 8),
    bubbleMaterial: new MeshPhysicalMaterial({ color: '#edfaff', roughness: 0.06, metalness: 0, clearcoat: 1 }),
    vein: new BufferGeometry().setFromPoints(Array.from({ length: 26 }, (_, index) => { const step = Math.floor(index / 2) + index % 2; return new Vector3(-0.55 + step * 0.062, -0.065 + Math.sin(step * 0.38) * 0.025, 0.28); })),
    veinMaterial: new LineBasicMaterial({ color: '#cae7f3' }),
    blue: material(dark ? '#9ed7f0' : '#b5def2', 0.1),
    pale: material(dark ? '#c2e2f3' : '#d7edf8', 0.16),
    highlight: material('#caecfc', 0.09),
  };
}
type Resources = ReturnType<typeof createResources>;
const BrickResources = createContext<Resources | null>(null);

/** One geometry/material set per Canvas; released together when that Canvas leaves. */
export function IceBrickResources({ dark = false, children }: { dark?: boolean; children: ReactNode }) {
  const resources = useMemo(() => createResources(dark), [dark]);
  useEffect(() => () => Object.values(resources).forEach(resource => resource.dispose()), [resources]);
  return <BrickResources.Provider value={resources}>{children}</BrickResources.Provider>;
}

export default function IceBrick({ kind = '2x4', position = [0, 0, 0], rotation = 0, scale = 1, pale = false, interactive = false }: {
  kind?: BrickKind; position?: [number, number, number]; rotation?: number; scale?: number; pale?: boolean; interactive?: boolean;
}) {
  const resources = useContext(BrickResources);
  if (!resources) throw new Error('IceBrick needs IceBrickResources');
  const studs = useRef<InstancedMesh>(null);
  const [hovered, setHovered] = useState(false);
  const columns = kind === '2x4' ? 4 : 2;
  const material = hovered && interactive ? resources.highlight : pale ? resources.pale : resources.blue;
  useEffect(() => {
    const instance = studs.current;
    return () => instance?.dispose();
  }, [resources.stud, material]);
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
  }, [columns, resources.stud, material]);
  return <group position={[position[0], position[1] + (hovered && interactive ? 0.055 : 0), position[2]]} rotation={[0, rotation, 0]} scale={scale} dispose={null}
    onPointerOver={interactive ? () => setHovered(true) : undefined}
    onPointerOut={interactive ? () => setHovered(false) : undefined}>
    <mesh geometry={kind === '2x4' ? resources.long : resources.square} material={material} castShadow receiveShadow />
    <lineLoop geometry={kind === '2x4' ? resources.longRim : resources.squareRim} material={resources.rimMaterial} position={[0, BODY_HEIGHT / 2 - 0.022, 0]} />
    <mesh geometry={resources.bubble} material={resources.bubbleMaterial} position={[columns * 0.066, -0.045, 0.31]} />
    <mesh geometry={resources.bubble} material={resources.bubbleMaterial} position={[columns * 0.075, 0.02, 0.295]} scale={0.48} />
    <mesh geometry={resources.bubble} material={resources.bubbleMaterial} position={[-columns * 0.07, 0.07, 0.26]} scale={0.7} />
    <lineSegments geometry={resources.vein} material={resources.veinMaterial} scale={[columns / 4, 1, 1]} />
    <instancedMesh ref={studs} args={[resources.stud, material, columns * 2]} castShadow receiveShadow />
  </group>;
}
