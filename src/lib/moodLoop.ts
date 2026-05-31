import { useAppStore } from '../store';
import { CharacterMemoryEntry } from '../types';
import { getTodaysDecorationMood } from './moodPool';

// Conflict keywords for detecting recent arguments in chat history
const CONFLICT_KEYWORDS = ['吵架', '生气', '烦', '讨厌', '滚', '别烦', '不想理', '懒得', '有病', '无语', '烦躁', '闹', '冷战', '分手', '绝交', '恨', '伤', '哭', '泪'];
const SOOTHING_KEYWORDS = ['对不起', '抱歉', '错了', '原谅', '和好', '别生气', '哄', '抱', '亲', '乖', '好嘛', '错了嘛'];

export interface CharacterMood {
  overall: 'elated' | 'happy' | 'content' | 'neutral' | 'melancholy' | 'sad' | 'irritable' | 'anxious' | 'tired';
  paScore: number;
  naScore: number;
  dominantWord: string;
  arousalLevel: 'low' | 'medium' | 'high';
  affection: number;
  decorationMood: string | null;
  decorationFeeling: string | null;
  topMemorySummary: string | null;
  topMemoryValence: number;
  summary: string;
}

// Simplified inline top-memory picker to avoid circular dep with characterMemory
function pickTopMemory(characterId: string): { valence: number; summary: string | null } {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  if (!bank.length) return { valence: 0.5, summary: null };

  const now = Date.now();
  let best = bank[0];
  let bestScore = -1;

  for (const m of bank) {
    const days = (now - m.lastAccessedAt) / 86400000;
    const score = m.importance * Math.exp(-0.05 * days);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return { valence: best.valence, summary: best.summary };
}

/**
 * Calculate a mood baseline from unresolved memories.
 * Characters carrying heavy unresolved memories will have a persistent
 * negative mood contribution even without recent emotion events.
 */
function getMemoryMoodBaseline(characterId: string): { paBaseline: number; naBaseline: number; memoryArousal: number } {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];

  // Include all significant memories that contribute to emotional baseline:
  // - Unresolved memories (weigh on the character's mind)
  // - Resolved memories (with penalty — they're processed but not forgotten)
  // - Feel entries (lingering feelings, despite being pinned)
  const relevant = bank.filter(m => m.type === 'feel' || !m.pinned);
  if (relevant.length === 0) return { paBaseline: 0, naBaseline: 0, memoryArousal: 0 };

  const now = Date.now();
  let paContrib = 0;
  let naContrib = 0;
  let totalWeight = 0;
  let arousalSum = 0;

  for (const m of relevant) {
    const days = (now - m.createdAt) / 86400000;
    const recencyWeight = Math.exp(-0.05 * days); // slower decay than events
    // Resolved memories contribute less — they've been processed
    const resolvedPenalty = m.resolved === 1 ? 0.15 : 1.0;
    const weight = (m.importance || 3) * (m.arousal || 0.3) * recencyWeight * resolvedPenalty;

    if (m.valence > 0.55) {
      paContrib += ((m.valence - 0.5) * 2) * weight;
    } else if (m.valence < 0.45) {
      naContrib += ((0.5 - m.valence) * 2) * weight;
    }
    arousalSum += (m.arousal || 0.3) * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return { paBaseline: 0, naBaseline: 0, memoryArousal: 0 };

  const scale = 0.8;
  return {
    paBaseline: Math.min(0.8, (paContrib / totalWeight) * scale),
    naBaseline: Math.min(0.8, (naContrib / totalWeight) * scale),
    memoryArousal: Math.max(0.3, arousalSum / totalWeight),
  };
}

export function getCurrentMood(characterId: string): CharacterMood {
  const state = useAppStore.getState();
  const events = (state.emotionEvents || [])
    .filter(e => e.characterId === characterId)
    .slice(0, 20);

  const now = Date.now();
  let paScore = 0;
  let naScore = 0;
  let totalArousal = 0;
  let totalArousalWeight = 0;
  const wordFreq: Record<string, number> = {};

  for (const ev of events) {
    // Time decay: older events affect mood less
    // 0h=×1.0, 24h=×0.72, 3d=×0.37, 7d=×0.10, 14d≈×0.01
    const hoursAgo = (now - ev.timestamp) / 3600000;
    const decayWeight = Math.exp(-0.33 * hoursAgo / 24);
    paScore += ev.paDelta * decayWeight;
    naScore += ev.naDelta * decayWeight;
    totalArousal += ev.arousal;
    totalArousalWeight += 1;
    wordFreq[ev.word] = (wordFreq[ev.word] || 0) + decayWeight;
  }

  // Blend in persistent mood baseline from unresolved memories.
  // This ensures negative memories affect mood even after events decay.
  const memoryBaseline = getMemoryMoodBaseline(characterId);
  paScore += memoryBaseline.paBaseline;
  naScore += memoryBaseline.naBaseline;

  const count = events.length || 1;
  const avgArousal = Math.max(
    totalArousal / count,
    memoryBaseline.memoryArousal, // use memory arousal as floor when no events
  );

  let dominantWord = '平静';
  let maxFreq = 0;
  for (const [word, freq] of Object.entries(wordFreq)) {
    if (freq > maxFreq) {
      maxFreq = freq;
      dominantWord = word;
    }
  }

  const arousalLevel: 'low' | 'medium' | 'high' =
    avgArousal > 0.6 ? 'high' : avgArousal < 0.3 ? 'low' : 'medium';

  const affection = state.characters[characterId]?.affection ?? 50;
  const todayMood = getTodaysDecorationMood(characterId);
  const topMemory = pickTopMemory(characterId);

  // Check recent chat history for conflict signals
  const recentChats = state.chats[characterId] || [];
  const lastMessages = recentChats.slice(-6).map(m => m.text || '');
  const allRecentText = lastMessages.join(' ');
  const hasConflict = CONFLICT_KEYWORDS.some(kw => allRecentText.includes(kw));
  const hasSoothing = SOOTHING_KEYWORDS.some(kw => allRecentText.includes(kw));
  // If conflict was found but then soothed, don't flag it
  const activeConflict = hasConflict && !hasSoothing;

  let overall: CharacterMood['overall'];
  const parts: string[] = [];

  if (count === 0 || (Math.abs(paScore) < 0.3 && Math.abs(naScore) < 0.3)) {
    overall = affection >= 70 ? 'content' : affection <= 30 ? 'melancholy' : 'neutral';
    parts.push(overall === 'content' ? '心情不错' : overall === 'melancholy' ? '心情有些低落' : '心情平静');
  } else if (naScore > 2.0 && paScore < -0.5) {
    overall = 'sad'; parts.push('心情很糟糕');
  } else if (naScore > 1.2) {
    overall = 'sad'; parts.push('心情很糟糕');
  } else if (naScore > 0.8) {
    overall = 'melancholy'; parts.push('心情不太好');
  } else if (paScore > 2.0 && naScore < 0.5) {
    overall = 'elated'; parts.push('心情非常好');
  } else if (paScore > 1.0 && naScore < 0.5) {
    overall = 'happy'; parts.push('心情很好');
  } else if (paScore > 0.5 && naScore < 0.3) {
    overall = 'content'; parts.push('心情不错');
  } else if (paScore > 1.5 && naScore > 1.0) {
    overall = 'anxious'; parts.push('心情有些复杂');
  } else if (naScore > 0.3 && avgArousal > 0.4) {
    overall = 'irritable'; parts.push('心情有些烦躁');
  } else if (paScore < 0.3 && naScore < 0.1 && avgArousal < 0.3) {
    overall = 'tired'; parts.push('没什么精神');
  } else if (naScore > 0.1) {
    overall = 'irritable'; parts.push('心情有些烦躁');
  } else {
    overall = 'neutral'; parts.push('心情平静');
  }

  if (count > 0) {
    const p = Math.round(paScore * 10) / 10;
    const n = Math.round(naScore * 10) / 10;
    parts.push(`PA${p >= 0 ? '+' : ''}${p} NA${n >= 0 ? '+' : ''}${n}`);
  }

  if (dominantWord && dominantWord !== '平静' && count > 1) {
    parts.push(`"${dominantWord}"`);
  }

  if (topMemory.summary) {
    const vLabel = topMemory.valence > 0.6 ? '好' : topMemory.valence < 0.4 ? '差' : '中';
    parts.push(`${topMemory.summary}(${vLabel})`);
  }

  // If recent chat has active conflict, append it to the summary so mood reflects it
  if (activeConflict) {
    // Only add if not already implied by a negative mood description
    const alreadyNegative = overall === 'sad' || overall === 'irritable' || overall === 'anxious' || overall === 'melancholy';
    if (!alreadyNegative) {
      // Override mood to negative — recent conflict trumps stale emotion scores
      if (naScore > 0.3) {
        overall = 'irritable';
      } else {
        overall = 'melancholy';
      }
    }
    // Make sure "吵架" appears in the summary text
    if (!parts.some(p => p.includes('吵架'))) {
      parts.push('刚才闹了点不愉快');
    }
  }

  return {
    overall, paScore, naScore, dominantWord, arousalLevel, affection,
    decorationMood: todayMood?.word ?? null,
    decorationFeeling: todayMood?.feelingWord ?? null,
    topMemorySummary: topMemory.summary,
    topMemoryValence: topMemory.valence,
    summary: parts.join('。'),
  };
}

const MOOD_STYLES: Record<string, string> = {
  elated: '轻快活泼多感叹号',
  happy: '轻松愉快',
  content: '温和友善',
  neutral: '自然平常',
  melancholy: '低沉话少',
  sad: '低落消沉',
  irritable: '不耐烦易烦躁',
  anxious: '犹豫担忧',
  tired: '慵懒平淡',
};

export function buildMoodPrompt(mood: CharacterMood): string {
  const style = MOOD_STYLES[mood.overall] || '自然平常';
  return '【心情】' + mood.summary + '。语气：' + style + '（不可直接说出心情，自然流露）';
}

// ── Ombre-Brain Dream/Feel System ──
// Dreaming: self-reflection at conversation start. Reads recent memories,
// decides what to let go of (resolve) and what to carry forward (feel).
// Feel: the model's own feelings — not event records. They don't decay,
// don't surface in normal retrieval, and are separate from facts.

export interface FeelEntry {
  memoryId: string;
  sourceBucketId: string;
  summary: string;
  feel: string;
  valence: number;
  createdAt: number;
}

/**
 * Write a feel entry — model's own reflection about a memory.
 * Feel entries are stored as type='feel' in the memory bank.
 * They don't decay (pinned), don't surface in normal breath/retrieval,
 * and have sourceBucket pointing back to the memory being processed.
 */
export function writeFeel(
  characterId: string,
  sourceBucketId: string,
  feelText: string,
  valence: number,
): void {
  const state = useAppStore.getState();

  // Prevent duplicate feel for the same source bucket
  const bank = state.characterMemoryBank[characterId] || [];
  const alreadyFelt = bank.some(m => m.type === 'feel' && m.sourceBucket === sourceBucketId);
  if (alreadyFelt) return;

  state.addCharacterMemory(characterId, {
    type: 'feel',
    content: feelText,
    summary: `💭 ${feelText.slice(0, 80)}`,
    tags: ['内心感受'],
    valence,
    arousal: 0.3, // Feel entries have low arousal — they're reflective
    importance: 5,
    layer: 'deep',
    category: 'feel',
    sourceBucket: sourceBucketId,
    pinned: true, // Feel entries never decay
  });

  // Post an emotion event so it affects the character's mood
  // Negative feels → slight NA increase; positive feels → slight PA increase
  const paDelta = valence > 0.6 ? 0.3 : valence > 0.4 ? 0.05 : 0;
  const naDelta = valence < 0.4 ? 0.35 : valence < 0.5 ? 0.1 : 0;
  state.addEmotionEvent({
    characterId,
    paDelta,
    naDelta,
    word: '感受',
    valence: (valence - 0.5) * 2,
    arousal: 0.3,
    matchSource: 'free_form',
    source: 'manual',
  });
}

/**
 * Mark a memory as digested (processed by dreaming).
 * Digested memories get accelerated fading (×0.02 weight modifier),
 * meaning they sink to the bottom but are never deleted.
 */
export function markDigested(characterId: string, memoryId: string): void {
  const state = useAppStore.getState();
  state.updateCharacterMemory(characterId, memoryId, { digested: true, resolved: 1 });
}

/**
 * Dream: self-reflection process.
 * Reads the top unresolved memories for a character, determines which
 * can be resolved (let go) and which need a feel entry (carry forward).
 *
 * Returns a summary of what happened for AI prompt injection.
 */
export function dream(characterId: string): {
  resolved: number;
  felt: number;
  feelEntries: FeelEntry[];
} {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];

  // Lazy require to avoid circular dependency with characterMemory
  const { scoreMemory: scoreMem } = require('./characterMemory');

  // Get unresolved, non-feel, non-pinned memories, sorted by score
  const candidates = bank
    .filter(m => m.resolved !== 1 && m.type !== 'feel' && !m.pinned)
    .sort((a, b) => scoreMem(b) - scoreMem(a))
    .slice(0, 5); // top 5 unresolved

  let resolved = 0;
  let felt = 0;
  const feelEntries: FeelEntry[] = [];

  for (const mem of candidates) {
    const score = scoreMem(mem);
    // High-valence, low-arousal: likely resolved naturally → mark digested
    if (mem.valence > 0.6 && mem.arousal < 0.4) {
      markDigested(characterId, mem.id);
      resolved++;
      continue;
    }

    // Very old memory (created >7 days) with low importance → let go
    const ageDays = (Date.now() - mem.createdAt) / 86400000;
    if (ageDays > 7 && mem.importance < 4 && mem.arousal < 0.5) {
      markDigested(characterId, mem.id);
      resolved++;
      continue;
    }

    // High-arousal unresolved → write a feel, then mark digested
    if (mem.arousal > 0.6 || mem.importance > 7) {
      let feelText = '';
      if (mem.valence > 0.5) {
        feelText = `想起${mem.summary}，心里暖暖的。`;
      } else {
        feelText = `${mem.summary}的事还有些在意，希望一切都好。`;
      }

      writeFeel(characterId, mem.id, feelText, mem.valence);
      markDigested(characterId, mem.id);

      feelEntries.push({
        memoryId: mem.id,
        sourceBucketId: mem.id,
        summary: mem.summary,
        feel: feelText,
        valence: mem.valence,
        createdAt: Date.now(),
      });
      felt++;
      continue;
    }

    // Everything else: just mark digested (natural fading)
    if (mem.importance < 3) {
      markDigested(characterId, mem.id);
      resolved++;
    }
  }

  return { resolved, felt, feelEntries };
}

/**
 * Get all feel entries for a character (for display / prompt injection).
 */
export function getFeelMemories(characterId: string): CharacterMemoryEntry[] {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  return bank
    .filter(m => m.type === 'feel')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);
}

/**
 * Build a dream summary for AI prompt injection.
 * Shows: how many memories were processed, what feels were written.
 */
export function buildDreamPrompt(characterId: string): string {
  const feels = getFeelMemories(characterId);
  if (!feels.length) return '';

  const feelLines = feels.map(f => f.summary).join('\n');
  return `【内心余韵】\n${feelLines}\n（这些是放不下的感受，自然地带着就好）`;
}

