import { Config } from '@remotion/cli/config';
import { assertBundle } from '../../scripts/check-bundle.mjs';

assertBundle();

Config.setVideoImageFormat('jpeg');
