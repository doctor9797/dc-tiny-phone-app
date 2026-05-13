import { CharacterMemoryEntry } from '../types';
import { useAppStore } from '../store';
import { generateAIResponse } from './ai';

// ── Phase 1: Hippocampus Memory Engine ──
// Inspired by Ombre-Brain weight pool mechanism

// ── Constants ──

/** Categories that never decay (decay_score permanently locked at max). */
const PERMANENT_CATEGORIES = new Set([
  'sop', 'infra', 'progress', 'feature_plan', 'lessons_learned', 'llm_routing', 'tts_config',
]);

/** Layer-specific λ decay rates. */
const LAMBDA: Record<string, number> = {
  deep:    0.05,  // core permanent info, ~14 day half-life
  daily:   0.05,  // daily conversations
  diary:   0.05,  // diary entries
  writing: 0.05,  // writing fragments
  ambient: 0.15,  // decorative/environmental, ~4.6 day half-life
};

const FORGET_THRESHOLD      = 0.15;
const MAX_MEMORIES_PER_CHAR = 50;
const DEHYDRATE_LENGTH      = 200; // chars — content longer than this gets dehydrated
const NORMALIZE             = 5;   // brings base_score into ~0-4 range

// ── Helpers ──

export function getLayerDecayRate(layer?: string): number {
  return LAMBDA[layer ?? 'daily'] ?? 0.05;
}

export function isPermanent(entry: CharacterMemoryEntry): boolean {
  return !!entry.category && PERMANENT_CATEGORIES.has(entry.category);
}

// ── Scoring ──

export function scoreMemory(entry: CharacterMemoryEntry): number {
  // Permanent entries never decay
  if (isPermanent(entry)) return 999;

  const now = Date.now();
  const daysSinceAccess = (now - entry.lastAccessedAt) / (1000 * 60 * 60 * 24);

  // Time weight curve (Ombre-Brain time_weight)
  //   day 0-1:  1.0
  //   day 2:    0.9
  //   day 2+:   max(0.3, 0.9 × e^(-0.2197 × (days-2)))
  let timeWeight: number;
  if (daysSinceAccess <= 1) {
    timeWeight = 1.0;
  } else if (daysSinceAccess <= 2) {
    timeWeight = 0.9;
  } else {
    timeWeight = Math.max(0.3, 0.9 * Math.exp(-0.2197 * (daysSinceAccess - 2)));
  }

  // Base score: importance × activation^0.3 × e^(-λ×days) × (1 + arousal^0.5) / normalize
  const λ = getLayerDecayRate(entry.layer);
  const activation = Math.pow(entry.accessCount, 0.3);
  const decay = Math.exp(-λ * daysSinceAccess);
  const emotion = 1 + Math.pow(entry.arousal, 0.5);
  const base = (entry.importance * activation * decay * emotion) / NORMALIZE;

  // Modifiers
  //   resolved=1 → ×0.05 (resolved issues sink)
  //   urgency (high-arousal, unresolved) → ×1.5 (urgent things float up)
  const resolvedMod = entry.resolved === 1 ? 0.05 : 1.0;
  const urgencyMod = (entry.arousal > 0.7 && entry.resolved !== 1) ? 1.5 : 1.0;

  return timeWeight * base * resolvedMod * urgencyMod;
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

  // Filter by importance
  if (options?.minImportance) {
    filtered = filtered.filter(m => m.importance >= options.minImportance!);
  }

  // Filter by type
  if (options?.types?.length) {
    filtered = filtered.filter(m => options.types!.includes(m.type));
  }

  // Keyword search
  if (options?.query?.trim()) {
    const q = options.query.toLowerCase();
    filtered = filtered.filter(m =>
      m.content.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      m.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // Score and sort
  const scored = filtered.map(m => ({ entry: m, score: scoreMemory(m) }));
  scored.sort((a, b) => b.score - a.score);

  const maxResults = options?.maxResults || 10;
  const topResults = scored.slice(0, maxResults);

  // ── Retrieval reinforcement ──
  // Each time a memory is retrieved, its activation_count rises,
  // making it decay slower ("the more you recall, the stronger it gets").
  const updateAccess = useAppStore.getState().updateCharacterMemoryAccess;
  for (const { entry } of topResults) {
    updateAccess(characterId, entry.id);
  }

  let selected = topResults.map(s => s.entry);

  // ── Sudden recall ──
  // When results are sparse (< maxResults), 40% chance to randomly
  // surface 1-3 additional old memories that didn't match the filters,
  // simulating "suddenly remembering something from long ago."
  if (topResults.length < maxResults && bank.length > topResults.length) {
    if (Math.random() < 0.4) {
      const count = Math.min(
        1 + Math.floor(Math.random() * 3), // 1-3
        maxResults - topResults.length,
      );
      const oldHits = bank
        .filter(m => !selected.some(s => s.id === m.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, count);

      for (const m of oldHits) {
        updateAccess(characterId, m.id); // reinforce the recall
      }
      selected = [...selected, ...oldHits];
    }
  }

  return selected;
}

export function getTopMemoriesForPrompt(
  characterId: string,
  maxTokens: number = 500
): string {
  const memories = getMemoriesForCharacter(characterId, { maxResults: 5 });
  if (!memories.length) return '';

  let result = '';
  let tokenEstimate = 0;

  for (const m of memories) {
    const displayContent = dehydrateContent(m.content, m.summary);
    const line = `[${m.type}] ${displayContent}`;
    const approxTokens = line.length / 2;
    if (tokenEstimate + approxTokens > maxTokens) break;
    result += line + '\n';
    tokenEstimate += approxTokens;
  }

  return result.trim();
}

// ── Dehydrator ──
// Long memories (>200 chars) get compressed to summary-only on retrieval,
// saving tokens while preserving full content in storage.

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

  try {
    const extracted = await generateAIResponse(
      `从以下对话中提取值得记住的信息点。如果没有值得记录的信息，返回"无"。

用户说：${userMessage}
${charName}回复：${characterReply}

值得记录的信息包括：
- 用户提到的个人事实（身份、爱好、经历、状态、计划等）
- 用户的偏好和感受（喜欢/不喜欢、情绪反应等）
- 重要的共同经历或事件
- 角色对用户的重要反馈或情感表达

要求：
1. 用一句话概括（15字以内）
2. 如果没有任何值得记录的信息，返回"无"
3. 不要输出任何多余内容

已有记忆摘要：
${bank.slice(0, 10).map(m => `- ${m.summary}`).join('\n')}`
    );

    const cleaned = extracted.replace(/[#*]/g, '').trim();
    if (cleaned && cleaned !== '无' && cleaned.length < 30 && !isDuplicate(cleaned, bank)) {
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
        characterId,
        type: isUserFact ? 'fact' : 'observation',
        content: `${userMessage}\n---\n${characterReply}`,
        summary: cleaned,
        tags: tags.filter(Boolean).slice(0, 5),
        valence: Math.max(0, Math.min(1, valence)),
        arousal: Math.max(0, Math.min(1, arousal)),
        importance: Math.max(1, Math.min(10, isUserFact ? 6 : 4)),
        layer: 'daily',
      });

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

  // Score all memories
  const scored = bank.map(m => ({ entry: m, score: scoreMemory(m) }));

  // Phase 1: remove memories below forget threshold (Ebbinghaus curve)
  const aboveThreshold = scored.filter(s => s.score >= FORGET_THRESHOLD);

  // Phase 2: keep top N by score
  aboveThreshold.sort((a, b) => b.score - a.score);
  const keep = aboveThreshold.slice(0, MAX_MEMORIES_PER_CHAR).map(s => s.entry);

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
