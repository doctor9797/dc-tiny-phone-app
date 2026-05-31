import type { BackgroundSetting, ThemeSetting, LayoutType, UIPreset, UIStyleTokens } from './types';

// ─── Background category groupings ───
function bgCategory(bg: string): string {
  if (['古代西方', '古代东方', '民国时期', '古希腊', '西方中世纪'].includes(bg)) return 'historical';
  if (['现代都市', '近现代'].includes(bg)) return 'modern';
  if (['赛博朋克', '星际飞船', '深海基地'].includes(bg)) return 'scifi';
  if (['废土末日', '诡异山村'].includes(bg)) return 'wasteland';
  if (['魔法学院'].includes(bg)) return 'fantasy';
  return 'modern';
}

// ─── Theme category groupings ───
function themeCategory(theme: string): string {
  if (['悬疑', '本格密室', '硬核推理'].includes(theme)) return 'mystery';
  if (['克苏鲁神话', '怪谈传说'].includes(theme)) return 'horror';
  if (['喜剧', '欢乐机制', '爱情'].includes(theme)) return 'light';
  if (['悲剧', '情感沉浸', '阵营背叛'].includes(theme)) return 'drama';
  return 'mystery';
}

// ─── 2D Layout Matrix: background category × theme category ───
// Each cell determines the layout that feels most natural for that combination.
const LAYOUT_MATRIX: Record<string, Record<string, LayoutType>> = {
  historical: { mystery: 'scroll', horror: 'broken', light: 'playful', drama: 'scroll' },
  modern:    { mystery: 'minimal', horror: 'broken', light: 'playful', drama: 'minimal' },
  scifi:     { mystery: 'hud',    horror: 'broken', light: 'hud',     drama: 'hud' },
  wasteland: { mystery: 'broken', horror: 'broken', light: 'playful', drama: 'broken' },
  fantasy:   { mystery: 'ritual', horror: 'broken', light: 'playful', drama: 'ritual' },
};

// ─── Theme → Mood Modifiers ───
const THEME_MOOD: Partial<Record<ThemeSetting, Partial<UIStyleTokens>>> = {
  '喜剧': { mood: 'light', spacing: 4, density: 'spacious' },
  '欢乐机制': { mood: 'light', spacing: 4, density: 'spacious' },
  '悲剧': { mood: 'dark', motion: 'dramatic' },
  '爱情': { mood: 'warm', motion: 'float' },
  '情感沉浸': { mood: 'warm', motion: 'subtle' },
  '悬疑': { mood: 'mono', density: 'compact', spacing: 2 },
  '硬核推理': { mood: 'mono', density: 'compact', spacing: 1 },
  '本格密室': { mood: 'dark', density: 'compact', spacing: 1 },
  '克苏鲁神话': { mood: 'dark', motion: 'glitch' },
  '怪谈传说': { mood: 'dark', motion: 'glitch' },
  '阵营背叛': { mood: 'cool', motion: 'dramatic' },
};

const LAYOUT_TOKENS: Record<LayoutType, UIStyleTokens> = {
  scroll: {
    layoutMode: 'flow',
    cardShape: 'none',
    borderStyle: 'double',
    borderRadius: 'none',
    fontFamily: 'serif',
    headingFont: 'serif',
    scale: 'normal',
    motion: 'subtle',
    density: 'normal',
    spacing: 3,
    mood: 'sepia',
  },
  hud: {
    layoutMode: 'grid',
    cardShape: 'panel',
    borderStyle: 'solid',
    borderRadius: 'sm',
    fontFamily: 'mono',
    headingFont: 'mono',
    scale: 'compact',
    motion: 'normal',
    density: 'compact',
    spacing: 2,
    mood: 'neon',
  },
  broken: {
    layoutMode: 'asymmetric',
    cardShape: 'fragment',
    borderStyle: 'torn',
    borderRadius: 'none',
    fontFamily: 'sans',
    headingFont: 'sans',
    scale: 'compact',
    motion: 'glitch',
    density: 'compact',
    spacing: 2,
    mood: 'dark',
  },
  ritual: {
    layoutMode: 'radial',
    cardShape: 'float',
    borderStyle: 'glow',
    borderRadius: 'lg',
    fontFamily: 'serif',
    headingFont: 'serif',
    scale: 'spacious',
    motion: 'float',
    density: 'normal',
    spacing: 3,
    mood: 'warm',
  },
  minimal: {
    layoutMode: 'compact',
    cardShape: 'sharp',
    borderStyle: 'solid',
    borderRadius: 'none',
    fontFamily: 'sans',
    headingFont: 'sans',
    scale: 'compact',
    motion: 'none',
    density: 'compact',
    spacing: 1,
    mood: 'mono',
  },
  playful: {
    layoutMode: 'spacious',
    cardShape: 'rounded',
    borderStyle: 'dashed',
    borderRadius: 'full',
    fontFamily: 'sans',
    headingFont: 'sans',
    scale: 'spacious',
    motion: 'float',
    density: 'spacious',
    spacing: 4,
    mood: 'light',
  },
};

// ─── Resolve a background + theme to a full UIPreset ───
export function resolvePreset(bg: string, theme: string): UIPreset {
  const b = bg as BackgroundSetting;
  const t = theme as ThemeSetting;

  // 1. Determine base layout from the 2D matrix
  const bgCat = bgCategory(bg);
  const themeCat = themeCategory(theme);
  const baseLayout = LAYOUT_MATRIX[bgCat]?.[themeCat] ?? LAYOUT_MATRIX['modern']?.[themeCat] ?? 'minimal';
  const baseTokens = { ...LAYOUT_TOKENS[baseLayout] };

  // 2. Apply theme mood modifiers on top
  const moodMod = THEME_MOOD[t];
  if (moodMod) {
    Object.assign(baseTokens, moodMod);
  }

  // 3. Generate a readable ID
  const id = `${b}-${t}`.replace(/\s+/g, '-');

  // 4. Friendly name
  const layoutNames: Record<LayoutType, string> = {
    scroll: '卷轴式',
    hud: 'HUD面板式',
    broken: '破损式',
    ritual: '仪式式',
    minimal: '极简档案式',
    playful: '轻快式',
  };

  return {
    id,
    name: `${b} · ${t}`,
    layout: baseLayout,
    tokens: baseTokens,
    description: `${b} + ${t} → ${layoutNames[baseLayout]}UI`,
  };
}

// ─── Available backgrounds and themes ───
export const BACKGROUNDS = [
  '古代西方', '古代东方', '近现代', '现代都市',
  '西方中世纪', '古希腊', '赛博朋克', '废土末日',
  '魔法学院', '星际飞船', '诡异山村', '民国时期',
  '深海基地',
] as const;

export const THEMES = [
  '悬疑', '悲剧', '喜剧', '爱情', '硬核推理',
  '本格密室', '欢乐机制', '阵营背叛', '情感沉浸',
  '克苏鲁神话', '怪谈传说',
] as const;
