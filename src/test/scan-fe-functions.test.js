import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanServices } from '../../scripts/versioning/scan-fe-functions.mjs';

const temporaryDirectories = [];

function fixtureDirectory(files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'familiez-fe-scan-'));
  temporaryDirectories.push(directory);
  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(directory, file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('scanServices', () => {
  it('scans named function, async function, arrow and indirect exports', () => {
    const directory = fixtureDirectory({
      'services.js': `
        export function getPerson(id) { return id; }
        export async function savePerson(person = {}) { return person; }
        const search = (...terms) => terms;
        export { search as searchPeople };
      `,
    });

    const result = scanServices(directory);

    expect(result.diagnostics).toEqual([]);
    expect(result.functions.map((item) => item.name)).toEqual(['getPerson', 'savePerson', 'searchPeople']);
    expect(result.functions[1].type).toBe('async-function');
    expect(result.functions[2].parameters).toEqual(['...terms']);
    expect(result.functions[0].signatureHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('preserves default and destructured parameter signatures and ignores non-js files', () => {
    const directory = fixtureDirectory({
      'nested/services.js': 'export const update = async ({ id }, options = {}) => ({ id, options });',
      'ignored.jsx': 'export const ignored = () => null;',
      'outside.txt': 'export const ignored = () => null;',
    });

    const result = scanServices(directory);

    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].parameters).toEqual(['{ id }', 'options = {}']);
  });

  it('reports parse errors with location and continues scanning', () => {
    const directory = fixtureDirectory({
      'broken.js': 'export const broken = ( => 1;',
      'valid.js': 'export const ping = () => ({ ok: true });',
    });

    const result = scanServices(directory);

    expect(result.functions.map((item) => item.name)).toEqual(['ping']);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ file: 'broken.js', error: 'SyntaxError' });
    expect(result.diagnostics[0].line).toBe(1);
  });

  it('scans the real services directory deterministically', () => {
    const first = scanServices(path.resolve('src/services'));
    const second = scanServices(path.resolve('src/services'));

    expect(first).toEqual(second);
    expect(first.diagnostics).toEqual([]);
    expect(first.functions.length).toBeGreaterThan(0);
  });
});