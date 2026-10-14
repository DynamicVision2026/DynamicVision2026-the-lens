import { createElement, type ComponentType } from 'react';
import { AreaScene } from './Area';
import { BalanceScene } from './Balance';
import { ConstantScene } from './Constant';
import { EncloseScene } from './Enclose';
import { FreezeScene } from './Freeze';
import { MirrorScene } from './Mirror';
import { SlideScene } from './Slide';
import { UnfoldScene } from './Unfold';
import { LineMirrorScene, ParabolaAreaScene, ParabolaTriScene, ParamFamilyScene } from './HsGraphScenes';
import { CeviansScene, ConeScene, DiceScene, SumScene } from './HsShapeScenes';
import type { SceneProps } from './kit';

/** WO-023: the Stage 3 figures play their own drag scene, whichever lens they belong to. */
const BY_FIGURE: Record<string, ComponentType<SceneProps>> = {
  parabola_area: ParabolaAreaScene,
  parabola_tri: ParabolaTriScene,
  line_mirror: LineMirrorScene,
  param_family: ParamFamilyScene,
  cone_unfold: ConeScene,
  dice_grid: DiceScene,
  const_sum: SumScene,
  triangle_cevians: CeviansScene,
};

/** The hands-on interaction for each lens (Stage 1 and 2 figures). */
const BY_LENS: Record<string, ComponentType<SceneProps>> = {
  enclose: EncloseScene,
  slide: SlideScene,
  mirror: MirrorScene,
  area: AreaScene,
  constant: ConstantScene,
  balance: BalanceScene,
  freeze: FreezeScene,
  unfold: UnfoldScene,
};

/** The hands-on interaction for each lens: the figure's own scene when it has one, else the lens's. */
export const SCENES: Record<string, ComponentType<SceneProps>> = Object.fromEntries(
  Object.entries(BY_LENS).map(([lens, Lens]) => {
    const Scene = (props: SceneProps) => createElement(BY_FIGURE[props.card.problem.figure.type] ?? Lens, props);
    Scene.displayName = `${lens}Scene`;
    return [lens, Scene];
  }),
);
