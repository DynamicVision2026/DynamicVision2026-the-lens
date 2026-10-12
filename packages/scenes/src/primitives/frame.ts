import type { Grid, Point } from '../types';

/** Maps lattice coordinates (y up) to SVG user units (y down). */
export interface Frame {
  cell: number;
  left: number;
  top: number;
  grid: Grid;
}

export function makeFrame(grid: Grid, x: number, y: number, width: number, height: number): Frame {
  const cell = Math.min(width / grid.width, height / grid.height);
  return {
    cell,
    left: x + (width - cell * grid.width) / 2,
    top: y + (height - cell * grid.height) / 2,
    grid,
  };
}

export function toSvg(f: Frame, p: Point): [number, number] {
  return [f.left + p[0] * f.cell, f.top + (f.grid.height - p[1]) * f.cell];
}

export function svgPoints(f: Frame, pts: Point[]): string {
  return pts.map((p) => toSvg(f, p).join(',')).join(' ');
}
