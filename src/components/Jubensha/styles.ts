export type ThemeName = string;
export type UISystem = ThemeName;

export type VisualStyle =
  | 'cyberpunk'
  | 'ancient-east'
  | 'magic-medieval'
  | 'wasteland'
  | 'horror-cthulhu'
  | 'modern-romance'
  | 'neutral';

export interface ThemeStyles {
  text: string;
  muted: string;
  accent: string;
  border: string;
  overlay: string;
  btn: string;
  btnGhost: string;
  btnDanger: string;
  tag: string;
  badge: string;
  divider: string;
  bg: string;
  card: string;
  cardHighlight: string;
  input: string;
  nav: string;
  navText: string;
  glassCard: string;
  glassNav: string;
  glassInput: string;
  glassBtn: string;
  glassBubbleUser: string;
  glassBubbleChar: string;
  glassBubbleSys: string;
}

export interface ThemeVars {
  '--bg': string;
  '--surface': string;
  '--text': string;
  '--muted': string;
  '--border': string;
  '--accent': string;
}

const STYLE_COLORS: Record<VisualStyle, ThemeVars> = {
  'cyberpunk':      { '--bg': '#050510', '--surface': '#12121e', '--text': '#e0f0ff', '--muted': '#6b7f99', '--border': '#1a2a44', '--accent': '#00ddff' },
  'ancient-east':   { '--bg': '#f4ecd8', '--surface': '#faf3e0', '--text': '#2c2826', '--muted': '#8a8178', '--border': '#d4c8b4', '--accent': '#8a1c1c' },
  'magic-medieval': { '--bg': '#110e0c', '--surface': '#1a1512', '--text': '#e5d6a8', '--muted': '#8b7d55', '--border': '#4a3820', '--accent': '#d4af37' },
  'wasteland':      { '--bg': '#1c1b18', '--surface': '#25221d', '--text': '#c4b8a2', '--muted': '#7a7060', '--border': '#443e33', '--accent': '#e07a3e' },
  'horror-cthulhu': { '--bg': '#070707', '--surface': '#141414', '--text': '#c0c0c0', '--muted': '#6b6b6b', '--border': '#2a2a2a', '--accent': '#cc3333' },
  'modern-romance': { '--bg': '#fcfaf8', '--surface': '#ffffff', '--text': '#3c3836', '--muted': '#9c9290', '--border': '#e0dbd8', '--accent': '#e87a7a' },
  'neutral':        { '--bg': '#09090b', '--surface': '#18181b', '--text': '#e4e4e7', '--muted': '#71717a', '--border': '#27272a', '--accent': '#6366f1' },
};

export function determineStyle(background: string, theme: string): VisualStyle {
  const text = background + ' ' + theme;

  if (text.includes('赛博朋克') || text.includes('星际') || text.includes('飞船') || text.includes('深海基地')) return 'cyberpunk';
  if (text.includes('古代东方') || text.includes('民国')) return 'ancient-east';
  if (text.includes('魔法') || text.includes('中世纪') || text.includes('西方') || text.includes('古希腊')) return 'magic-medieval';
  if (text.includes('废土') || text.includes('末日')) return 'wasteland';
  if (text.includes('诡异') || text.includes('怪谈') || text.includes('克苏鲁') || text.includes('悬疑')) return 'horror-cthulhu';
  if (text.includes('现代') || text.includes('都市') || text.includes('喜剧') || text.includes('爱情') || text.includes('欢乐') || text.includes('情感')) return 'modern-romance';

  return 'neutral';
}

export function getThemeName(background: string, theme: string): string {
  return determineStyle(background, theme);
}

export function getThemeVars(name: string): ThemeVars {
  return STYLE_COLORS[name as VisualStyle] || STYLE_COLORS['neutral'];
}

export function getThemeCSSVars(name: string): Record<string, string> {
  return getThemeVars(name) as unknown as Record<string, string>;
}

const s: ThemeStyles = {
  text: 'text-[var(--text)]',
  muted: 'text-[var(--muted)]',
  accent: 'text-[var(--accent)]',
  border: 'border-[var(--border)]',
  overlay: 'bg-black/30 backdrop-blur-sm',
  btn: 'bg-[var(--accent)] text-[var(--bg)] rounded-xl font-medium',
  btnGhost: 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-xl',
  btnDanger: 'bg-[var(--accent)] text-[var(--bg)] rounded-xl font-medium',
  tag: 'bg-[var(--border)] text-[var(--muted)] text-xs rounded-full px-3 py-1',
  badge: 'bg-[var(--accent)] text-[var(--bg)] text-xs rounded-full px-3 py-1',
  divider: 'bg-[var(--border)]',

  bg: 'bg-[var(--bg)]',
  card: 'bg-[var(--surface)] border border-[var(--border)] rounded-xl',
  cardHighlight: 'bg-[var(--surface)] rounded-lg px-4 py-3',
  input: 'bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--muted)]',
  nav: 'bg-[var(--surface)] border-b border-[var(--border)]',
  navText: 'text-[var(--text)]',

  glassCard: 'bg-[var(--surface)]/70 backdrop-blur-xl border border-[var(--border)]/60 rounded-xl',
  glassNav: 'bg-[var(--surface)]/70 backdrop-blur-xl border-b border-[var(--border)]/60',
  glassInput: 'bg-[var(--surface)]/80 backdrop-blur-xl border border-[var(--border)]/60 rounded-xl text-[var(--text)] placeholder:text-[var(--muted)]',
  glassBtn: 'bg-[var(--accent)]/12 backdrop-blur-xl border border-[var(--accent)]/25 text-[var(--text)] rounded-xl',
  glassBubbleUser: 'bg-[var(--accent)]/20 backdrop-blur-xl border border-[var(--accent)]/30 text-[var(--text)] rounded-2xl rounded-br-sm',
  glassBubbleChar: 'bg-[var(--accent)]/8 backdrop-blur-xl border border-[var(--accent)]/18 text-[var(--text)] rounded-2xl rounded-bl-sm',
  glassBubbleSys: 'text-[var(--muted)] italic text-center w-full',
};

export const themes: Record<string, ThemeStyles> = {};
for (const key of Object.keys(STYLE_COLORS)) {
  themes[key] = s;
}
export const uiStyles = themes;
export const getUISystem = getThemeName;
