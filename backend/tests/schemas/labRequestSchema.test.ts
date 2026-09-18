import { describe, it, expect } from 'vitest';
import { parseLabRequestRule, readLabRequestRuleForExport } from '@hja/shared';

describe('parseLabRequestRule', () => {
  it('returns per-sample rule with map', () => {
    const schema = {
      labRequest: {
        mode: 'per-sample',
        map: { boring: 'boringNumber', sample: 'sampleNumber' },
      },
    };

    expect(parseLabRequestRule(schema)).toEqual({
      mode: 'per-sample',
      map: { boring: 'boringNumber', sample: 'sampleNumber' },
    });
  });

  it('returns per-request rule with map', () => {
    const schema = {
      labRequest: {
        mode: 'per-request',
        map: { boring: 'boringNumber', sample: 'sampleNumber', depth: 'depth' },
      },
    };

    expect(parseLabRequestRule(schema)).toEqual({
      mode: 'per-request',
      map: { boring: 'boringNumber', sample: 'sampleNumber', depth: 'depth' },
    });
  });

  it('returns null for invalid mode', () => {
    expect(parseLabRequestRule({ labRequest: { mode: 'other' } })).toBeNull();
    expect(parseLabRequestRule({})).toBeNull();
    expect(parseLabRequestRule(null)).toBeNull();
  });
});

describe('readLabRequestRuleForExport', () => {
  it('preserves unknown mode strings for filename fallback', () => {
    const schema = {
      labRequest: {
        mode: 'legacy-mode',
        map: { boring: 'boringNumber' },
      },
    };

    expect(readLabRequestRuleForExport(schema)).toEqual({
      mode: 'legacy-mode',
      map: { boring: 'boringNumber' },
      packBoringSpacers: true,
    });
  });

  it('defaults packBoringSpacers to true', () => {
    const schema = {
      labRequest: {
        mode: 'per-request',
        map: { boring: 'boringNumber' },
      },
    };

    expect(readLabRequestRuleForExport(schema)?.packBoringSpacers).toBe(true);
  });

  it('reads packBoringSpacers false from schema', () => {
    const schema = {
      labRequest: {
        mode: 'per-request',
        packBoringSpacers: false,
        map: { boring: 'boringNumber' },
      },
    };

    expect(readLabRequestRuleForExport(schema)).toEqual({
      mode: 'per-request',
      map: { boring: 'boringNumber' },
      packBoringSpacers: false,
    });
  });
});
