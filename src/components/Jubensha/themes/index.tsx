import type { ComponentType } from 'react';
import type { VisualStyle } from '../styles';
import type { ThemeProps } from './types';
import CyberpunkTheme from './CyberpunkTheme';
import AncientEastTheme from './AncientEastTheme';
import MagicMedievalTheme from './MagicMedievalTheme';
import WastelandTheme from './WastelandTheme';
import HorrorCthulhuTheme from './HorrorCthulhuTheme';
import ModernRomanceTheme from './ModernRomanceTheme';
import NeutralTheme from './NeutralTheme';

const THEME_MAP: Record<VisualStyle, ComponentType<ThemeProps>> = {
  cyberpunk: CyberpunkTheme,
  'ancient-east': AncientEastTheme,
  'magic-medieval': MagicMedievalTheme,
  wasteland: WastelandTheme,
  'horror-cthulhu': HorrorCthulhuTheme,
  'modern-romance': ModernRomanceTheme,
  neutral: NeutralTheme,
};

export default function ThemeIntro({ style, ...props }: ThemeProps & { style: VisualStyle }) {
  const Component = THEME_MAP[style] || NeutralTheme;
  return <Component {...props} />;
}
