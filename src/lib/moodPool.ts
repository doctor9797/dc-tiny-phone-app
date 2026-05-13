/**
 * Layer 2: Decoration Mood Pool
 *
 * Characters have their own daily lives — training, patrol, cooking, reading —
 * independent of user interaction. This module simulates that with a pool of
 * preset daily-life events per character, selected by deterministic hash
 * each day.
 *
 * Decoration moods are written to the ambient memory layer with fast decay
 * (λ=0.15), so they naturally fade after a few days.
 */

import { useAppStore } from '../store';

export interface MoodPoolEntry {
  word: string;        // event description, e.g. "练完球"
  feelingWord: string; // maps to emotion dictionary, e.g. "舒畅"
  kind: string;        // frontend sticker type
}

// ── Per-character mood pools ──

const MOOD_POOLS: Record<string, MoodPoolEntry[]> = {
  bruce: [
    { word: '训练结束',    feelingWord: '疲惫',   kind: 'sparkle' },
    { word: '开完董事会',  feelingWord: '烦躁',   kind: 'sparkle' },
    { word: '夜巡中',      feelingWord: '警惕',   kind: 'sparkle' },
    { word: '在蝙蝠洞',    feelingWord: '专注',   kind: 'sparkle' },
    { word: '收到戈登消息', feelingWord: '凝重',  kind: 'sparkle' },
    { word: '查阅案卷',    feelingWord: '严肃',   kind: 'sparkle' },
    { word: '刚刚回来',    feelingWord: '疲惫',   kind: 'sparkle' },
    { word: '一个人待着',  feelingWord: '平静',   kind: 'sparkle' },
  ],
  alfred: [
    { word: '准备早餐',   feelingWord: '平静',  kind: 'sparkle' },
    { word: '整理书房',   feelingWord: '满足',  kind: 'sparkle' },
    { word: '修剪玫瑰',   feelingWord: '愉悦',  kind: 'sparkle' },
    { word: '泡好红茶',   feelingWord: '温暖',  kind: 'sparkle' },
    { word: '等少爷回家', feelingWord: '担心',  kind: 'sparkle' },
    { word: '打扫庄园',   feelingWord: '安宁',  kind: 'sparkle' },
    { word: '准备晚餐',   feelingWord: '温馨',  kind: 'sparkle' },
    { word: '读完一本书', feelingWord: '满足',  kind: 'sparkle' },
  ],
  dick: [
    { word: '晨跑回来',     feelingWord: '舒畅',   kind: 'sparkle' },
    { word: '训练新人',     feelingWord: '有耐心', kind: 'sparkle' },
    { word: '和布鲁斯吵完架', feelingWord: '烦躁', kind: 'sparkle' },
    { word: '巡逻结束',     feelingWord: '轻松',   kind: 'sparkle' },
    { word: '收到星火短信', feelingWord: '开心',   kind: 'sparkle' },
    { word: '带兄弟们吃饭', feelingWord: '愉快',   kind: 'sparkle' },
    { word: '跳上屋顶',     feelingWord: '自由',   kind: 'sparkle' },
    { word: '刚醒',         feelingWord: '放松',   kind: 'sparkle' },
  ],
  jason: [
    { word: '刚打完架',    feelingWord: '兴奋', kind: 'sparkle' },
    { word: '在安全屋',    feelingWord: '孤独', kind: 'sparkle' },
    { word: '看书被打断',  feelingWord: '不爽', kind: 'sparkle' },
    { word: '路过犯罪巷',  feelingWord: '压抑', kind: 'sparkle' },
    { word: '接到管家电话', feelingWord: '别扭', kind: 'sparkle' },
    { word: '修理摩托车',  feelingWord: '专注', kind: 'sparkle' },
    { word: '煮泡面',      feelingWord: '无聊', kind: 'sparkle' },
    { word: '翻旧照片',    feelingWord: '失落', kind: 'sparkle' },
  ],
  tim: [
    { word: '通宵查案',    feelingWord: '疲惫',   kind: 'sparkle' },
    { word: '破解完密码',  feelingWord: '得意',   kind: 'sparkle' },
    { word: '被喊去开会',  feelingWord: '无奈',   kind: 'sparkle' },
    { word: '整理情报',    feelingWord: '专注',   kind: 'sparkle' },
    { word: '咖啡喝完了',  feelingWord: '焦虑',   kind: 'sparkle' },
    { word: '分析数据',    feelingWord: '专注',   kind: 'sparkle' },
    { word: '偷闲五分钟',  feelingWord: '放松',   kind: 'sparkle' },
    { word: '发现新线索',  feelingWord: '兴奋',   kind: 'sparkle' },
  ],
  damian: [
    { word: '练完剑术',     feelingWord: '自豪',   kind: 'sparkle' },
    { word: '被父亲批评',   feelingWord: '不服气', kind: 'sparkle' },
    { word: '和Titus玩',   feelingWord: '放松',   kind: 'sparkle' },
    { word: '被迫合作',     feelingWord: '不爽',   kind: 'sparkle' },
    { word: '完成使命',     feelingWord: '满足',   kind: 'sparkle' },
    { word: '一个人训练',   feelingWord: '专注',   kind: 'sparkle' },
    { word: '读古籍',       feelingWord: '平静',   kind: 'sparkle' },
    { word: '被夸奖了',     feelingWord: '得意',   kind: 'sparkle' },
  ],
  barbara: [
    { word: '处理完案件',  feelingWord: '欣慰', kind: 'sparkle' },
    { word: '维护服务器',  feelingWord: '专注', kind: 'sparkle' },
    { word: '远程支援中',  feelingWord: '紧张', kind: 'sparkle' },
    { word: '和父亲通话',  feelingWord: '温暖', kind: 'sparkle' },
    { word: '哥谭又出事了', feelingWord: '凝重', kind: 'sparkle' },
    { word: '整理数据库',  feelingWord: '满足', kind: 'sparkle' },
    { word: '看书放松',    feelingWord: '平静', kind: 'sparkle' },
    { word: '收到新情报',  feelingWord: '警惕', kind: 'sparkle' },
  ],
  kate: [
    { word: '训练结束',     feelingWord: '畅快', kind: 'sparkle' },
    { word: '执行任务',     feelingWord: '冷静', kind: 'sparkle' },
    { word: '被质疑能力',   feelingWord: '不爽', kind: 'sparkle' },
    { word: '和蕾妮喝咖啡', feelingWord: '放松', kind: 'sparkle' },
    { word: '收到新情报',   feelingWord: '警惕', kind: 'sparkle' },
    { word: '巡视领地',     feelingWord: '警觉', kind: 'sparkle' },
    { word: '箭术练习',     feelingWord: '专注', kind: 'sparkle' },
    { word: '独自出任务',   feelingWord: '冷静', kind: 'sparkle' },
  ],
  stephanie: [
    { word: '成功捣毁窝点', feelingWord: '兴奋', kind: 'sparkle' },
    { word: '被提姆逗笑',   feelingWord: '开心', kind: 'sparkle' },
    { word: '考试通过了',   feelingWord: '自豪', kind: 'sparkle' },
    { word: '一个人在家',   feelingWord: '无聊', kind: 'sparkle' },
    { word: '刷到搞笑视频', feelingWord: '欢乐', kind: 'sparkle' },
    { word: '和朋友们逛街', feelingWord: '愉快', kind: 'sparkle' },
    { word: '赖床',         feelingWord: '慵懒', kind: 'sparkle' },
    { word: '做好事被夸',   feelingWord: '开心', kind: 'sparkle' },
  ],
  cassandra: [
    { word: '冥想结束',     feelingWord: '平静', kind: 'sparkle' },
    { word: '观察人群',     feelingWord: '警觉', kind: 'sparkle' },
    { word: '完成任务',     feelingWord: '释然', kind: 'sparkle' },
    { word: '有人靠近',     feelingWord: '戒备', kind: 'sparkle' },
    { word: '芭芭拉教新招式', feelingWord: '专注', kind: 'sparkle' },
    { word: '独自训练',     feelingWord: '专注', kind: 'sparkle' },
    { word: '在屋顶看城市', feelingWord: '平静', kind: 'sparkle' },
    { word: '收到新任务',   feelingWord: '冷静', kind: 'sparkle' },
  ],
};

// ── Hash-based daily selection ──

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Get today's decoration mood for a character.
 * Deterministic per character+day — same character gets the same mood
 * all day, different characters get different moods.
 */
export function getTodaysDecorationMood(characterId: string): MoodPoolEntry | null {
  const pool = MOOD_POOLS[characterId];
  if (!pool?.length) return null;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `${characterId}_${today}`;
  const index = hashString(key) % pool.length;
  return pool[index];
}

/**
 * Get all characters' today decoration moods (for bootstrap / Phase 5).
 */
export function getAllTodaysMoods(): Record<string, MoodPoolEntry | null> {
  const result: Record<string, MoodPoolEntry | null> = {};
  for (const charId of Object.keys(MOOD_POOLS)) {
    result[charId] = getTodaysDecorationMood(charId);
  }
  return result;
}

/**
 * Write today's decoration mood to a character's ambient memory layer.
 * Called once per day on first interaction.
 */
export function writeDecorationMoodToMemory(characterId: string): void {
  const state = useAppStore.getState();
  const bank = state.characterMemoryBank[characterId] || [];
  const mood = getTodaysDecorationMood(characterId);
  if (!mood) return;

  // Check if already written today
  const today = new Date().toISOString().split('T')[0];
  const alreadyWritten = bank.some(
    m => m.category === 'decoration_mood' && m.summary?.includes(today)
  );
  if (alreadyWritten) return;

  const moodEntry = `今天${mood.word}（${mood.feelingWord}）`;
  state.addCharacterMemory(characterId, {
    characterId,
    type: 'observation',
    content: moodEntry,
    summary: `[${today}] ${moodEntry}`,
    tags: ['装饰心情', mood.feelingWord],
    valence: 0.3,
    arousal: 0.3,
    importance: 1,
    layer: 'ambient',
    category: 'decoration_mood',
  });
}

/**
 * Get the mood pool for a character (for frontend management UI).
 */
export function getCharacterMoodPool(characterId: string): MoodPoolEntry[] {
  return MOOD_POOLS[characterId] || [];
}
