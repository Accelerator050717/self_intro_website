/** Bake the existing Three.js RoomEnvironment once, with no external assets. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(root, 'public', 'images', 'ice');
const source = 'three@0.186.0 RoomEnvironment; PMREMGenerator.fromScene(room, 0.04, 0.1, 100, { size: 128 }); position=(0,0,0)';

// The source is bundled in memory; only the final compressed asset is written.
// GPU readback and DataTexture both start with the bottom row: do not flip Y.
const browserSource = `
import {
  DataTexture, DataUtils, HalfFloatType, LinearFilter, LinearSRGBColorSpace,
  CubeUVReflectionMapping, Mesh, NoBlending, NoToneMapping, OrthographicCamera,
  PlaneGeometry, PMREMGenerator, REVISION, RGBAFormat, Scene, ShaderMaterial,
  WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

window.bake = async () => {
  if (REVISION !== '186') throw new Error('Re-review the bake before upgrading Three.js.');
  if (new Uint8Array(new Uint16Array([0x1234]).buffer)[0] !== 0x34) {
    throw new Error('This asset format requires a little-endian host.');
  }
  const renderer = new WebGLRenderer({ antialias: false, alpha: true });
  renderer.setSize(8, 8);
  renderer.toneMapping = NoToneMapping;
  const gl = renderer.getContext();
  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  let target;
  let restored;
  let copiedTarget;
  let geometry;
  let material;
  try {
    // Preserve the original room and blur; halve the former 256 face size
    // to reduce the network asset. This is an explicit resolution tradeoff.
    target = generator.fromScene(room, 0.04, 0.1, 100, { size: 128 });
    const { width, height } = target;
    if (width !== 384 || height !== 512 || target.texture.type !== HalfFloatType ||
        target.texture.mapping !== CubeUVReflectionMapping ||
        target.texture.colorSpace !== LinearSRGBColorSpace || target.texture.flipY) {
      throw new Error('Unexpected PMREM format, dimensions, color space, or orientation.');
    }
    const pixels = new Uint16Array(width * height * 4);
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height, pixels);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('RGBA16F GPU readback failed.');

    // The original scene sets these clear colors before PMREM creation.
    // Verify the enclosing room completely hides the renderer background.
    const clearColorDifferingHalfWords = {};
    for (const [theme, color] of [['light', '#f4f8fc'], ['dark', '#101e2c']]) {
      renderer.setClearColor(color, 1);
      const themedTarget = generator.fromScene(room, 0.04, 0.1, 100, { size: 128 });
      try {
        const themedPixels = new Uint16Array(pixels.length);
        await renderer.readRenderTargetPixelsAsync(themedTarget, 0, 0, width, height, themedPixels);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Theme readback failed.');
        let differing = 0;
        for (let i = 0; i < pixels.length; i += 1) {
          if (pixels[i] !== themedPixels[i]) differing += 1;
        }
        clearColorDifferingHalfWords[theme] = differing;
        if (differing !== 0) throw new Error(theme + ' clear color changed ' + differing + ' environment half words.');
      } finally {
        themedTarget.dispose();
      }
    }

    let min = Infinity;
    let max = -Infinity;
    let nonzero = 0;
    let aboveOne = 0;
    let nonFinite = 0;
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 1) {
      const value = DataUtils.fromHalfFloat(pixels[i]);
      if (!Number.isFinite(value)) nonFinite += 1;
      if (i % 4 === 3) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
      sum += value;
      if (value !== 0) nonzero += 1;
      if (value > 1) aboveOne += 1;
    }
    if (nonFinite !== 0 || nonzero === 0 || min < 0 || max <= 1 || aboveOne === 0) {
      throw new Error('Invalid or empty environment: ' + JSON.stringify({ min, max, nonzero, aboveOne, nonFinite }));
    }

    restored = new DataTexture(pixels, width, height, RGBAFormat, HalfFloatType);
    restored.mapping = CubeUVReflectionMapping;
    restored.colorSpace = LinearSRGBColorSpace;
    restored.minFilter = LinearFilter;
    restored.magFilter = LinearFilter;
    restored.generateMipmaps = false;
    restored.flipY = false;
    restored.needsUpdate = true;

    // Sample every reuploaded texel at its center. An exact half-word match
    // proves the saved bottom-to-top rows preserve the original GPU texture.
    copiedTarget = new WebGLRenderTarget(width, height, {
      type: HalfFloatType, format: RGBAFormat, colorSpace: LinearSRGBColorSpace,
      minFilter: LinearFilter, magFilter: LinearFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    });
    geometry = new PlaneGeometry(2, 2);
    material = new ShaderMaterial({
      uniforms: { sourceTexture: { value: restored } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D sourceTexture; void main() { gl_FragColor = texelFetch(sourceTexture, ivec2(gl_FragCoord.xy), 0); }',
      depthTest: false, depthWrite: false, blending: NoBlending, toneMapped: false,
    });
    const copyScene = new Scene();
    copyScene.add(new Mesh(geometry, material));
    renderer.setRenderTarget(copiedTarget);
    renderer.render(copyScene, new OrthographicCamera(-1, 1, 1, -1, 0, 1));
    renderer.setRenderTarget(null);
    const copiedPixels = new Uint16Array(pixels.length);
    await renderer.readRenderTargetPixelsAsync(copiedTarget, 0, 0, width, height, copiedPixels);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('DataTexture round-trip GPU readback failed.');
    let differingHalfWords = 0;
    for (let i = 0; i < pixels.length; i += 1) {
      if (pixels[i] !== copiedPixels[i]) differingHalfWords += 1;
    }
    if (differingHalfWords !== 0) throw new Error('Texture round-trip changed ' + differingHalfWords + ' half words.');

    const upload = await fetch('/result', { method: 'POST', body: pixels.buffer });
    if (!upload.ok) throw new Error('Unable to transfer baked pixels to the local generator.');
    return {
      width, height,
      validation: {
        validHalfFloat: true, nonFiniteHalfValues: nonFinite,
        rgbMin: min, rgbMax: max, rgbMean: sum / (width * height * 3),
        nonzeroRgbValues: nonzero, rgbValuesAboveOne: aboveOne,
        totalRgbValues: width * height * 3,
        roundTripDifferingHalfWords: differingHalfWords,
        clearColorDifferingHalfWords,
      },
    };
  } finally {
    material?.dispose();
    geometry?.dispose();
    copiedTarget?.dispose();
    restored?.dispose();
    target?.dispose();
    generator.dispose();
    room.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
};
`;

const bundled = await build({
  stdin: { contents: browserSource, resolveDir: root, sourcefile: 'ice-environment-browser.js', loader: 'js' },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
});
let uploaded;
const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><title>Local ice environment bake</title><script type="module" src="/bake.js"></script>');
    } else if (request.method === 'GET' && request.url === '/bake.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript' });
      response.end(bundled.outputFiles[0].contents);
    } else if (request.method === 'POST' && request.url === '/result') {
      const chunks = [];
      let byteLength = 0;
      for await (const chunk of request) {
        byteLength += chunk.length;
        if (byteLength > 384 * 512 * 8) throw new Error('Unexpected upload size.');
        chunks.push(chunk);
      }
      uploaded = Buffer.concat(chunks);
      response.writeHead(204);
      response.end();
    } else {
      response.writeHead(404);
      response.end();
    }
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(180_000);
  // No remote asset fetching is necessary or permitted for this generator.
  await page.route('**/*', (route) => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.bake === 'function');
  const result = await page.evaluate(() => window.bake());
  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
  if (!uploaded || uploaded.byteLength !== result.width * result.height * 8) {
    throw new Error('Missing or truncated raw RGBA16F data.');
  }
  const compressed = gzipSync(uploaded, { level: 9 });
  if (!gunzipSync(compressed).equals(uploaded)) throw new Error('Gzip round trip failed.');
  const metadata = {
    version: 1, width: result.width, height: result.height, format: 'rgba16f',
    byteLength: uploaded.byteLength,
    sha256: createHash('sha256').update(uploaded).digest('hex'),
    source,
    byteOrder: 'little-endian', rowOrder: 'bottom-to-top', flipY: false,
    mapping: 'CubeUVReflectionMapping', colorSpace: 'LinearSRGBColorSpace',
    minFilter: 'LinearFilter', magFilter: 'LinearFilter', generateMipmaps: false,
    compressedByteLength: compressed.byteLength,
    attribution: 'Three.js authors, MIT; RoomEnvironment is based on the model-viewer EnvironmentScene.',
    license: (await readFile(join(root, 'node_modules', 'three', 'LICENSE'), 'utf8')).replaceAll('\r\n', '\n').trim(),
    validation: result.validation,
  };
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, 'studio-cubeuv.bin.gz'), compressed);
  await writeFile(join(outputDirectory, 'studio-cubeuv.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(JSON.stringify(metadata, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
