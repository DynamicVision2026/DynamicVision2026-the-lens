import { describe, expect, it } from 'vitest';
import { nearSnap, onHinge, openEnough, vertices } from './geometry';

describe('box geometry (drawing only)', () => {
  const v = vertices({ a: 6, b: 4, h: 5 }, 1);

  it('places the front face ABFE at z = 0 and C behind B', () => {
    expect(v.A).toEqual([0, 0, 0]);
    expect(v.F).toEqual([6, 5, 0]);
    expect(v.C).toEqual([6, 0, -4]);
  });

  it('opening face BCGF by 90° lays C flat beside AB (the net)', () => {
    // C in the hinge frame is (0, 0, -b); fully open it lies b to the right of B.
    const [x, y, z] = onHinge([0, 0, -4], Math.PI / 2);
    expect(x).toBeCloseTo(4);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(0);
  });

  it('snaps only near the answer height and opens past 62%', () => {
    expect(nearSnap(3.2, 3, 5)).toBe(true);
    expect(nearSnap(2.5, 3, 5)).toBe(false);
    expect(openEnough(Math.PI / 2)).toBe(true);
    expect(openEnough(0.5)).toBe(false);
  });
});
