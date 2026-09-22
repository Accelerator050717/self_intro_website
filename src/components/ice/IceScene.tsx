import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Color, CubeUVReflectionMapping, DataTexture, Group, HalfFloatType, Line, LinearFilter, LinearSRGBColorSpace, Mesh, NoToneMapping, OrthographicCamera, RGBAFormat, SRGBColorSpace, Vector3, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from 'three';
import IceBrick, { IceBrickResources } from './IceBrick';
import { studioPalette } from './studio-palette';

type SceneProps = {
  active: boolean; interactive?: boolean; dark?: boolean;
  onReady: () => void; onFailure: () => void;
};

function createLightField(dark: boolean) {
  const palette = studioPalette[dark ? 'dark' : 'light'];
  const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const paper = rgb(palette.paper);
  const lobes = [
    { color: rgb(palette.cyan), x: 0.38, y: 0.66, rx: 0.43, ry: 0.34, strength: dark ? 0.26 : 0.55 },
    { color: rgb(palette.blue), x: 0.61, y: 0.79, rx: 0.38, ry: 0.21, strength: dark ? 0.3 : 0.24 },
    { color: rgb(palette.violet), x: 0.73, y: 0.36, rx: 0.3, ry: 0.4, strength: dark ? 0.22 : 0.38 },
  ];
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const x = column / (size - 1);
    const y = 1 - row / (size - 1);
    // Exact paper at the outer edge avoids a colored line at the Canvas bounds.
    const edge = Math.min(1, Math.min(x, 1 - x) / 0.07, Math.min(y, 1 - y) / 0.06);
    const color = [...paper];
    for (const lobe of lobes) {
      const radius = ((x - lobe.x) / lobe.rx) ** 2 + ((y - lobe.y) / lobe.ry) ** 2;
      const weight = Math.exp(-2 * radius) * lobe.strength * edge;
      for (let channel = 0; channel < 3; channel++) color[channel] += (lobe.color[channel] - color[channel]) * weight;
    }
    const index = (row * size + column) * 4;
    for (let channel = 0; channel < 3; channel++) pixels[index + channel] = Math.round(color[channel]);
    pixels[index + 3] = 255;
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

async function loadStudioEnvironment(signal: AbortSignal): Promise<DataTexture> {
  const [metadataResponse, textureResponse] = await Promise.all([
    fetch('/images/ice/studio-cubeuv.json', { signal }),
    fetch('/images/ice/studio-cubeuv.bin.gz', { signal }),
  ]);
  if (!metadataResponse.ok || !textureResponse.ok) throw new Error('Local studio environment is unavailable');
  const metadata = await metadataResponse.json();
  if (metadata.version !== 1 || metadata.format !== 'rgba16f' || !Number.isInteger(metadata.width) || !Number.isInteger(metadata.height)
    || metadata.width < 16 || metadata.height < 16 || metadata.width > 2048 || metadata.height > 2048) throw new Error('Invalid studio environment metadata');
  const packed = await textureResponse.arrayBuffer();
  const signature = new Uint8Array(packed, 0, Math.min(2, packed.byteLength));
  // A host may already send Content-Encoding:gzip. Only unpack a gzip payload.
  const decoded = signature[0] === 0x1f && signature[1] === 0x8b
    ? await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : packed;
  if (decoded.byteLength !== metadata.width * metadata.height * 8 || decoded.byteLength !== metadata.byteLength) throw new Error('Invalid studio environment data');
  const texture = new DataTexture(new Uint16Array(decoded), metadata.width, metadata.height, RGBAFormat, HalfFloatType);
  texture.mapping = CubeUVReflectionMapping;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

async function compileStudio(gl: WebGLRenderer, scene: Scene, camera: Camera, signal: AbortSignal) {
  // Three's transmission prepass renders opaque objects into a linear target
  // without tone mapping. Precompile that variant too, or its first use stalls
  // even when the normal screen shaders have completed compileAsync().
  const opaque = new Group();
  scene.traverse(object => {
    if (!(object instanceof Mesh || object instanceof Line)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every(material => !material.transparent && !('transmission' in material && Number(material.transmission) > 0))) opaque.add(object.clone(false));
  });
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, colorSpace: LinearSRGBColorSpace });
  const previousTarget = gl.getRenderTarget();
  const previousToneMapping = gl.toneMapping;
  let prepass: Promise<unknown>;
  try {
    gl.setRenderTarget(target);
    gl.toneMapping = NoToneMapping;
    prepass = gl.compileAsync(opaque, camera, scene);
  } finally {
    gl.setRenderTarget(previousTarget);
    gl.toneMapping = previousToneMapping;
  }
  try { await prepass; } finally { target.dispose(); }
  if (signal.aborted) return;
  await gl.compileAsync(scene, camera);
}

function Studio({ dark, onReady, onFailure, onPrepared }: Pick<SceneProps, 'dark' | 'onReady' | 'onFailure'> & { onPrepared: () => void }) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const reported = useRef(false);
  const backdrop = useRef<Mesh>(null);
  const lightField = useMemo(() => createLightField(Boolean(dark)), [dark]);
  useEffect(() => () => lightField.dispose(), [lightField]);
  useEffect(() => {
    // A real local backdrop participates in the transmission prepass; DOM color
    // behind a transparent canvas cannot supply refracted light to the material.
    const previousBackground = scene.background;
    const paper = studioPalette[dark ? 'dark' : 'light'].paper;
    scene.background = new Color(paper);
    gl.setClearColor(paper, 1);
    invalidate();
    return () => { scene.background = previousBackground; };
  }, [dark, gl, scene, invalidate]);
  useEffect(() => {
    const controller = new AbortController();
    let environment: DataTexture | undefined;
    let disposed = false;
    const prepare = async () => {
      try {
        environment = await loadStudioEnvironment(controller.signal);
        if (disposed) { environment.dispose(); return; }
        scene.environment = environment;
        gl.initTexture(environment);
        await compileStudio(gl, scene, camera, controller.signal);
        if (!disposed) onPrepared();
      } catch {
        if (!disposed) onFailure();
      }
    };
    void prepare();
    return () => {
      disposed = true;
      controller.abort();
      scene.environment = null;
      environment?.dispose();
    };
  }, [gl, scene, camera, onPrepared, onFailure]);
  useEffect(() => {
    const handleLost = (event: Event) => { event.preventDefault(); onFailure(); };
    gl.domElement.addEventListener('webglcontextlost', handleLost);
    return () => gl.domElement.removeEventListener('webglcontextlost', handleLost);
  }, [gl, onFailure]);
  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    camera.zoom = Math.min(size.width / 7.1, size.height / 7.75);
    camera.position.set(7, 8, 12);
    camera.lookAt(0, 2.75, 0);
    camera.updateProjectionMatrix();
    if (backdrop.current) {
      const direction = camera.getWorldDirection(new Vector3());
      backdrop.current.position.copy(camera.position).addScaledVector(direction, 35);
      backdrop.current.quaternion.copy(camera.quaternion);
      backdrop.current.scale.set((camera.right - camera.left) / camera.zoom * 1.01, (camera.top - camera.bottom) / camera.zoom * 1.01, 1);
    }
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  useFrame(() => {
    if (!reported.current) { reported.current = true; requestAnimationFrame(onReady); }
  });
  return <>
    <mesh ref={backdrop} renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={lightField} toneMapped={false} depthWrite={false} />
    </mesh>
    <ambientLight intensity={dark ? 0.42 : 0.5} color={dark ? '#91cddd' : '#def7ff'} />
    <directionalLight position={[-4, 9, 6]} intensity={dark ? 2 : 1.65} color="#f2fcff" />
    <directionalLight position={[6, 3, -4]} intensity={1.15} color="#b9b4f5" />
  </>;
}

function SoftShadow() {
  const texture = useMemo(() => {
    const size = 64;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const distance = Math.hypot((x - size / 2) / (size / 2), (y - size / 2) / (size / 2));
      const index = (y * size + x) * 4;
      pixels[index] = 29; pixels[index + 1] = 70; pixels[index + 2] = 100;
      pixels[index + 3] = Math.round(Math.pow(Math.max(0, 1 - distance), 2) * 110);
    }
    const result = new DataTexture(pixels, size, size, RGBAFormat);
    result.magFilter = LinearFilter;
    result.needsUpdate = true;
    return result;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.46, 0.6]}>
    <planeGeometry args={[7.5, 5]} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} />
  </mesh>;
}

function HeroArrangement({ interactive }: { interactive: boolean }) {
  return <>
    <IceBrick position={[-0.65, 0.22, 0.04]} rotation={-0.16} scale={1.4} />
    <IceBrick position={[0.55, -0.08, 0.58]} rotation={-0.16} scale={1.35} pale />
    <IceBrick kind="2x2" position={[-2.1, 0.04, 1.4]} rotation={0.28} scale={0.76} interactive={interactive} />
    <IceBrick kind="2x2" position={[2.05, 1.25, -0.9]} rotation={0.23} scale={0.7} interactive={interactive} pale />
    <IceBrick kind="2x2" position={[2.45, -0.05, 1.1]} rotation={-0.36} scale={0.54} interactive={interactive} />
    <SoftShadow />
  </>;
}

export default function IceScene({ active, interactive = false, dark = false, onReady, onFailure }: SceneProps) {
  const [prepared, setPrepared] = useState(false);
  const onPrepared = useCallback(() => setPrepared(true), []);
  return <Canvas className="ice-canvas" orthographic camera={{ position: [7, 8, 12], zoom: 70, near: 0.1, far: 70 }}
    frameloop={active && prepared ? 'demand' : 'never'} dpr={[1, 1.25]}
    gl={{ alpha: true, antialias: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true }}
    onCreated={({ gl }) => {
      gl.setClearColor(studioPalette[dark ? 'dark' : 'light'].paper, 1);
      gl.transmissionResolutionScale = 0.75;
      gl.toneMapping = ACESFilmicToneMapping;
      gl.toneMappingExposure = 0.95;
      gl.outputColorSpace = SRGBColorSpace;
    }}
    style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }}>
    <Studio dark={dark} onReady={onReady} onFailure={onFailure} onPrepared={onPrepared} />
    <IceBrickResources dark={dark}>
      <HeroArrangement interactive={interactive && active} />
    </IceBrickResources>
  </Canvas>;
}
