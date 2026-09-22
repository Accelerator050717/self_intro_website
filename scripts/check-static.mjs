/**
 * Static artifact audit; no external website is requested.
 * 1. node scripts/check-static.mjs
 * 2. Build a SITE_URL fixture into .verification/site-url (never overwrite dist).
 * 3. node scripts/check-static.mjs --configured .verification/site-url --site https://portfolio.test
 * Step 3 retains the baseline fingerprint to prove the live dist was unchanged.
 */
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const configuredDir = option('--configured', null);
const configuredSite = option('--site', 'https://portfolio.test').replace(/\/$/, '');
const reportPath = join(root, process.env.REPORT_DIRECTORY || 'docs/reports', 'static-audit.json');
const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex');
const posix = (path) => path.replaceAll('\\', '/');
const issues = [];
const fail = (build, route, check, detail) => issues.push({ build, route, check, detail });

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? walk(join(directory, entry.name)) : [join(directory, entry.name)]));
  return result.flat().sort();
}

function routeFor(file) {
  return file === 'index.html' ? '/' : `/${file.replace(/index\.html$/, '')}`;
}

async function inspectArtifact(directory, site, page, label) {
  const files = await walk(directory);
  const fileSet = new Set(files.map((file) => posix(relative(directory, file))));
  const hashes = await Promise.all(files.map(async (file) => [posix(relative(directory, file)), checksum(await readFile(file))]));
  const fingerprint = checksum(JSON.stringify(hashes));
  const inputs = await Promise.all(files.filter((file) => file.endsWith('.html')).map(async (file) => ({
    file: posix(relative(directory, file)), html: await readFile(file, 'utf8'),
  })));
  if (inputs.length !== 24) fail(label, null, 'html-count', `Expected 24 HTML files; found ${inputs.length}`);
  for (const file of files.filter((path) => /\.(?:html|js|xml)$/.test(path))) {
    const content = await readFile(file, 'utf8');
    if (/myu12@uci\.edu|Ice Playground|\/(?:en|zh)\/play\//i.test(content)) fail(label, posix(relative(directory, file)), 'retired-public-content', 'Old contact address or retired page appears in the public artifact');
  }
  if ([...fileSet].some(file => /^(?:en|zh)\/play\//.test(file))) fail(label, null, 'retired-page', 'Retired page remains in the static artifact');
  const documents = await page.evaluate((items) => items.map(({ file, html }) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const values = (selector, attribute = 'content') => Array.from(document.querySelectorAll(selector), (node) => node.getAttribute(attribute));
    const references = [];
    document.querySelectorAll('[href],[src],[srcset],[poster],[component-url],[renderer-url]').forEach((node) => {
      for (const attribute of ['href', 'src', 'poster', 'component-url', 'renderer-url']) {
        if (node.hasAttribute(attribute)) references.push({ tag: node.tagName.toLowerCase(), attribute, value: node.getAttribute(attribute) });
      }
      const srcset = node.getAttribute('srcset');
      if (srcset && !srcset.startsWith('data:')) srcset.split(',').forEach((candidate) => {
        references.push({ tag: node.tagName.toLowerCase(), attribute: 'srcset', value: candidate.trim().split(/\s+/)[0] });
      });
    });
    return {
      file, lang: document.documentElement.lang,
      titles: Array.from(document.querySelectorAll('title'), (node) => node.textContent.trim()),
      descriptions: values('meta[name="description"]'), robots: values('meta[name="robots"]'),
      canonical: values('link[rel="canonical"]', 'href'),
      hreflang: Array.from(document.querySelectorAll('link[hreflang]'), (node) => ({ lang: node.getAttribute('hreflang'), href: node.getAttribute('href') })),
      og: Object.fromEntries(Array.from(document.querySelectorAll('meta[property^="og:"]'), (node) => [node.getAttribute('property'), node.getAttribute('content')])),
      refresh: values('meta[http-equiv="refresh"]')[0] || null,
      ids: Array.from(document.querySelectorAll('[id],[name]'), (node) => node.id || node.getAttribute('name')),
      references,
    };
  }), inputs);
  const byFile = new Map(documents.map((document) => [document.file, document]));
  const origin = site || 'https://local-audit.invalid';
  const linkCounts = { checked: 0, valid: 0, externalSkipped: 0, dataSkipped: 0, broken: 0 };
  const brokenLinks = [];
  function checkReference(value, fromRoute, reference) {
    if (/^(data:|blob:)/i.test(value || '')) { linkCounts.dataSkipped += 1; return; }
    if (/^(mailto:|tel:)/i.test(value || '')) { linkCounts.externalSkipped += 1; return; }
    const broken = (reason) => {
      linkCounts.broken += 1;
      brokenLinks.push({ from: fromRoute, value, ...reference, reason });
      fail(label, fromRoute, 'local-reference', `${value}: ${reason}`);
    };
    if (!value || value === '#') { linkCounts.checked += 1; broken('Empty target or empty anchor'); return; }
    let url;
    try { url = new URL(value, `${origin}${fromRoute}`); }
    catch { linkCounts.checked += 1; broken('Invalid URL'); return; }
    if (!['http:', 'https:'].includes(url.protocol)) { linkCounts.checked += 1; broken('Unexpected URL protocol'); return; }
    if (url.origin !== origin) { linkCounts.externalSkipped += 1; return; }
    linkCounts.checked += 1;
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const candidates = pathname ? [pathname, `${pathname.replace(/\/$/, '')}/index.html`] : ['index.html'];
    const target = candidates.find((candidate) => fileSet.has(candidate));
    if (!target) { broken('No matching output file'); return; }
    if (url.hash && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!byFile.get(target)?.ids.includes(id)) { broken(`Missing anchor ${id}`); return; }
    }
    linkCounts.valid += 1;
  }
  const eligible = [];
  for (const document of documents) {
    const route = routeFor(document.file);
    const isRedirect = route === '/' && /url=\/en\//i.test(document.refresh || '');
    const isErrorPage = /\/404(?:\.html|\/)$/.test(route);
    const isContent = !isRedirect && !isErrorPage;
    if (isContent) eligible.push({ route, document });
    const expectedLang = route.startsWith('/zh/') ? 'zh' : 'en';
    if (document.lang !== expectedLang) fail(label, route, 'lang', `Expected ${expectedLang}, found ${document.lang}`);
    if (document.titles.length !== 1 || !document.titles[0]) fail(label, route, 'title', 'Expected one nonempty title');
    if (document.descriptions.length !== 1 || !document.descriptions[0]) fail(label, route, 'description', 'Expected one nonempty description');
    const robots = document.robots.join(',').split(/[\s,]+/).filter(Boolean);
    if (document.robots.length !== 1) fail(label, route, 'robots-meta-count', 'Expected one robots meta tag');
    if ((!site || !isContent) && !robots.includes('noindex')) fail(label, route, 'noindex', 'Local, redirect and 404 pages must be noindex');
    if (site && isContent && (!robots.includes('index') || robots.includes('noindex'))) fail(label, route, 'indexable', 'Configured content page must be indexable');
    if (!isRedirect) {
      for (const property of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:locale', 'og:image']) {
        if (!document.og[property]) fail(label, route, 'open-graph', `Missing ${property}`);
      }
      if (document.og['og:title'] !== document.titles[0]) fail(label, route, 'og-title', 'OG title differs from document title');
      if (document.og['og:description'] !== document.descriptions[0]) fail(label, route, 'og-description', 'OG description differs from meta description');
      if (document.og['og:locale'] !== (expectedLang === 'zh' ? 'zh_CN' : 'en_US')) fail(label, route, 'og-locale', 'OG locale does not match language');
      const expectedImage = site ? `${site}/images/share.png` : '/images/share.png';
      if (document.og['og:image'] !== expectedImage) fail(label, route, 'og-image', `Expected ${expectedImage}`);
      checkReference(document.og['og:image'], route, { tag: 'meta', attribute: 'og:image' });
    }
    if (!site || !isContent) {
      if (document.canonical.length || document.hreflang.length || document.og['og:url']) fail(label, route, 'unpublished-canonical', 'Unexpected canonical/hreflang/OG URL on local or non-indexable page');
    } else {
      const expectedCanonical = `${site}${route}`;
      if (document.canonical.length !== 1 || document.canonical[0] !== expectedCanonical) fail(label, route, 'canonical', `Expected ${expectedCanonical}`);
      if (document.og['og:url'] !== expectedCanonical) fail(label, route, 'og-url', `Expected ${expectedCanonical}`);
      const alternates = Object.fromEntries(document.hreflang.map((item) => [item.lang, item.href]));
      if (document.hreflang.length !== 3 || Object.keys(alternates).length !== 3) fail(label, route, 'hreflang-count', 'Expected unique en, zh and x-default alternates');
      for (const language of ['en', 'zh', 'x-default']) {
        const targetLang = language === 'x-default' ? 'en' : language;
        const expected = site + route.replace(/^\/(en|zh)\//, `/${targetLang}/`);
        if (alternates[language] !== expected) fail(label, route, 'hreflang', `${language} should target ${expected}`);
      }
    }
    document.references.forEach(({ value, ...reference }) => checkReference(value, route, reference));
  }
  for (const field of ['titles', 'descriptions']) {
    const groups = new Map();
    for (const { route, document } of eligible) {
      const value = document[field][0];
      if (groups.has(value)) fail(label, route, `duplicate-${field}`, `Same value as ${groups.get(value)}`);
      else groups.set(value, route);
    }
  }
  for (const file of files.filter((path) => path.endsWith('.css'))) {
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
      if (!match[2].startsWith('#')) checkReference(match[2], `/${posix(relative(directory, file))}`, { tag: 'css', attribute: 'url' });
    }
  }
  const robotsText = await readFile(join(directory, 'robots.txt'), 'utf8');
  const sitemapFiles = [...fileSet].filter((file) => /sitemap.*\.xml$/i.test(file));
  let sitemap = null;
  if (!site) {
    if (!/^Disallow:\s*\/\s*$/m.test(robotsText) || /^Sitemap:/im.test(robotsText)) fail(label, '/robots.txt', 'robots-local', 'Expected Disallow: / and no sitemap declaration');
    if (sitemapFiles.length) fail(label, null, 'local-sitemap', `Unexpected sitemap: ${sitemapFiles.join(', ')}`);
  } else {
    if (!/^Allow:\s*\/\s*$/m.test(robotsText) || /^Disallow:\s*\/\s*$/m.test(robotsText) || !robotsText.includes(`Sitemap: ${site}/sitemap.xml`)) fail(label, '/robots.txt', 'robots-configured', 'Incorrect Allow or sitemap origin');
    if (!fileSet.has('sitemap.xml')) fail(label, '/sitemap.xml', 'sitemap-missing', 'Configured build must contain sitemap.xml');
    else {
      const xml = await readFile(join(directory, 'sitemap.xml'), 'utf8');
      sitemap = await page.evaluate((source) => {
        const doc = new DOMParser().parseFromString(source, 'application/xml');
        return { parseError: Boolean(doc.querySelector('parsererror')), entries: Array.from(doc.getElementsByTagName('url'), (node) => ({
          loc: node.getElementsByTagName('loc')[0]?.textContent,
          alternates: Array.from(node.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link'), (link) => ({ lang: link.getAttribute('hreflang'), href: link.getAttribute('href') })),
        })) };
      }, xml);
      if (sitemap.parseError) fail(label, '/sitemap.xml', 'sitemap-xml', 'XML parser error');
      const expectedUrls = new Set(eligible.map(({ route }) => site + route));
      const actualUrls = new Set(sitemap.entries.map(({ loc }) => loc));
      if (expectedUrls.size !== actualUrls.size || sitemap.entries.length !== actualUrls.size || [...expectedUrls].some((url) => !actualUrls.has(url))) fail(label, '/sitemap.xml', 'sitemap-coverage', 'Sitemap must include each indexable page exactly once');
      for (const entry of sitemap.entries) {
        checkReference(entry.loc, '/sitemap.xml', { tag: 'loc', attribute: 'text' });
        const contentPage = eligible.find(({ route }) => site + route === entry.loc);
        if (!contentPage) { fail(label, '/sitemap.xml', 'sitemap-origin', `Unexpected URL ${entry.loc}`); continue; }
        const expected = contentPage.document.hreflang;
        if (entry.alternates.length !== 3 || expected.some((item) => !entry.alternates.some((alternate) => alternate.lang === item.lang && alternate.href === item.href))) fail(label, entry.loc, 'sitemap-hreflang', 'Sitemap alternates differ from HTML');
      }
    }
  }
  const forbidden = [...fileSet].filter((file) => /(^|\/)(?:assets\/originals|\.venv[^/]*|docs|scripts|node_modules|\.env(?:\.[^/]*)?)(?:\/|$)/i.test(file) || /\.(?:onnx|safetensors|pth|pt|ckpt|docx)$/i.test(file) || (/\.md$/i.test(file) && !file.startsWith('licenses/')));
  if (forbidden.length) fail(label, null, 'private-artifacts', forbidden.join(', '));
  const layerNames = ['body', 'head', 'upper-arm', 'forearm', 'hand'];
  const requiredImages = ['images/share.png', 'images/avatar/front-960.webp', 'images/avatar/front-480.webp', 'images/avatar/avatar-128.webp', ...layerNames.map(name => `images/avatar/rig/${name}.webp`)];
  requiredImages.filter((file) => !fileSet.has(file)).forEach((file) => fail(label, null, 'image-missing', file));
  const rigPath = 'images/avatar/rig/rig.json';
  let avatarRig = null;
  if (!fileSet.has(rigPath)) fail(label, null, 'rig-missing', rigPath);
  else {
    try {
      const rig = JSON.parse(await readFile(join(directory, rigPath), 'utf8'));
      if (rig.type !== 'registered-2d-image-rig' || rig.width !== 720 || rig.height !== 960) fail(label, rigPath, 'rig-format', 'Expected the registered 720x960 image rig');
      if (rig.source !== '/images/avatar/front-960.webp') fail(label, rigPath, 'rig-source', 'Expected the supplied front derivative');
      const sourceFile = join(directory, 'images/avatar/front-960.webp');
      if (fileSet.has('images/avatar/front-960.webp') && checksum(await readFile(sourceFile)) !== rig.sourceSha256) fail(label, rigPath, 'rig-source-checksum', 'Source derivative differs from the rig manifest');
      if (Object.keys(rig.layers || {}).length !== layerNames.length) fail(label, rigPath, 'rig-layer-count', 'Expected five image layers');
      for (const name of layerNames) {
        const layer = rig.layers?.[name];
        const file = `images/avatar/rig/${name}.webp`;
        if (!layer || layer.src !== `/${file}` || layer.width !== rig.width || layer.height !== rig.height) fail(label, rigPath, 'rig-layer', `Invalid ${name} layer`);
        else if (fileSet.has(file)) {
          const bytes = await readFile(join(directory, file));
          if (bytes.length !== layer.bytes || checksum(bytes) !== layer.sha256) fail(label, file, 'rig-layer-checksum', 'Layer content differs from the rig manifest');
        }
      }
      avatarRig = { type: rig.type, width: rig.width, height: rig.height, source: rig.source, layers: Object.keys(rig.layers || {}) };
    } catch (error) { fail(label, rigPath, 'rig-manifest', error.message); }
  }
  let shareImage = null;
  if (fileSet.has('images/share.png')) {
    const bytes = await readFile(join(directory, 'images/share.png'));
    shareImage = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length, sha256: checksum(bytes) };
    if (shareImage.width !== 1200 || shareImage.height !== 630) fail(label, null, 'share-dimensions', 'Expected 1200x630 PNG');
  }
  return { directory: posix(relative(root, directory)), siteUrl: site, fingerprint, fileCount: files.length, htmlCount: documents.length,
    contentPageCount: eligible.length, pages: documents.map(({ references: _references, ids: _ids, ...document }) => ({ route: routeFor(document.file), ...document })),
    linkCounts, brokenLinks, robotsText, sitemapFiles, sitemap, forbiddenFiles: forbidden, shareImage, avatarRig,
    passed: !issues.some((issue) => issue.build === label) };
}

async function testDotenvConfig() {
  const directory = await mkdtemp(join(tmpdir(), 'mingyang-dotenv-audit-'));
  const envFile = join(directory, '.env');
  const previousCwd = process.cwd();
  const previousSite = process.env.SITE_URL;
  let loadedSite;
  try {
    await writeFile(envFile, `SITE_URL=${configuredSite}\n`, 'utf8');
    delete process.env.SITE_URL;
    process.chdir(directory);
    const config = await import(`${pathToFileURL(join(root, 'astro.config.mjs')).href}?dotenvAudit=${Date.now()}`);
    loadedSite = config.default.site;
  } finally {
    process.chdir(previousCwd);
    if (previousSite === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previousSite;
    await unlink(envFile);
    await rmdir(directory);
  }
  const passed = loadedSite === configuredSite && process.env.SITE_URL === previousSite;
  if (!passed) fail('dotenv', null, 'dotenv-config', 'Actual astro.config.mjs failed to load an isolated production .env');
  return { passed, method: 'Imported the actual Astro config with cwd set to an isolated temporary directory containing only a fixture .env.', loadedSite,
    rootEnvModified: false, temporaryFixtureRemoved: true, processEnvironmentRestored: process.env.SITE_URL === previousSite };
}

let priorReport = null;
try { priorReport = JSON.parse(await readFile(reportPath, 'utf8')); } catch { /* The first run establishes the baseline. */ }
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let defaultBuild;
let configuredBuild = null;
try {
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.abort());
  defaultBuild = await inspectArtifact(join(root, 'dist'), null, page, 'default');
  if (configuredDir) configuredBuild = await inspectArtifact(resolve(root, configuredDir), configuredSite, page, 'configured');
} finally { await browser.close(); }
const dotenv = await testDotenvConfig();
const baselineFingerprint = configuredDir ? priorReport?.baselineFingerprint || priorReport?.defaultBuild?.fingerprint : defaultBuild.fingerprint;
const defaultDistUnchanged = configuredDir ? baselineFingerprint === defaultBuild.fingerprint : null;
if (configuredDir && !defaultDistUnchanged) fail('isolation', null, 'dist-fingerprint', 'Default dist changed or the pre-fixture baseline was not recorded');
let preview;
try {
  const response = await fetch('http://127.0.0.1:4321/en/');
  const html = await response.text();
  const expected = await readFile(join(root, 'dist', 'en', 'index.html'), 'utf8');
  preview = { url: 'http://127.0.0.1:4321/en/', status: response.status, matchesDefaultDist: html === expected, remainsNoindex: /<meta name="robots" content="noindex, nofollow">/.test(html) };
  if (response.status !== 200 || !preview.matchesDefaultDist || !preview.remainsNoindex) fail('preview', '/en/', 'preview-isolation', 'Local preview differs from the expected default noindex build');
} catch (error) { preview = { error: error.message }; fail('preview', '/en/', 'preview-unavailable', error.message); }
const report = { generatedAt: new Date().toISOString(), scope: 'Static metadata, HTML/CSS local references, image targets, publication boundaries, isolated SITE_URL and dotenv config checks. Runtime interactions and real deployment are outside this audit.',
  externalWebsitesRequested: false, fixtureDomainIsNotUserDomain: true, baselineFingerprint, defaultDistUnchanged, defaultBuild, configuredBuild, dotenv, preview,
  issues, passed: issues.length === 0 };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ report: posix(relative(root, reportPath)), passed: report.passed, defaultHtml: defaultBuild.htmlCount,
  configuredHtml: configuredBuild?.htmlCount || null, defaultDistUnchanged, issues }, null, 2));
if (issues.length) process.exitCode = 1;
