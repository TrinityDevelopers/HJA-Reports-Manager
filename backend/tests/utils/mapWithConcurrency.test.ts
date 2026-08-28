import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../../src/utils/mapWithConcurrency';

describe('mapWithConcurrency', () => {
  it('returns an empty array for no items', async () => {
    await expect(mapWithConcurrency([], 3, async () => 1)).resolves.toEqual([]);
  });

  it('preserves result order', async () => {
    const items = [0, 1, 2, 3, 4];
    const results = await mapWithConcurrency(items, 2, async (value) => value * 2);
    expect(results).toEqual([0, 2, 4, 6, 8]);
  });

  it('limits concurrent work', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return true;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
