import { describe, expect, it } from 'vitest';
import { mappingToA1Ranges } from '../src/utils/mappingRanges';

describe('mappingToA1Ranges', () => {
  it('keeps a single cell', () => {
    expect(mappingToA1Ranges('C7')).toEqual(['C7']);
  });

  it('expands a column row range', () => {
    expect(mappingToA1Ranges('A12-40')).toEqual(['A12:A40']);
  });

  it('expands every comma-separated block', () => {
    expect(mappingToA1Ranges('A38-51,K38-51')).toEqual(['A38:A51', 'K38:K51']);
  });

  it('expands column-layout ranges', () => {
    expect(mappingToA1Ranges('17@E-H,17@J')).toEqual(['E17:H17', 'J17']);
  });

  it('uses the column form when the binding key is a column mapping', () => {
    expect(mappingToA1Ranges('18@D-J', true)).toEqual(['D18:J18']);
    expect(mappingToA1Ranges('C7', true)).toBeNull();
  });

  it('returns an empty list for a blank address and null for a bad one', () => {
    expect(mappingToA1Ranges('  ')).toEqual([]);
    expect(mappingToA1Ranges('A40-12')).toBeNull();
    expect(mappingToA1Ranges('17@H-E')).toBeNull();
  });
});
