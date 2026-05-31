import type { ComponentType } from 'react';
import type { LayoutType, LayoutProps } from '../types';
import ScrollLayout from './ScrollLayout';
import HUDLayout from './HUDLayout';
import BrokenLayout from './BrokenLayout';
import RitualLayout from './RitualLayout';
import MinimalLayout from './MinimalLayout';
import PlayfulLayout from './PlayfulLayout';

export const LAYOUT_MAP: Record<LayoutType, ComponentType<LayoutProps>> = {
  scroll: ScrollLayout,
  hud: HUDLayout,
  broken: BrokenLayout,
  ritual: RitualLayout,
  minimal: MinimalLayout,
  playful: PlayfulLayout,
};
