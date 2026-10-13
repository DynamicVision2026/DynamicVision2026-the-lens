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

  it('uses the mesh vertices when the card has them (scaled)', () => {
    const mesh = { A: [0, 0, 0], B: [6, 0, 0], C: [6, 0, -4], D: [0, 0, -4], E: [0, 5, 0], F: [6, 5, 0], G: [6, 5, -4], H: [0, 5, -4] } as const;
    const m = vertices({ a: 6, b: 4, h: 5 }, 2, mesh as unknown as Parameters<typeof vertices>[2]);
    expect(m.G).toEqual([12, 10, -8]);
    expect(m).toEqual(vertices({ a: 6, b: 4, h: 5 }, 2));
  });

  it('snaps only near the answer height and opens past 62%', () => {
    expect(nearSnap(3.2, 3, 5)).toBe(true);
    expect(nearSnap(2.5, 3, 5)).toBe(false);
    expect(openEnough(Math.PI / 2)).toBe(true);
    expect(openEnough(0.5)).toBe(false);
  });
});
