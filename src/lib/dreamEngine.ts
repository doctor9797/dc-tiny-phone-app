/**
 * Dream Engine — generates first-person prose-style dreams
 * from unresolved character memories.
 *
 * Pipeline:
 *   Material selection (unresolved emotional memories)
 *   → AI dream writing (single-pass, prose style)
 *   → Direct storage (no latent/surfaced lifecycle)
 */

import { useAppStore } from '../store';
import { DreamEntry } from '../types';
import { generateAIResponse } from './ai';
import { getCurrentMood } from './moodLoop';

// ── Constants ──

const SELECTION_LIMIT = 5; // max memories per dream

// ── AI Prompt ──

const DREAM_PROSE_PROMPT = `你是一位文学作家。我会给你一些角色心中放不下的记忆片段，请以这些记忆为素材，用角色的第一人称（"我"），写一篇散文式的梦。

写作要求：
- 用第一人称"我"，这是角色自己的梦
- 这是一篇文学散文，要有画面感和情绪的流动
- 运用隐喻、象征等文学手法，让文字有质感
- 不要直白地说情绪词，而是通过场景和描写让情绪自然流露
- 梦的情绪基调可以是温暖的、怀旧的、宁静的、荒诞的、忧伤的、平和的——不必是黑暗或恐怖的，不要让梦境刻意阴森
- 写一篇完整的散文，请保证足够的篇幅和细节，不要写得太短

返回 JSON 格式：
{"dreamTitle":"标题（3-8字）","dreamNarrative":"散文正文","condensedSummary":"一句话概括（10-20字）","valence":0~1,"arousal":0~1}`;

// ── Helpers ──

function generateDreamId(): string {
  return `dream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get unresolved, non-dreamt memories suitable for dream material.
 * Picks the top emotional (high-arousal or high-importance) memories.
 */
function getDreamMaterial(characterId: string, limit: number = SELECTION_LIMIT): {
  summary: string;
  valence: number;
  arousal: number;
  memoryId: string;
}[] {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];

  // Filter: non-feel, unresolved, not already used in dreams
  const existingDreams = state.dreams[characterId] || [];
  const usedMemoryIds = new Set(existingDreams.flatMap(d => d.sourceMemoryIds || []));

  const candidates = bank
    .filter(m =>
      m.type !== 'feel' &&
      m.resolved !== 1 &&
      !m.pinned &&
      !usedMemoryIds.has(m.id)
    )
    .sort((a, b) => {
      const scoreA = (a.arousal || 0.3) * (a.importance || 3) * (Math.abs(a.valence - 0.5) + 0.5);
      const scoreB = (b.arousal || 0.3) * (b.importance || 3) * (Math.abs(b.valence - 0.5) + 0.5);
      return scoreB - scoreA;
    })
    .slice(0, limit);

  return candidates.map(m => ({
    summary: m.summary || m.content.slice(0, 60),
    valence: m.valence ?? 0.5,
    arousal: m.arousal ?? 0.3,
    memoryId: m.id,
  }));
}

/**
 * Write a prose-style dream from memory material via a single AI call.
 */
async function writeDreamProse(
  characterId: string,
  material: { summary: string; valence: number; arousal: number }[],
): Promise<{
  dreamTitle: string;
  dreamNarrative: string;
  condensedSummary: string;
  valence: number;
  arousal: number;
}> {
  const state = useAppStore.getState();
  const character = state.characters[characterId];
  const charName = character?.name || '未知';
  const charPersonality = character?.personality || '';

  const memoryText = material.map((m, i) =>
    `记忆${i + 1}：${m.summary}`
  ).join('\n');

  const prompt = `角色：${charName}\n性格：${charPersonality}\n\n心中放不下的记忆：\n${memoryText}\n\n${DREAM_PROSE_PROMPT}`;

  try {
    const raw = await generateAIResponse(prompt);
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());

    return {
      dreamTitle: result.dreamTitle || '无题',
      dreamNarrative: result.dreamNarrative || '梦是模糊的，醒来后什么也不记得了。',
      condensedSummary: result.condensedSummary || '一个难以描述的梦',
      valence: Math.max(0, Math.min(1, result.valence ?? 0.5)),
      arousal: Math.max(0, Math.min(1, result.arousal ?? 0.5)),
    };
  } catch {
    return {
      dreamTitle: '无题',
      dreamNarrative: '梦是模糊的，醒来后什么也不记得了。',
      condensedSummary: '一个难以描述的梦',
      valence: 0.5,
      arousal: 0.3,
    };
  }
}

// ── Public API ──

/**
 * Generate a dream for a character and store it directly.
 * Returns the created DreamEntry, or null if no suitable material.
 */
export async function generateDream(characterId: string): Promise<DreamEntry | null> {
  const state = useAppStore.getState();

  // Get dream material (unresolved emotional memories)
  const material = getDreamMaterial(characterId);
  if (material.length === 0) return null;

  // Compute overall emotional signature
  const avgValence = material.reduce((s, m) => s + m.valence, 0) / material.length;
  const avgArousal = material.reduce((s, m) => s + m.arousal, 0) / material.length;

  // Write dream prose
  const dreamData = await writeDreamProse(characterId, material);

  // Create dream entry
  const dream: DreamEntry = {
    id: generateDreamId(),
    characterId,
    dreamNarrative: dreamData.dreamNarrative,
    dreamTitle: dreamData.dreamTitle,
    condensedSummary: dreamData.condensedSummary,
    valence: dreamData.valence,
    arousal: dreamData.arousal,
    createdAt: Date.now(),
    sourceMemoryIds: material.map(m => m.memoryId),
  };

  state.addDream(characterId, dream);
  return dream;
}

/**
 * Get all dreams for a character, sorted by creation time (newest first).
 */
export function getCharacterDreams(characterId: string): DreamEntry[] {
  const state = useAppStore.getState();
  return (state.dreams[characterId] || [])
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ── Dream Sharing ──
// Characters proactively share dreams with the user via WeChat,
// based on mood, affection, relationship, personality, and dream vividness.

const DREAM_SHARE_SYSTEM_PROMPT = `你是角色本人，正在微信上和对方聊天。你昨晚做了一个梦，现在想自然地告诉对方。

要求：
1. 用口语化的方式分享你的梦，就像朋友间闲聊一样自然
2. 不要照搬"梦境档案"里的文字，用你自己的话讲出来
3. 开头可以多样化，例如"诶对了""你知道吗""昨晚做了个梦""说起来你可能不信""唔昨晚梦到一些有的没的"
4. 1-3句话，简短精炼
5. 符合你的性格和你们的关系
6. 微信聊天风格，严禁动作/神态/心理描写
7. 直接以文字开头，不要引号、角色名、冒号、括号、星号`;

/**
 * Evaluate how likely a character is to share a specific dream with the user,
 * based on affection, relationship, personality, dream vividness, and current mood.
 * Returns a score 0-100.
 */
export function evaluateDreamShareLikelihood(
  characterId: string,
  dream: DreamEntry
): number {
  const state = useAppStore.getState();
  const character = state.characters[characterId];
  if (!character) return 0;

  const affection = character.affection ?? 50;
  let score = 0;

  // Affection (0-30): higher affection → more willing to share intimate content
  score += (affection / 100) * 30;

  // Relationship closeness (0-25)
  if (character.relationshipStatus === 'married' || character.relationshipStatus === 'engaged') {
    score += 25;
  } else if (character.relationshipStatus === 'dating') {
    score += 18;
  }
  const closeKeywords = ['恋人', '伴侣', '爱人', '妻子', '丈夫', '未婚'];
  if (closeKeywords.some(k => character.relationship?.includes(k))) {
    score += 10;
  }

  // Personality (0-20): outgoing characters share more readily
  const openTraits = ['开朗', '乐观', '活泼', '阳光', '友善', '不羁'];
  const reservedTraits = ['深沉', '多疑', '沉默', '傲慢', '谨慎', '独立', '工作狂'];
  if (openTraits.some(t => character.personality?.includes(t))) {
    score += 20;
  } else if (reservedTraits.some(t => character.personality?.includes(t))) {
    score += 5; // reserved characters still share, but rarely
  } else {
    score += 12;
  }

  // Dream vividness — high arousal dreams leave a stronger impression (0-15)
  score += Math.max(0, (dream.arousal - 0.2) * 20);

  // Emotional intensity — dreams with strong emotions are more memorable (0-10)
  score += Math.abs(dream.valence - 0.5) * 25;

  // Current mood override (0-10)
  try {
    const mood = getCurrentMood(characterId);
    if (['elated', 'happy', 'content'].includes(mood.overall)) {
      score += 10; // good mood → more likely to share
    } else if (['melancholy', 'sad', 'irritable', 'tired', 'anxious'].includes(mood.overall)) {
      score -= 10; // bad mood → less likely to share
    }
  } catch {}

  return Math.max(0, Math.min(100, score));
}

/**
 * Get the best recent dream for a character to share, considering all factors.
 * Returns null if no suitable unshared dream exists or likelihood is too low.
 */
export function getDreamToShare(characterId: string): { dream: DreamEntry; likelihood: number } | null {
  const state = useAppStore.getState();
  const character = state.characters[characterId];
  if (!character) return null;

  const dreams = state.dreams[characterId] || [];
  if (dreams.length === 0) return null;

  // Only consider dreams from the past 36 hours (covers "last night")
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;
  const recentDreams = dreams.filter(d => d.createdAt > cutoff);
  if (recentDreams.length === 0) return null;

  // Skip if character already shared a dream after this one was created
  const lastShareAt = character.lastDreamShareAt || 0;
  const unsharedDreams = recentDreams.filter(d => d.createdAt > lastShareAt);
  if (unsharedDreams.length === 0) return null;

  // Score each unshared dream and pick the best
  let bestDream: DreamEntry | null = null;
  let bestScore = 0;

  for (const dream of unsharedDreams) {
    const score = evaluateDreamShareLikelihood(characterId, dream);
    if (score > bestScore) {
      bestScore = score;
      bestDream = dream;
    }
  }

  if (!bestDream || bestScore < 30) return null;

  return { dream: bestDream, likelihood: bestScore };
}

/**
 * Generate a conversational (colloquial) dream-sharing message for a character.
 * Takes the prose dream archive entry and rewrites it in natural spoken Chinese.
 */
export async function generateDreamShareMessage(
  characterId: string,
  dream: DreamEntry
): Promise<string | null> {
  const state = useAppStore.getState();
  const character = state.characters[characterId];
  if (!character) return null;

  const charDesc = `你是${character.name}。性格：${character.personality || '普通'}。关系：${character.relationship || '朋友'}（对方=${character.userNickname || '你'}，好感度${character.affection ?? 50}/100）。`;

  const dreamContent = [
    `你昨晚做的梦：`,
    `标题：${dream.dreamTitle}`,
    `大概内容：${dream.condensedSummary}`,
    `梦中情景：${(dream.dreamNarrative || '').slice(0, 250)}`,
  ].join('\n');

  const prompt = `${dreamContent}\n\n你现在正在和${character.userNickname || '对方'}微信聊天。自然地提起你昨晚做的这个梦，用你自己的话口语化地讲出来，不要像在念文章一样。`;

  try {
    const raw = await generateAIResponse(prompt, charDesc + '\n' + DREAM_SHARE_SYSTEM_PROMPT);
    const cleaned = raw.trim();
    return cleaned || null;
  } catch {
    return null;
  }
}
