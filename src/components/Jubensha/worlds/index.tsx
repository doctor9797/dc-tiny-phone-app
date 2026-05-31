import type { ComponentType } from 'react';
import type { WorldType } from './types';
import type { WorldDetailProps } from './types';

import WorldSelector from './WorldSelector';
import AncientScrollWorld from './AncientScrollWorld';
import CyberHUDWorld from './CyberHUDWorld';
import BrokenWorld from './BrokenWorld';
import RitualWorld from './RitualWorld';

export { WorldSelector };
export type { WorldType, WorldDetailProps };

export const WORLD_DETAILS: Record<WorldType, ComponentType<WorldDetailProps>> = {
  'ancient-scroll': AncientScrollWorld,
  'cyber-hud': CyberHUDWorld,
  'broken': BrokenWorld,
  'ritual': RitualWorld,
};
