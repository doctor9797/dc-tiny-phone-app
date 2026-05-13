/**
 * Layer 1: Closed-set Chinese Emotion Dictionary
 *
 * Built on Russell's Circumplex Model of Affect (Valence × Arousal).
 * Each word has a precise V/A coordinate from academic sources:
 *   - CVAW (Chinese EmoBank, Lee & Yu ACM TALLIP 2022)
 *   - NRC-VAD (Mohammad 2018)
 *   - Preset: scene-specific words not covered by general lexicons
 *
 * Core rule: LLM must pick words FROM this dictionary, never invent new ones.
 * This prevents synonym explosion and coordinate clustering.
 */

export interface EmotionWord {
  word: string;
  v: number;  // valence  -1 (negative) ~ +1 (positive)
  a: number;  // arousal   0 (calm)     ~  1 (intense)
  source: 'cvaw' | 'nrc-vad' | 'preset';
}

// ── Dictionary ──

const DICTIONARY: EmotionWord[] = [
  // ─── High-arousal positive ───
  { word: '狂喜',     v: 0.90, a: 0.95, source: 'preset' },
  { word: '兴奋',     v: 0.70, a: 0.90, source: 'cvaw' },
  { word: '激动',     v: 0.60, a: 0.85, source: 'cvaw' },
  { word: '惊喜',     v: 0.65, a: 0.85, source: 'preset' },
  { word: '震撼',     v: 0.20, a: 0.90, source: 'preset' },
  { word: '狂欢',     v: 0.75, a: 0.90, source: 'preset' },
  { word: '热烈',     v: 0.60, a: 0.80, source: 'preset' },

  // ─── Mid-arousal positive ───
  { word: '开心',     v: 0.80, a: 0.60, source: 'cvaw' },
  { word: '快乐',     v: 0.85, a: 0.55, source: 'cvaw' },
  { word: '幸福',     v: 0.90, a: 0.50, source: 'cvaw' },
  { word: '甜蜜',     v: 0.75, a: 0.50, source: 'cvaw' },
  { word: '心动',     v: 0.55, a: 0.70, source: 'preset' },
  { word: '喜欢',     v: 0.70, a: 0.60, source: 'cvaw' },
  { word: '爱',       v: 0.80, a: 0.70, source: 'preset' },
  { word: '深情',     v: 0.60, a: 0.50, source: 'preset' },
  { word: '浪漫',     v: 0.60, a: 0.60, source: 'preset' },
  { word: '感动',     v: 0.70, a: 0.60, source: 'cvaw' },
  { word: '感激',     v: 0.60, a: 0.50, source: 'preset' },
  { word: '自豪',     v: 0.60, a: 0.60, source: 'cvaw' },
  { word: '得意',     v: 0.30, a: 0.60, source: 'cvaw' },
  { word: '期待',     v: 0.40, a: 0.70, source: 'preset' },
  { word: '向往',     v: 0.50, a: 0.60, source: 'preset' },
  { word: '崇拜',     v: 0.50, a: 0.70, source: 'preset' },
  { word: '敬佩',     v: 0.50, a: 0.50, source: 'preset' },
  { word: '好奇',     v: 0.30, a: 0.60, source: 'cvaw' },
  { word: '兴趣',     v: 0.40, a: 0.55, source: 'preset' },

  // ─── Low-arousal positive ───
  { word: '满足',     v: 0.60, a: 0.30, source: 'cvaw' },
  { word: '安心',     v: 0.50, a: 0.20, source: 'cvaw' },
  { word: '温暖',     v: 0.70, a: 0.30, source: 'preset' },
  { word: '放松',     v: 0.40, a: 0.20, source: 'cvaw' },
  { word: '舒畅',     v: 0.60, a: 0.25, source: 'preset' },
  { word: '愉悦',     v: 0.65, a: 0.30, source: 'cvaw' },
  { word: '欣慰',     v: 0.50, a: 0.30, source: 'preset' },
  { word: '释然',     v: 0.40, a: 0.20, source: 'preset' },
  { word: '平静',     v: 0.00, a: 0.10, source: 'cvaw' },
  { word: '温柔',     v: 0.50, a: 0.20, source: 'preset' },
  { word: '宠溺',     v: 0.55, a: 0.30, source: 'preset' },
  { word: '怜爱',     v: 0.50, a: 0.40, source: 'preset' },
  { word: '悠闲',     v: 0.40, a: 0.15, source: 'preset' },
  { word: '惬意',     v: 0.55, a: 0.20, source: 'preset' },
  { word: '安宁',     v: 0.30, a: 0.10, source: 'preset' },
  { word: '和谐',     v: 0.50, a: 0.15, source: 'preset' },
  { word: '温馨',     v: 0.60, a: 0.25, source: 'preset' },
  { word: '愉快',     v: 0.65, a: 0.35, source: 'preset' },
  { word: '自由',     v: 0.50, a: 0.50, source: 'preset' },
  { word: '畅快',     v: 0.60, a: 0.50, source: 'preset' },
  { word: '欢乐',     v: 0.75, a: 0.55, source: 'preset' },
  { word: '慵懒',     v: 0.30, a: 0.10, source: 'preset' },
  { word: '有耐心',   v: 0.30, a: 0.15, source: 'preset' },

  // ─── Neutral / mixed ───
  { word: '淡然',     v: 0.10, a: 0.10, source: 'preset' },
  { word: '理智',     v: 0.20, a: 0.15, source: 'preset' },
  { word: '冷静',     v: 0.10, a: 0.15, source: 'preset' },
  { word: '专注',     v: 0.20, a: 0.30, source: 'preset' },
  { word: '严肃',     v: -0.20, a: 0.40, source: 'preset' },
  { word: '凝重',     v: -0.30, a: 0.45, source: 'preset' },
  { word: '惊讶',     v: 0.10, a: 0.80, source: 'cvaw' },
  { word: '思念',     v: -0.10, a: 0.50, source: 'preset' },
  { word: '想念',     v: -0.10, a: 0.55, source: 'preset' },
  { word: '牵挂',     v: -0.20, a: 0.50, source: 'preset' },
  { word: '害羞',     v: 0.10, a: 0.55, source: 'cvaw' },
  { word: '撒娇',     v: 0.40, a: 0.50, source: 'preset' },
  { word: '调皮',     v: 0.50, a: 0.60, source: 'preset' },
  { word: '羡慕',     v: 0.10, a: 0.50, source: 'cvaw' },
  { word: '怀旧',     v: 0.20, a: 0.30, source: 'preset' },
  { word: '感叹',     v: 0.10, a: 0.35, source: 'preset' },
  { word: '无奈',     v: -0.30, a: 0.30, source: 'preset' },
  { word: '别扭',     v: -0.40, a: 0.45, source: 'preset' },
  { word: '不服气',   v: -0.20, a: 0.60, source: 'preset' },
  { word: '警觉',     v: -0.10, a: 0.70, source: 'preset' },

  // ─── Low-arousal negative ───
  { word: '无聊',     v: -0.30, a: 0.15, source: 'cvaw' },
  { word: '疲惫',     v: -0.40, a: 0.20, source: 'preset' },
  { word: '厌倦',     v: -0.50, a: 0.20, source: 'cvaw' },
  { word: '厌烦',     v: -0.55, a: 0.30, source: 'preset' },
  { word: '失落',     v: -0.60, a: 0.30, source: 'cvaw' },
  { word: '孤独',     v: -0.60, a: 0.20, source: 'cvaw' },
  { word: '寂寞',     v: -0.55, a: 0.25, source: 'cvaw' },
  { word: '沮丧',     v: -0.65, a: 0.35, source: 'cvaw' },
  { word: '失望',     v: -0.60, a: 0.40, source: 'cvaw' },
  { word: '消沉',     v: -0.60, a: 0.25, source: 'preset' },
  { word: '冷漠',     v: -0.30, a: 0.10, source: 'preset' },
  { word: '疏远',     v: -0.40, a: 0.20, source: 'preset' },
  { word: '压抑',     v: -0.50, a: 0.35, source: 'preset' },
  { word: '无助',     v: -0.70, a: 0.40, source: 'preset' },
  { word: '迷茫',     v: -0.40, a: 0.30, source: 'preset' },
  { word: '困惑',     v: -0.20, a: 0.40, source: 'preset' },
  { word: '疑惑',     v: -0.10, a: 0.50, source: 'preset' },

  // ─── Mid-arousal negative ───
  { word: '悲伤',     v: -0.80, a: 0.45, source: 'cvaw' },
  { word: '伤心',     v: -0.75, a: 0.55, source: 'cvaw' },
  { word: '委屈',     v: -0.50, a: 0.60, source: 'cvaw' },
  { word: '心疼',     v: -0.40, a: 0.60, source: 'preset' },
  { word: '怜惜',     v: -0.20, a: 0.40, source: 'preset' },
  { word: '愧疚',     v: -0.50, a: 0.50, source: 'preset' },
  { word: '后悔',     v: -0.60, a: 0.50, source: 'preset' },
  { word: '尴尬',     v: -0.30, a: 0.60, source: 'cvaw' },
  { word: '窘迫',     v: -0.35, a: 0.65, source: 'preset' },
  { word: '紧张',     v: -0.30, a: 0.80, source: 'cvaw' },
  { word: '不安',     v: -0.40, a: 0.65, source: 'cvaw' },
  { word: '担心',     v: -0.35, a: 0.70, source: 'cvaw' },
  { word: '焦虑',     v: -0.50, a: 0.85, source: 'cvaw' },
  { word: '崩溃',     v: -0.80, a: 0.90, source: 'preset' },
  { word: '吃醋',     v: -0.40, a: 0.70, source: 'preset' },
  { word: '嫉妒',     v: -0.50, a: 0.75, source: 'cvaw' },
  { word: '占有欲',   v: -0.30, a: 0.75, source: 'preset' },
  { word: '烦躁',     v: -0.50, a: 0.75, source: 'cvaw' },
  { word: '不耐烦',   v: -0.40, a: 0.70, source: 'preset' },
  { word: '不爽',     v: -0.45, a: 0.65, source: 'preset' },
  { word: '憋屈',     v: -0.50, a: 0.55, source: 'preset' },
  { word: '郁闷',     v: -0.55, a: 0.40, source: 'preset' },

  // ─── High-arousal negative ───
  { word: '生气',     v: -0.70, a: 0.85, source: 'cvaw' },
  { word: '愤怒',     v: -0.85, a: 0.95, source: 'cvaw' },
  { word: '暴怒',     v: -0.90, a: 0.98, source: 'preset' },
  { word: '憎恨',     v: -0.90, a: 0.85, source: 'cvaw' },
  { word: '仇恨',     v: -0.95, a: 0.90, source: 'preset' },
  { word: '害怕',     v: -0.70, a: 0.80, source: 'cvaw' },
  { word: '恐惧',     v: -0.85, a: 0.90, source: 'cvaw' },
  { word: '惊恐',     v: -0.80, a: 0.95, source: 'preset' },
  { word: '绝望',     v: -0.90, a: 0.60, source: 'preset' },
  { word: '轻蔑',     v: -0.40, a: 0.55, source: 'cvaw' },
  { word: '鄙视',     v: -0.60, a: 0.60, source: 'preset' },
  { word: '傲慢',     v: -0.20, a: 0.60, source: 'preset' },
  { word: '挑衅',     v: -0.30, a: 0.80, source: 'preset' },
  { word: '讽刺',     v: -0.50, a: 0.50, source: 'preset' },
  { word: '嘲笑',     v: -0.40, a: 0.60, source: 'preset' },
  { word: '戒备',     v: -0.15, a: 0.70, source: 'preset' },
  { word: '警惕',     v: -0.10, a: 0.75, source: 'preset' },
  { word: '敌意',     v: -0.60, a: 0.70, source: 'preset' },
  { word: '厌恶',     v: -0.70, a: 0.55, source: 'cvaw' },
  { word: '反感',     v: -0.55, a: 0.50, source: 'preset' },
];

// Build index for fast lookup
const WORD_MAP = new Map<string, EmotionWord>();
for (const w of DICTIONARY) {
  // Keep first occurrence (higher quality source)
  if (!WORD_MAP.has(w.word)) {
    WORD_MAP.set(w.word, w);
  }
}

// ── Lookup ──

export interface EmotionLookupResult {
  v: number;
  a: number;
  word: string;
  matchSource: 'exact' | 'backup' | 'substring' | 'free_form';
  matchedWord: string;
}

/**
 * Multi-layer emotion word lookup.
 *   Layer 1 — exact match on the primary word
 *   Layer 2 — substring match (handles combined words like "委屈焦急")
 *   Layer 3 — free_form fallback (coarse V/A from sign of word)
 *
 * Backup-word fallback (Layer 2 in the tutorial) is handled by the
 * caller — pass the backup array separately.
 */
export function lookupEmotion(
  word: string,
  backups?: string[],
): EmotionLookupResult {
  // Layer 1: exact match
  const cleaned = word.trim();
  const exact = WORD_MAP.get(cleaned);
  if (exact) {
    return { v: exact.v, a: exact.a, word: exact.word, matchSource: 'exact', matchedWord: exact.word };
  }

  // Backup words (Layer 2 in tutorial) — caller passes AI-generated fallbacks
  if (backups?.length) {
    for (const b of backups) {
      const hit = WORD_MAP.get(b.trim());
      if (hit) {
        return { v: hit.v, a: hit.a, word: b, matchSource: 'backup', matchedWord: hit.word };
      }
    }
  }

  // Layer 3: substring match — try all 2-4 char substrings
  if (cleaned.length >= 2) {
    for (let len = Math.min(4, cleaned.length); len >= 2; len--) {
      for (let i = 0; i <= cleaned.length - len; i++) {
        const sub = cleaned.slice(i, i + len);
        const hit = WORD_MAP.get(sub);
        if (hit) {
          return { v: hit.v, a: hit.a, word: sub, matchSource: 'substring', matchedWord: hit.word };
        }
      }
    }
  }

  // Layer 4 (tutorial's free_form): coarse V/A from valence sign
  // Check for positive/negative indicators (简化版，不用 embedding)
  const negIndicators = ['不', '恨', '讨', '厌', '烦', '气', '怒', '怕', '伤', '难', '痛', '哭', '酸', '苦'];
  const posIndicators = ['喜', '爱', '甜', '乐', '笑', '舒', '暖', '美', '幸', '福'];
  let hasNeg = false, hasPos = false;
  for (const ch of cleaned) {
    if (negIndicators.includes(ch)) hasNeg = true;
    if (posIndicators.includes(ch)) hasPos = true;
  }
  const fallbackV = hasNeg && !hasPos ? -0.4 : hasPos && !hasNeg ? 0.4 : 0.0;
  const fallbackA = cleaned.length >= 4 ? 0.6 : 0.4;

  return { v: fallbackV, a: fallbackA, word: cleaned, matchSource: 'free_form', matchedWord: cleaned };
}

/**
 * Get a list of all dictionary words (for LLM prompt injection).
 */
export function getDictionaryWordList(): string[] {
  return DICTIONARY.map(w => w.word);
}

/**
 * Find words within a V/A region (for emotion resonance retrieval in Phase 4/5).
 */
export function searchEmotionByVA(
  targetV: number,
  targetA: number,
  radius: number = 0.25,
  maxResults: number = 10,
): EmotionWord[] {
  const results: { word: EmotionWord; dist: number }[] = [];
  for (const w of DICTIONARY) {
    const dist = Math.sqrt((w.v - targetV) ** 2 + (w.a - targetA) ** 2);
    if (dist <= radius) {
      results.push({ word: w, dist });
    }
  }
  results.sort((a, b) => a.dist - b.dist);
  return results.slice(0, maxResults).map(r => r.word);
}
