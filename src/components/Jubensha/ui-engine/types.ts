import type { RefObject } from 'react';

// ─── Layout Archetypes ───
export type LayoutType =
  | 'scroll'    // 卷轴/文书式 — 纵向阅读流, 无卡片边界
  | 'hud'       // HUD面板式 — 模块化网格, 高密度数据
  | 'broken'    // 破损式 — 不对称, 错位, 撕裂感
  | 'ritual'    // 仪式式 — 中心放射, 浮动卡片, 光晕
  | 'minimal'   // 极简档案式 — 高对比, 强逻辑结构
  | 'playful';  // 轻快式 — 高间距, 圆润, 卡通感

// ─── Style Tokens ───
export interface UIStyleTokens {
  // Layout
  layoutMode: 'flow' | 'grid' | 'asymmetric' | 'radial' | 'compact' | 'spacious';
  cardShape: 'none' | 'panel' | 'float' | 'fragment' | 'sharp' | 'rounded';
  borderStyle: 'solid' | 'double' | 'dashed' | 'glow' | 'torn' | 'none';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';

  // Typography
  fontFamily: string;
  headingFont: string;
  scale: 'compact' | 'normal' | 'spacious';

  // Motion
  motion: 'none' | 'subtle' | 'normal' | 'dramatic' | 'glitch' | 'float';

  // Density
  density: 'compact' | 'normal' | 'spacious';
  spacing: 1 | 2 | 3 | 4;

  // Color mood
  mood: 'warm' | 'cool' | 'dark' | 'light' | 'neon' | 'sepia' | 'mono';
}

// ─── Complete UI Preset ───
export interface UIPreset {
  id: string;
  name: string;
  layout: LayoutType;
  tokens: UIStyleTokens;
  description: string;
}

// ─── Background & Theme ───
export type BackgroundSetting =
  | '古代西方' | '古代东方' | '近现代' | '现代都市'
  | '西方中世纪' | '古希腊' | '赛博朋克' | '废土末日'
  | '魔法学院' | '星际飞船' | '诡异山村' | '民国时期'
  | '深海基地';

export type ThemeSetting =
  | '悬疑' | '悲剧' | '喜剧' | '爱情' | '硬核推理'
  | '本格密室' | '欢乐机制' | '阵营背叛' | '情感沉浸'
  | '克苏鲁神话' | '怪谈传说';

// ─── Layout Props (what every layout receives) ───
export interface LayoutProps {
  preset: UIPreset;
  config: { background: string; theme: string };

  // Game state
  caseData: any;
  messages: { role: 'system' | 'user' | 'character'; name?: string; text: string }[];
  visibleClues: any[];
  locations: string[];
  selectedLocation: string;
  accusedCharacterId: string | null;
  phase: string;
  isAiTyping: boolean;
  showControls: boolean;
  script: string;
  showScriptModal: boolean;

  // Characters
  characters: Record<string, any>;
  selectedCharIds: string[];
  userRole: any;

  // Actions
  onBack: () => void;
  onSend: (text: string) => void;
  onInterrogate: (charId: string) => void;
  onInvestigate: () => void;
  onAdvancePhase: () => void;
  onAccuse: () => void;
  onSetAccused: (id: string | null) => void;
  onSetInterrogateTarget: (id: string | null) => void;
  onSetLocation: (location: string) => void;
  onToggleControls: () => void;
  onToggleScript: () => void;
  onSetInput: (text: string) => void;
  input: string;
  interrogateTarget: string | null;
  messagesEndRef?: RefObject<HTMLDivElement | null>;
}
