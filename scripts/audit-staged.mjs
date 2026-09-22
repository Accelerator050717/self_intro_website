import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

// Inspect the exact Git index before the first public commit. Never print matching secret values.
const git = args => execFileSync('git', args, { maxBuffer: 24 * 1024 * 1024 });
const reportPath = 'docs/reports/public-content-audit.json';
const paths = git(['ls-files', '--cached', '-z']).toString('utf8').split('\0').filter(path => path && path !== reportPath);
const findings = [];
const manifest = [];
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['api-token', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['credential-url-or-private-network', /(?:https?|wss?):\/\/(?:[^\s/@:]+:[^\s/@]+@|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)/g],
  ['literal-secret-assignment', /(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*['"][A-Za-z0-9+/_=-]{16,}['"]/gi],
];
for (const path of paths) {
  if (/(^|\/)(?:node_modules|dist|\.astro|\.verification|\.venv-assets|test-results|playwright-report|originals)(\/|$)|^Codex_.*\.md$|\.(?:pem|key|p12|pfx|onnx|safetensors|docx|zip)$/i.test(path)
    || /(^|\/)\.env(?:\.|$)/.test(path) && path !== '.env.example') findings.push({ path, rule: 'private-or-unnecessary-file' });
  const bytes = git(['show', `:${path}`]);
  manifest.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  if (bytes.length > 5 * 1024 * 1024) findings.push({ path, rule: 'oversized-public-file' });
  if (/\.(?:md|json|ts|tsx|js|mjs|astro|css|py|ps1|svg|txt)$/.test(path) || path.startsWith('.')) {
    const text = bytes.toString('utf8');
    for (const [rule, pattern] of patterns) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) findings.push({ path, rule, line: text.slice(0, match.index).split('\n').length });
    }
  }
}
const report = {
  date: new Date().toISOString(), scope: 'Exact staged files before public commit, excluding this generated self-report; pattern scan plus separate manual source/file review. Not a guarantee that every possible secret format is detectable.',
  excludedSelfReport: reportPath,
  files: paths.length, totalBytes: manifest.reduce((sum, item) => sum + item.bytes, 0), findings,
  fileListSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
  exclusions: ['Raw reference PNGs and retired side/back derivatives', 'Private briefs and local snapshots', 'Real .env values and credentials', 'Dependencies, dist, caches, traces and machine-specific raw reports'],
  passed: findings.length === 0,
};
mkdirSync('docs/reports', { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (findings.length) process.exitCode = 1;
