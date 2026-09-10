import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { scanServices } from './scan-fe-functions.mjs';

const COMPONENT = 'FE';
const DEFAULT_BUMP_ENGINE = path.resolve(process.cwd(), '..', 'Deploy', 'versioning', 'bump_engine.py');

function commitsSince(commit) {
  if (!commit) return [];
  try {
    const output = execFileSync('git', ['log', `${commit}..HEAD`, '--format=%B%x00'], { encoding: 'utf8' });
    return output.split('\x00').map((message) => message.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function computeNextVersion({ root = process.cwd(), manifestPath, bumpEngine = DEFAULT_BUMP_ENGINE } = {}) {
  const resolvedManifestPath = manifestPath ?? path.join(root, 'versioning/manifest.json');
  if (!fs.existsSync(resolvedManifestPath)) {
    throw new Error(`No previous manifest found at ${resolvedManifestPath}; bootstrap it manually first`);
  }
  const previousManifest = JSON.parse(fs.readFileSync(resolvedManifestPath, 'utf8'));
  if (!previousManifest.version) throw new Error(`No version found in ${resolvedManifestPath}`);
  if (!fs.existsSync(bumpEngine)) throw new Error(`bump_engine.py not found at ${bumpEngine}; pass --bump-engine explicitly`);

  const payload = {
    components: {
      [COMPONENT]: {
        version: previousManifest.version,
        previousFunctions: previousManifest.functions ?? [],
        currentFunctions: scanServices(path.join(root, 'src/services')).functions,
        commits: commitsSince(previousManifest.sourceCommit),
      },
    },
  };

  let stdout;
  try {
    stdout = execFileSync('python3', [bumpEngine], { input: JSON.stringify(payload), encoding: 'utf8' });
  } catch (error) {
    stdout = error.stdout ?? '';
  }
  let proposal;
  try {
    proposal = JSON.parse(stdout);
  } catch {
    throw new Error(`bump_engine did not return valid JSON: ${stdout}`);
  }
  return proposal.components[COMPONENT];
}

export function main(argv = process.argv.slice(2)) {
  const options = { root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--manifest') options.manifestPath = path.resolve(argv[++index]);
    if (argv[index] === '--bump-engine') options.bumpEngine = path.resolve(argv[++index]);
    if (argv[index] === '--root') options.root = path.resolve(argv[++index]);
  }
  const proposal = computeNextVersion(options);
  process.stdout.write(`${JSON.stringify(proposal, null, 2)}\n`);
  if (proposal.status === 'manual_review') return 3;
  if (proposal.status === 'invalid_input') return 2;
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main();
