// Drawing coordinates for the cuboid ABCD-EFGH (E above A, F above B, G above C), scaled to fit
// the viewport. Positions only: P's snap point is the card's answer (BP), never computed.
// The vertices come from the validator's figure.mesh when the card has one (bundle, #51).

export interface BoxDims {
  a: number;
  b: number;
  h: number;
}

export type V3 = [number, number, number];

/** Scale so the box fits the camera (the prototype's framing). */
export function fitScale({ a, b, h }: BoxDims): number {
  return 5.4 / Math.max(a + b * 0.7, h * 1.3);
}

export type VertexName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

/**
 * The eight vertices in model space (x along AB, y up, z back from the front face ABFE): the mesh's
 * coordinates scaled by k, or built from a, b, h for a card without a mesh.
 */
export function vertices({ a, b, h }: BoxDims, k: number, mesh?: Record<VertexName, V3>): Record<VertexName, V3> {
  if (mesh) return Object.fromEntries(Object.entries(mesh).map(([n, [x, y, z]]) => [n, [x * k, y * k, z * k]])) as Record<VertexName, V3>;
  const [A, B, H] = [a * k, b * k, h * k];
  return {
    A: [0, 0, 0],
    B: [A, 0, 0],
    C: [A, 0, -B],
    D: [0, 0, -B],
    E: [0, H, 0],
    F: [A, H, 0],
    G: [A, H, -B],
    H: [0, H, -B],
  };
}

/** Where a point on face BCGF (in the hinge's local frame, origin at B) lands after opening by phi. */
export function onHinge([x, y, z]: V3, phi: number): V3 {
  // Rotation about the y axis (the edge BF) by -phi.
  const c = Math.cos(-phi);
  const s = Math.sin(-phi);
  return [x * c + z * s, y, -x * s + z * c];
}

/** P is within the snap radius of the answer height on BF (a fraction of BF, as in the prototype). */
export function nearSnap(pY: number, answerY: number, h: number, radius = 0.07): boolean {
  return Math.abs(pY - answerY) < h * radius;
}

/** The face counts as opened once it has swung past 62% of a right angle. */
export function openEnough(phi: number): boolean {
  return phi > (Math.PI / 2) * 0.62;
}
