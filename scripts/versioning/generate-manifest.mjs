import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { scanServices } from './scan-fe-functions.mjs';
import { computeNextVersion } from './next-version.mjs';

const DEFAULT_VERSION = '1.0.0';

function validVersion(version) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version);
}

function sourceCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function generatedAt() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function buildManifest({ root = process.cwd(), version = DEFAULT_VERSION, commit, timestamp } = {}) {
  if (!validVersion(version)) throw new Error(`Invalid component version: ${version}`);
  const servicesDirectory = path.join(root, 'src/services');
  const result = scanServices(servicesDirectory);
  if (result.diagnostics.length > 0) throw new Error(`Scanner diagnostics present: ${JSON.stringify(result.diagnostics)}`);
  return {
    component: 'FE',
    version,
    dockerImageTag: `familiez-fe:${version}`,
    generatedAt: timestamp ?? generatedAt(),
    sourceCommit: commit ?? sourceCommit(),
    functions: result.functions,
  };
}

export function main(argv = process.argv.slice(2)) {
  const options = { root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--version') options.version = argv[++index];
    if (argv[index] === '--source-commit') options.commit = argv[++index];
    if (argv[index] === '--generated-at') options.timestamp = argv[++index];
    if (argv[index] === '--root') options.root = path.resolve(argv[++index]);
    if (argv[index] === '--output') options.output = path.resolve(argv[++index]);
  }
  const output = options.output ?? path.join(options.root, 'versioning/manifest.json');
  if (!options.version) {
    if (fs.existsSync(output)) {
      const proposal = computeNextVersion({ root: options.root, manifestPath: output });
      if (proposal.status !== 'ok') {
        console.error(`Bump engine requires manual review, refusing to auto-generate: ${JSON.stringify(proposal)}`);
        return proposal.status === 'manual_review' ? 3 : 2;
      }
      options.version = proposal.to;
      console.log(`Bump engine proposes ${proposal.from} -> ${proposal.to} (${proposal.bump}: ${(proposal.reasons ?? []).join(', ')})`);
    } else {
      options.version = DEFAULT_VERSION;
      console.log(`No previous manifest found; bootstrapping at ${DEFAULT_VERSION}`);
    }
  }
  const manifest = buildManifest(options);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main();