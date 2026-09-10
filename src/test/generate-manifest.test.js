import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildManifest } from '../../scripts/versioning/generate-manifest.mjs';

describe('buildManifest', () => {
  it('creates a deterministic component manifest with injected metadata', () => {
    const options = {
      root: path.resolve('.'),
      commit: 'abc123',
      timestamp: '2026-09-10T00:00:00Z',
    };
    const first = buildManifest(options);
    const second = buildManifest(options);
    expect(first).toEqual(second);
    expect(first.component).toBe('FE');
    expect(first.version).toBe('1.0.0');
    expect(first.dockerImageTag).toBe('familiez-fe:1.0.0');
    expect(first.functions.length).toBeGreaterThan(0);
  });

  it('rejects invalid component versions', () => {
    expect(() => buildManifest({ root: path.resolve('.'), version: '1.0' })).toThrow(/Invalid component version/);
  });
});