// WO-020 polish: vertex labels on the coordinate plane stay off the tick numbers and the axes.
import { allSceneCards, loadBundle, type Point } from '@lens/scenes';
import { describe, expect, it } from 'vitest';
import { coordLabel, labelAt, plane } from './coordkit';

const coordCards = allSceneCards(loadBundle()).filter((c) => ['coord_polygon', 'coord_equal_area', 'coord_mirror_area', 'coord_quad_tri'].includes(c.problem.figure.type));
const pointsOf = (f: Record<string, unknown>): Point[] => (f.points as Point[] | undefined) ?? (['A', 'B', 'C', 'D'].map((k) => f[k]).filter(Boolean) as Point[]);

describe('labelAt', () => {
  it.each(coordCards.map((c) => [c.id, c] as const))('%s: no label sits on the x-axis tick band, the y-axis tick column or past the edge', (_id, card) => {
    const pts = pointsOf(card.problem.figure as unknown as Record<string, unknown>);
    const P = plane(pts);
    const centre: Point = [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
    for (const q of pts) {
      const text = coordLabel('A', q);
      const at = labelAt(P, q, centre, text);
      expect(at.y > P.Y(0) - 6 && at.y < P.Y(0) + 30, `${card.id} ${text} y`).toBe(false);
      const w = text.length * 8;
      const [x0, x1] = at.anchor === 'start' ? [at.x, at.x + w] : [at.x - w, at.x];
      expect(x1 > P.X(0) - 28 && x0 < P.X(0) + 4, `${card.id} ${text} x`).toBe(false);
      // Inside the scene (WO-023 polish: 「A(−3, 0)」 was cut off at the left edge on a phone).
      expect(x0 >= 0 && x1 <= P.width, `${card.id} ${text} edge`).toBe(true);
    }
  });
});
