import { CharacterMemoryEntry } from '../types';
import { useAppStore } from '../store';
import { generateAIResponse } from './ai';

// ── Phase 1: Hippocampus Memory Engine ──
// Inspired by Ombre-Brain weight pool mechanism
// Upgraded with: short/long-term weight separation, memory reconstruction,
// memory merging, and pinned memory support.

// ── Daily event interval control ──
// 角色自己的日常活动记忆（decoration mood）不能一口气生成，要分散到一天里
const DAILY_EVENT_INTERVAL_MIN = 2 * 60 * 60 * 1000;   // 2 小时
const DAILY_EVENT_INTERVAL_MAX = 6 * 60 * 60 * 1000;   // 6 小时
const MAX_DAILY_EVENTS = 5;

/** 记录每个角色上次生成日常事件的时间戳 */
const lastDailyEventTime: Record<string, number> = {};

export function getRandomInterval(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 标记日常事件已生成，记录时间戳用于下次间隔判断 */
export function markDailyEventGenerated(characterId: string): void {
  lastDailyEventTime[characterId] = Date.now();
}

export function canGenerateDailyEvent(characterId: string): boolean {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  const today = new Date().toISOString().split('T')[0];

  // 每天最多 MAX_DAILY_EVENTS 条
  const todayCount = bank.filter(
    m => m.category === 'decoration_mood' && m.summary?.includes(today)
  ).length;
  if (todayCount >= MAX_DAILY_EVENTS) return false;

  // 随机时间间隔
  const last = lastDailyEventTime[characterId];
  if (!last) return true;
  return Date.now() - last >= getRandomInterval(DAILY_EVENT_INTERVAL_MIN, DAILY_EVENT_INTERVAL_MAX);
}

// ── Constants ──

const PERMANENT_CATEGORIES = new Set([
  'sop', 'infra', 'progress', 'feature_plan', 'lessons_learned', 'llm_routing', 'tts_config',
]);

const LAMBDA: Record<string, number> = {
  deep:    0.05,
  daily:   0.05,
  diary:   0.05,
  writing: 0.05,
  ambient: 0.15,
};

const FORGET_THRESHOLD      = 0.15;
const MAX_MEMORIES_PER_CHAR = 200;
const DEHYDRATE_LENGTH      = 500;
const NORMALIZE             = 5;

// ── New: Short/Long-term weight separation ──
// First 3 days: time dominates (70%). After 3 days: emotion dominates (70%).
// This simulates how human memory prioritizes freshness first, then emotional weight.
const SHORT_TERM_DAYS = 3;
const SHORT_TERM_TIME_WEIGHT = 0.7;
const SHORT_TERM_EMOTION_WEIGHT = 0.3;
const LONG_TERM_TIME_WEIGHT = 0.3;
const LONG_TERM_EMOTION_WEIGHT = 0.7;
const AROUSAL_BOOST = 0.8;
const BASE_EMOTION_WEIGHT = 1.0;

// ── Memory reconstruction constants ──
// Current mood shifts retrieved memory valence by ±0.1 max,
// simulating "mood-congruent recall" cognitive bias.
const RECONSTRUCTION_MAX_SHIFT = 0.1;

// ── Helpers ──

export function getLayerDecayRate(layer?: string): number {
  return LAMBDA[layer ?? 'daily'] ?? 0.05;
}

export function isPermanent(entry: CharacterMemoryEntry): boolean {
  return !!entry.category && PERMANENT_CATEGORIES.has(entry.category);
}

// ── New: Freshness bonus (continuous exponential, no jump) ──
//   t=0:  ×2.0,  t=25h: ×1.5,  t=72h: ×1.14,  1w+: ≈×1.0
//   Lower bound ×1.0 — old memories are NOT punished, new ones get a boost.
function getFreshnessBonus(hoursSinceCreation: number): number {
  return 1.0 + 1.0 * Math.exp(-hoursSinceCreation / 36);
}

// ── New: Short/Long-term combined weight ──
//   ≤3 days:  time_weight × 0.7 + emotion_weight × 0.3
//   >3 days:  emotion_weight × 0.7 + time_weight × 0.3
function computeCombinedWeight(days: number, arousal: number): number {
  const emotionWeight = BASE_EMOTION_WEIGHT + arousal * AROUSAL_BOOST;
  const freshBonus = getFreshnessBonus(days * 24);

  if (days <= SHORT_TERM_DAYS) {
    return freshBonus * SHORT_TERM_TIME_WEIGHT + emotionWeight * SHORT_TERM_EMOTION_WEIGHT;
  } else {
    return emotionWeight * LONG_TERM_EMOTION_WEIGHT + freshBonus * LONG_TERM_TIME_WEIGHT;
  }
}

// ── New: Memory reconstruction (mood-congruent bias) ──
// Retrieves current character mood and shifts the memory's displayed valence
// slightly toward the mood, simulating "how you feel colors what you remember."
export function getReconstructedValence(
  memoryValence: number,
  characterId: string,
): number {
  try {
    const { getCurrentMood } = require('./moodLoop');
    const mood = getCurrentMood(characterId);
    // Map mood to a bias direction: positive mood → positive shift, negative → negative shift
    const moodBias = (mood.paScore - mood.naScore) * 0.05; // range roughly -0.1 to +0.1
    const clampedBias = Math.max(-RECONSTRUCTION_MAX_SHIFT, Math.min(RECONSTRUCTION_MAX_SHIFT, moodBias));
    return Math.max(0, Math.min(1, memoryValence + clampedBias));
  } catch {
    return memoryValence; // fallback: no bias
  }
}

// ── Scoring ──

export function scoreMemory(
  entry: CharacterMemoryEntry,
  options?: { moodBias?: boolean; characterId?: string },
): number {
  // Pinned memories: never decay, always on top
  if (entry.pinned) return 999;
  if (isPermanent(entry)) return 999;

  const now = Date.now();
  const daysSinceAccess = (now - entry.lastAccessedAt) / (1000 * 60 * 60 * 24);
  const hoursSinceCreation = (now - entry.createdAt) / (1000 * 60 * 60);

  // Time weight curve (unchanged)
  let timeWeight: number;
  if (daysSinceAccess <= 1) {
    timeWeight = 1.0;
  } else if (daysSinceAccess <= 2) {
    timeWeight = 0.9;
  } else {
    timeWeight = Math.max(0.3, 0.9 * Math.exp(-0.2197 * (daysSinceAccess - 2)));
  }

  // Base score with freshness
  const λ = getLayerDecayRate(entry.layer);
  const activation = Math.pow(entry.accessCount, 0.3);
  const decay = Math.exp(-λ * daysSinceAccess);
  const emotion = 1 + Math.pow(entry.arousal, 0.5);
  const freshness = getFreshnessBonus(hoursSinceCreation);
  const base = (entry.importance * activation * decay * emotion * freshness) / NORMALIZE;

  // ── Short/Long-term weight separation ──
  const combinedWeight = computeCombinedWeight(daysSinceAccess, entry.arousal);
  const weightedScore = timeWeight * base * combinedWeight;

  // Modifiers
  const resolvedMod = entry.resolved === 1 ? 0.05 : 1.0;
  const urgencyMod = (entry.arousal > 0.7 && entry.resolved !== 1) ? 1.5 : 1.0;
  // Digested (processed by dream) → accelerated fading
  const digestedMod = entry.digested ? 0.02 : 1.0;

  return weightedScore * resolvedMod * urgencyMod * digestedMod;
}

// ── New: Find and merge duplicate/similar memories ──
// Uses character-level Jaccard similarity to find pairs above threshold,
// merges the lower-score one into the higher-score one.
export function mergeSimilarMemories(characterId: string, threshold: number = 0.65): number {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  if (bank.length < 2) return 0;

  const { mergeCharacterMemories } = useAppStore.getState();
  let mergedCount = 0;

  for (let i = 0; i < bank.length; i++) {
    if (mergedCount > 5) break; // safety cap per call
    const a = bank[i];
    if (a.pinned) continue;

    for (let j = i + 1; j < bank.length; j++) {
      const b = bank[j];
      if (b.pinned) continue;
      if (a.type !== b.type && a.type !== 'feel' && b.type !== 'feel') continue;

      const sim = simpleSimilarity(a.summary, b.summary);
      if (sim > threshold) {
        // Keep the higher-scored one
        const scoreA = scoreMemory(a);
        const scoreB = scoreMemory(b);
        const keepId = scoreA >= scoreB ? a.id : b.id;
        const mergeId = scoreA >= scoreB ? b.id : a.id;
        mergeCharacterMemories(characterId, keepId, mergeId);
        mergedCount++;
        break; // a was merged, move on
      }
    }
  }

  // Re-read bank after merges for consolidation
  if (mergedCount > 0) {
    consolidateCharacterMemories(characterId);
  }

  return mergedCount;
}

// ── Retrieval ──

export function getMemoriesForCharacter(
  characterId: string,
  options?: {
    query?: string;
    maxResults?: number;
    minImportance?: number;
    types?: CharacterMemoryEntry['type'][];
  }
): CharacterMemoryEntry[] {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  if (!bank.length) return [];

  let filtered = [...bank];

  if (options?.minImportance) {
    filtered = filtered.filter(m => m.importance >= options.minImportance!);
  }

  if (options?.types?.length) {
    filtered = filtered.filter(m => options.types!.includes(m.type));
  }

  if (options?.query?.trim()) {
    const q = options.query.toLowerCase();
    filtered = filtered.filter(m =>
      m.content.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      m.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // Score with memory reconstruction bias
  const scored = filtered.map(m => ({
    entry: m,
    score: scoreMemory(m, { moodBias: true, characterId }),
  }));
  scored.sort((a, b) => b.score - a.score);

  const maxResults = options?.maxResults || 10;
  const topResults = scored.slice(0, maxResults);

  // Retrieval reinforcement
  const updateAccess = useAppStore.getState().updateCharacterMemoryAccess;
  for (const { entry } of topResults) {
    updateAccess(characterId, entry.id);
  }

  let selected = topResults.map(s => s.entry);

  // Sudden recall
  if (topResults.length < maxResults && bank.length > topResults.length) {
    if (Math.random() < 0.4) {
      const count = Math.min(
        1 + Math.floor(Math.random() * 3),
        maxResults - topResults.length,
      );
      const oldHits = bank
        .filter(m => !selected.some(s => s.id === m.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, count);

      for (const m of oldHits) {
        updateAccess(characterId, m.id);
      }
      selected = [...selected, ...oldHits];
    }
  }

  return selected;
}

export function getTopMemoriesForPrompt(
  characterId: string,
  maxTokens: number = 1200
): string {
  const scoredMemories = getMemoriesForCharacter(characterId, { maxResults: 15 });
  if (!scoredMemories.length) return '';

  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  const recentMemories = [...bank]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  const seen = new Set<string>();
  const merged: CharacterMemoryEntry[] = [];
  for (const m of [...recentMemories, ...scoredMemories]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      merged.push(m);
    }
  }

  let result = '';
  let tokenEstimate = 0;

  for (const m of merged) {
    // Apply memory reconstruction: show biased valence in prompt
    const displayValence = getReconstructedValence(m.valence, characterId);
    const valenceTag = displayValence > 0.6 ? '😊' : displayValence < 0.4 ? '😔' : '😐';
    const displayContent = dehydrateContent(m.content, m.summary);
    const pinnedTag = m.pinned ? '📌' : '';
    const line = `${pinnedTag}[${m.type}]${valenceTag} ${displayContent}`;
    const approxTokens = line.length / 2;
    if (tokenEstimate + approxTokens > maxTokens) break;
    result += line + '\n';
    tokenEstimate += approxTokens;
  }

  return result.trim();
}

function dehydrateContent(content: string, summary: string): string {
  if (content.length > DEHYDRATE_LENGTH) return `📝 ${summary}`;
  return content;
}

// ── Memory Extraction ──

export async function extractMemoryFromConversation(
  characterId: string,
  userMessage: string,
  characterReply: string
): Promise<void> {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  const charName = state.characters[characterId]?.name || characterId;

  // Skip trivial exchanges
  const rawMsg = userMessage.trim();
  if (rawMsg.length < 3 || /^(\u561e|\u54e6|\u597d|\u662f|\u5bf9|ok|\u7684|\u77e5\u9053\u4e86|\u660e\u767d|\u54c8\u54c8|\u597d\u5427|\u884c|\u53ef\u4ee5|\u6ca1\u4e8b|\u6ca1\u4ec0\u4e48|\u7b97\u4e86|\u62dc|\u518d\u89c1|\u665a\u5b89|\u65e9\u5b89|hi|hello|\u55e4)[!\uff01\u3002.]?$/i.test(rawMsg)) return;

  // Get recent conversation history for richer context
  const history = state.chats[characterId] || [];
  const recentMessages = history.slice(-6).map(msg =>
    `${msg.senderId === 'user' ? '用户' : charName}: ${msg.text}`
  ).join('\n');

  try {
    const extracted = await generateAIResponse(
      `从对话中提取重要的事实信息，包括用户和${charName}双方的信息。如果没有值得记的就返回"无"。

对话：
${recentMessages}

要求：
1. 提取用户明确提到的个人事实——身份、经历、状态、偏好、计划、感受等
2. 也提取${charName}自己说过的重要信息——计划、行动、感受、承诺、即将做的事情等（如"我明天要去..."、"我打算..."、"我刚刚..."、"我喜欢..."等）
3. 用一句话总结，保留具体细节（名字、数字、事件等），50字以内
4. 只写对话中明确说出来的内容，绝对不能编造
5. 如果只是普通寒暄（吃了吗、在干嘛、嗯、好、哈哈等）没有实质信息，返回"无"

已有记忆摘要（避免重复）：
${bank.slice(0, 10).map(m => `- ${m.summary}`).join('\n')}`
    );

    const cleaned = extracted.replace(/[#*]/g, '').trim();
    if (cleaned && cleaned !== '\u65e0' && cleaned.length < 150 && !isDuplicate(cleaned, bank)) {
      const toneTags = await generateAIResponse(
        `分析以下对话的情感，返回 JSON：{"valence":0~1,"arousal":0~1,"tags":["标签1","标签2"]}
valence: 0=负面, 0.5=中性, 1=正面
arousal: 0=平静, 0.5=普通, 1=激动
不要任何其他内容。

对话：
用户说：${userMessage}
${charName}：${characterReply}`
      );

      let valence = 0.5;
      let arousal = 0.5;
      let tags: string[] = [];

      try {
        const parsed = JSON.parse(toneTags.replace(/```json|```/g, '').trim());
        valence = parsed.valence ?? 0.5;
        arousal = parsed.arousal ?? 0.5;
        tags = parsed.tags || [];
      } catch {}

      const isUserFact = /我(喜欢|讨厌|爱|恨|想要|需要|觉得|认为|打算|准备|正在|最近|是|叫|来自|住在|在.*工作|学.*专业|有|没有|想|不想|可以|不可以|会|不会|生日|爱好|习惯|梦想|目标|担心|害怕|家|爸妈|家人|朋友|同事)/.test(userMessage);

      useAppStore.getState().addCharacterMemory(characterId, {
        type: isUserFact ? 'fact' : 'observation',
        content: `${userMessage}\n---\n${characterReply}`,
        summary: cleaned,
        tags: tags.filter(Boolean).slice(0, 5),
        valence: Math.max(0, Math.min(1, valence)),
        arousal: Math.max(0, Math.min(1, arousal)),
        importance: Math.max(1, Math.min(10, isUserFact ? 6 : 4)),
        layer: 'daily',
      });

      // Auto-merge similar memories to prevent duplicate clutter
      mergeSimilarMemories(characterId, 0.7);

      consolidateCharacterMemories(characterId);
    }
  } catch {
    // Silently fail - memory extraction is non-critical
  }
}

// ── Consolidation (Ebbinghaus forgetting curve) ──

export async function consolidateCharacterMemories(characterId: string): Promise<void> {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  if (bank.length < 20) return;

  // Protected: pinned memories and feel entries are never removed
  const protectedMem = bank.filter(m => m.pinned || m.type === 'feel');
  const unprotected = bank.filter(m => !m.pinned && m.type !== 'feel');

  const scored = unprotected.map(m => ({ entry: m, score: scoreMemory(m) }));

  // Phase 1: keep above forget threshold
  const aboveThreshold = scored.filter(s => s.score >= FORGET_THRESHOLD || s.entry.resolved === 0);

  // Phase 2: keep top N by score
  aboveThreshold.sort((a, b) => b.score - a.score);
  const keep = [...protectedMem, ...aboveThreshold.slice(0, MAX_MEMORIES_PER_CHAR - protectedMem.length).map(s => s.entry)];

  if (keep.length < bank.length) {
    useAppStore.setState((state) => ({
      characterMemoryBank: {
        ...state.characterMemoryBank,
        [characterId]: keep,
      }
    }));
  }
}

// ── Similarity (character-level Jaccard) ──

function simpleSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(''));
  const setB = new Set(b.toLowerCase().split(''));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function isDuplicate(summary: string, bank: CharacterMemoryEntry[]): boolean {
  return bank.some(m => {
    const sim = simpleSimilarity(m.summary, summary);
    return sim > 0.75;
  });
}

// ── Simple sentiment heuristic (no AI call) ──
// Estimates valence (0~1) and arousal (0~1) from text content.
// Used to give basic memories meaningful default coordinates.

const POSITIVE_WORDS = ['喜欢','开心','好','棒','爱','高兴','爽','舒服','好看','好吃','好玩','可爱','漂亮','厉害','不错','赞','美','幸福','快乐','感动','感谢','谢谢','哈哈','嘻嘻','微笑','期待','希望','浪漫','温柔','贴心','善良','温暖','阳光','甜蜜','美好','惊喜','满足','骄傲','安心'];
const NEGATIVE_WORDS = ['讨厌','难过','伤心','气','烦','累','无聊','垃圾','差','烂','丑','恶心','痛苦','害怕','担心','焦虑','紧张','哭','泪','崩溃','绝望','恨','滚','杀','死','糟糕','失败','烦死','恶心','恶心死了','有病','疯了','受不了','无语','烦躁','郁闷','悲伤','寂寞','孤独','生气','愤怒','暴躁','焦虑','恐惧'];
const HIGH_AROUSAL = ['超级','非常','太','特别','很','最','极','激动','兴奋','震惊','愤怒','疯狂','爆炸','救命','完了','天哪','天啊','卧槽','靠','恶心','害怕','紧张','着急','立刻','马上'];

export function estimateSentiment(text: string): { valence: number; arousal: number } {
  let score = 0;
  let arousalBoost = 0;

  for (const word of POSITIVE_WORDS) {
    if (text.includes(word)) score += 1;
  }
  for (const word of NEGATIVE_WORDS) {
    if (text.includes(word)) score -= 1.5;
  }
  for (const word of HIGH_AROUSAL) {
    if (text.includes(word)) arousalBoost += 0.15;
  }

  const valence = Math.max(0.05, Math.min(0.95, 0.5 + score * 0.08));
  const arousal = Math.max(0.05, Math.min(0.95, 0.35 + arousalBoost));
  return { valence, arousal };
}

// ── Shared memory helper for all features ──
// Call this after any character interaction to save a basic memory.
// No AI call needed — uses the raw interaction text directly.
// Returns true if the memory was saved, false if skipped (trivial/duplicate).
export function saveInteractionMemory(
  characterId: string,
  interactionSummary: string,
  detailContent?: string,
  type?: CharacterMemoryEntry['type'],
  importance?: number,
): boolean {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  const summary = interactionSummary.length > 80 ? interactionSummary.slice(0, 80) + '…' : interactionSummary;

  if (summary.length < 2) return false;
  if (isDuplicate(summary, bank)) return false;

  const est = estimateSentiment(summary);
  state.addCharacterMemory(characterId, {
    type: type || 'event',
    content: detailContent || summary,
    summary,
    tags: [],
    valence: est.valence,
    arousal: est.arousal,
    importance: importance || 3,
    layer: 'daily',
  });
  // Auto-merge duplicates silently
  mergeSimilarMemories(characterId, 0.7);
  return true;
}
