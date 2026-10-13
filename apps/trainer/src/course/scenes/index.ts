import type { ComponentType } from 'react';
import { EncloseScene } from './Enclose';
import { MirrorScene } from './Mirror';
import { SlideScene } from './Slide';
import type { SceneProps } from './kit';

/** The hands-on interaction for each lens (others arrive in later WO-012 PRs). */
export const SCENES: Record<string, ComponentType<SceneProps>> = {
  enclose: EncloseScene,
  slide: SlideScene,
  mirror: MirrorScene,
};
