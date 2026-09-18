import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { computeNextVersion } from '../../scripts/versioning/next-version.mjs';

describe('computeNextVersion', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws when no previous manifest exists', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-manifest-'));
    expect(() => computeNextVersion({
      manifestPath: path.join(tmpDir, 'missing.json'),
      bumpEngine: path.join(tmpDir, 'bump_engine.py'),
    })).toThrow(/No previous manifest found/);
  });

  it('returns the bump-engine proposal for the previous manifest', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-manifest-'));
    const manifestPath = path.join(tmpDir, 'manifest.json');
    const bumpEngine = path.join(tmpDir, 'bump_engine.py');
    fs.writeFileSync(manifestPath, JSON.stringify({
      version: '1.0.0',
      sourceCommit: 'abc123',
      functions: [{ name: 'getReleases', signatureHash: 'sha256:aaa' }],
    }));
    // Stub bump_engine.py that always proposes a fixed minor bump, so this test
    // exercises the real subprocess plumbing without depending on Deploy/versioning.
    fs.writeFileSync(bumpEngine, [
      'import json, sys',
      'json.dump({"components": {"FE": {"status": "ok", "from": "1.0.0", "to": "1.1.0", "bump": "minor", "reasons": ["feat: x"]}}}, sys.stdout)',
    ].join('\n'));

    const result = computeNextVersion({ root: path.resolve('.'), manifestPath, bumpEngine });
    expect(result.to).toBe('1.1.0');
  });
});
