import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { parseLabRequestRule, readLabRequestRuleForExport } from '@hja/shared';

const SCHEMAS_DIR = path.join(process.cwd(), 'data', 'schemas');

const TABLE_PER_REQUEST = ['dry-unit-weights', 'percent-passing-200', 'moisture-contents'];

const DENSE_PER_REQUEST = [
  'ph-test',
  'unconfined-compression-rock',
  'unconfined-compression-rock-me',
  'unconfined-compression-soil',
  'triaxial-compression-soil-uu',
  'triaxial-compression-soil-cu',
  'triaxial-compression-soil-cd',
  'triaxial-compression-rock',
  'triaxial-compression-rock-me',
];

function loadSchema(name: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(SCHEMAS_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('per-request schema modes', () => {
  it('has no schemas still using per-boring', () => {
    const files = fs.readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf-8')) as Record<
        string,
        unknown
      >;
      const rule = parseLabRequestRule(schema);
      expect(rule?.mode, file).not.toBe('per-boring');
    }
  });

  it.each(TABLE_PER_REQUEST)('%s is per-request with default boring spacers', (name) => {
    const schema = loadSchema(name);
    expect(parseLabRequestRule(schema)?.mode).toBe('per-request');
    expect(readLabRequestRuleForExport(schema)?.packBoringSpacers).toBe(true);
  });

  it.each(DENSE_PER_REQUEST)('%s is per-request with packBoringSpacers false', (name) => {
    const schema = loadSchema(name);
    expect(parseLabRequestRule(schema)?.mode).toBe('per-request');
    expect(readLabRequestRuleForExport(schema)?.packBoringSpacers).toBe(false);
  });
});
