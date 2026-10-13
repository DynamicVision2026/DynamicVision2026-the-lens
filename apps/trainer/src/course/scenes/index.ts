import type { ComponentType } from 'react';
import { AreaScene } from './Area';
import { BalanceScene } from './Balance';
import { ConstantScene } from './Constant';
import { EncloseScene } from './Enclose';
import { FreezeScene } from './Freeze';
import { MirrorScene } from './Mirror';
import { SlideScene } from './Slide';
import { UnfoldScene } from './Unfold';
import type { SceneProps } from './kit';

/** The hands-on interaction for each lens. */
export const SCENES: Record<string, ComponentType<SceneProps>> = {
  enclose: EncloseScene,
  slide: SlideScene,
  mirror: MirrorScene,
  area: AreaScene,
  constant: ConstantScene,
  balance: BalanceScene,
  freeze: FreezeScene,
  unfold: UnfoldScene,
};
