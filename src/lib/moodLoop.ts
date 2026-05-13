import { useAppStore } from '../store';
import { getTodaysDecorationMood } from './moodPool';

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

export function getCurrentMood(characterId: string): CharacterMood {
  const state = useAppStore.getState();
  const events = (state.emotionEvents || [])
    .filter(e => e.characterId === characterId)
    .slice(0, 20);

  let paScore = 0;
  let naScore = 0;
  let totalArousal = 0;
  const wordFreq: Record<string, number> = {};

  for (const ev of events) {
    paScore += ev.paDelta;
    naScore += ev.naDelta;
    totalArousal += ev.arousal;
    wordFreq[ev.word] = (wordFreq[ev.word] || 0) + 1;
  }

  const count = events.length || 1;
  const avgArousal = totalArousal / count;

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

  let overall: CharacterMood['overall'];
  const parts: string[] = [];

  if (count === 0 || (Math.abs(paScore) < 0.3 && Math.abs(naScore) < 0.3)) {
    overall = affection >= 70 ? 'content' : affection <= 30 ? 'melancholy' : 'neutral';
    parts.push(overall === 'content' ? '心情不错' : overall === 'melancholy' ? '心情有些低落' : '心情平静');
  } else if (paScore > 2.0 && naScore < 0.5) {
    overall = 'elated'; parts.push('心情非常好');
  } else if (paScore > 1.0 && naScore < 0.5) {
    overall = 'happy'; parts.push('心情很好');
  } else if (paScore > 0.5 && naScore < 0.3) {
    overall = 'content'; parts.push('心情不错');
  } else if (paScore < 0.3 && naScore > 1.5) {
    overall = 'sad'; parts.push('心情很糟糕');
  } else if (paScore < 0.5 && naScore > 1.0) {
    overall = 'melancholy'; parts.push('心情不太好');
  } else if (paScore > 1.5 && naScore > 1.0) {
    overall = 'anxious'; parts.push('心情有些复杂');
  } else if (naScore > 0.5 && avgArousal > 0.4) {
    overall = 'irritable'; parts.push('心情有些烦躁');
  } else if (paScore < 0.3 && avgArousal < 0.3) {
    overall = 'tired'; parts.push('没什么精神');
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

  return {
    overall, paScore, naScore, dominantWord, arousalLevel, affection,
    decorationMood: todayMood?.word ?? null,
    decorationFeeling: todayMood?.feelingWord ?? null,
    topMemorySummary: topMemory.summary,
    topMemoryValence: topMemory.valence,
    summary: parts.join('。'),
  };
}

export function buildMoodPrompt(mood: CharacterMood): string {
  const styleMap: Record<string, string> = {
    elated: '语气轻快活泼，多用感叹号，主动分享开心的事',
    happy: '语气轻松愉快，表现出积极的情绪状态',
    content: '语气温和友善，说话从容，有满足感',
    neutral: '语气自然平常，如实回应即可',
    melancholy: '语气低沉，话语减少，流露出淡淡的忧伤',
    sad: '语气低落消沉，可能不太想说话，或者话语中透露出悲伤',
    irritable: '语气不耐烦，容易烦躁，说话简短直接甚至带刺',
    anxious: '语气犹豫，流露出担忧或不安，可能反复确认',
    tired: '语气慵懒无力，反应平淡，懒得说太多话',
  };

  const style = styleMap[mood.overall] || styleMap.neutral;

  return `【当前心情状态】\n${mood.summary}\n\n请根据上述心情状态调整回复语气：${style}\n（不要直接说出你的心情，通过语气自然流露）`;
}
