import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store';
import { generateAIResponse } from '../../lib/ai';
import { Heart, ChevronLeft, Save, Upload, RotateCw, BookOpen, Sword, Sparkles, Zap, AlertCircle, Plus, X } from 'lucide-react';

interface StorySegment {
  narrative: string;
  choices: string[];
  characterAffection: Record<string, number>;
  playerAffection?: Record<string, number>;
  playerChoice?: string;
  timestamp: number;
  parsedNarrative?: NarrativeSegment[];
}

interface PlayerPersona {
  name: string;
  age: string;
  profession: string;
  identity: string;
  appearance: string;
  experience: string;
}

interface CharacterStats {
  health: number;   // 健康值 0-100
  energy: number;   // 精力 0-100
  mood: number;     // 心情 0-100
}

interface NarrativeSegment {
  type: 'narration' | 'action' | 'character_dialogue' | 'player_dialogue';
  text: string;
  speakerName?: string;
}

interface HunterGameState {
  id: string;
  mode: 'chase' | 'being_chased';
  playerName: string;
  playerPersona: PlayerPersona;
  characterIds: string[];
  background: string;
  round: number;
  segments: StorySegment[];
  currentAffection: Record<string, number>;   // characters' feelings toward player
  playerAffection: Record<string, number>;     // player's feelings toward characters
  characterStats: Record<string, CharacterStats>;  // additional character stats
  playerStats: CharacterStats;                   // player's own stats (being_chased mode)
  flags: Record<string, any>;
  endingTitle: string;
  endingText: string;
  endingType: string;
  isFinished: boolean;
  createdAt: number;
  updatedAt: number;
}

interface SaveSlot {
  id: string;
  gameId: string;
  label: string;   // "存档A", "存档B"...
  game: HunterGameState;
  timestamp: number;
}

type View = 'menu' | 'setup' | 'game' | 'status' | 'saves' | 'load' | 'ending';

const SAVE_KEY = 'hunter-saves';
const AUTO_SAVE_KEY = 'hunter-autosave';

const getAffectionColor = (value: number) => {
  if (value >= 60) return 'text-red-400';
  if (value >= 20) return 'text-pink-400';
  if (value >= -19) return 'text-gray-400';
  if (value >= -60) return 'text-blue-400';
  return 'text-cyan-400';
};

const getAffectionLabel = (value: number) => {
  if (value >= 80) return '💕 倾心';
  if (value >= 50) return '💖 亲密';
  if (value >= 20) return '💗 好感';
  if (value >= -19) return '🤍 平淡';
  if (value >= -60) return '💙 冷淡';
  return '💔 憎恶';
};

// Multi-color stage helpers for bars and heart icons
const getStageColor = (value: number, type: 'bar' | 'heart' | 'text' = 'text'): string => {
  if (value >= 80) {
    return type === 'bar' ? 'bg-gradient-to-r from-pink-300 to-pink-400'
         : type === 'heart' ? 'text-red-500'
         : 'text-red-500';
  }
  if (value >= 50) {
    return type === 'bar' ? 'bg-gradient-to-r from-pink-400 to-pink-500'
         : type === 'heart' ? 'text-pink-400'
         : 'text-pink-400';
  }
  if (value >= 20) {
    return type === 'bar' ? 'bg-gradient-to-r from-pink-300 to-pink-400'
         : type === 'heart' ? 'text-pink-300'
         : 'text-pink-300';
  }
  if (value >= -19) {
    return type === 'bar' ? 'bg-gradient-to-r from-gray-300 to-gray-400'
         : type === 'heart' ? 'text-gray-400'
         : 'text-gray-400';
  }
  if (value >= -60) {
    return type === 'bar' ? 'bg-gradient-to-r from-blue-300 to-blue-400'
         : type === 'heart' ? 'text-blue-300'
         : 'text-blue-300';
  }
  return type === 'bar' ? 'bg-gradient-to-r from-cyan-400 to-blue-500'
       : type === 'heart' ? 'text-cyan-400'
       : 'text-cyan-400';
};

const getStatBarColor = (value: number): string => {
  if (value >= 80) return 'bg-gradient-to-r from-green-400 to-emerald-500';
  if (value >= 50) return 'bg-gradient-to-r from-green-300 to-green-400';
  if (value >= 30) return 'bg-gradient-to-r from-yellow-300 to-yellow-400';
  if (value >= 15) return 'bg-gradient-to-r from-orange-300 to-orange-400';
  return 'bg-gradient-to-r from-red-400 to-red-500';
};

const getStatLabel = (value: number): string => {
  if (value >= 80) return '良好';
  if (value >= 50) return '正常';
  if (value >= 30) return '偏低';
  if (value >= 15) return '较差';
  return '危险';
};

const getStatTextColor = (value: number): string => {
  if (value >= 80) return 'text-emerald-500';
  if (value >= 50) return 'text-green-400';
  if (value >= 30) return 'text-yellow-400';
  if (value >= 15) return 'text-orange-400';
  return 'text-red-500';
};

function parseAIResponse(text: string): { narrative: string; choices: string[] } {
  let narrative = '';
  let choices: string[] = [];

  // Try JSON format first
  try {
    const jsonMatch = text.match(/\{[\s\S]*"narrative"[\s\S]*"choices"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.narrative) narrative = parsed.narrative;
      if (Array.isArray(parsed.choices)) choices = parsed.choices.filter((c: any) => typeof c === 'string' && c.trim());
    }
  } catch {}

  // Try XML-like tags
  if (!narrative) {
    const narMatch = text.match(/<narrative>([\s\S]*?)<\/narrative>/);
    if (narMatch) narrative = narMatch[1].trim();
  }
  if (choices.length === 0) {
    const choicesMatch = text.match(/<choices>([\s\S]*?)<\/choices>/);
    if (choicesMatch) {
      choices = choicesMatch[1]
        .split(/\d+\./)
        .map(s => s.trim())
        .filter(Boolean);
    }
  }

  // Fallback: numbered choices at the end
  if (!narrative) {
    const lines = text.split('\n').filter(Boolean);
    const choiceLines: string[] = [];
    const narLines: string[] = [];
    let inChoices = false;
    for (const line of lines) {
      if (/^[1-4][\.\、\s]/.test(line) && line.length < 60) {
        choiceLines.push(line.replace(/^[1-4][\.\、\s]+/, '').trim());
        inChoices = true;
      } else if (!inChoices) {
        narLines.push(line);
      }
    }
    if (choiceLines.length >= 2) {
      choices = choiceLines;
      narrative = narLines.join('\n').trim();
    } else {
      narrative = text.replace(/<[^>]*>/g, '').trim();
    }
  }

  if (!narrative) narrative = text.replace(/<[^>]*>/g, '').trim();
  if (choices.length < 2) choices = ['继续', '询问更多', '保持沉默'].slice(0, 3);

  return { narrative, choices: choices.slice(0, 4) };
}

// Parse a line of narrative into structured segments (narration / action / character dialogue / player dialogue)
function parseNarrativeLine(
  line: string,
  charNames: string[],
  playerName: string,
): NarrativeSegment[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const results: NarrativeSegment[] = [];

  // Helper: check if text mentions a character by name
  const mentionsChar = (text: string) => charNames.some(n => text.includes(n));
  // Helper: check if text uses a pronoun that refers to a character (他/她)
  const isCharPronoun = (text: string) => /他|她|祂/.test(text);
  // Helper: check if the PLAYER is the speaker (我 = I/me as subject) — for dialogue attribution only
  const isPlayerSpeaker = (text: string) => text.includes('我') || text.includes(playerName);
  // Helper: check if text mentions the player (我/你/name) — for action vs narration classification
  const mentionsPlayer = (text: string) => text.includes('我') || text.includes('你') || text.includes(playerName);

  // Determine which character is referenced by pronoun or name
  const resolveSpeaker = (text: string): string | null => {
    const named = charNames.find(n => text.includes(n));
    if (named) return named;
    if (isCharPronoun(text) && charNames.length > 0) return charNames[0];
    return null;
  };

  // Classify a single text chunk as narration vs action vs dialogue
  const classifyChunk = (text: string): NarrativeSegment => {
    const t = text.trim();
    if (mentionsChar(t) && isSpeechLike(t)) {
      return { type: 'character_dialogue', text: t, speakerName: resolveSpeaker(t) || (charNames.length > 0 ? charNames[0] : undefined) };
    }
    if (mentionsChar(t) || mentionsPlayer(t) || isCharPronoun(t)) {
      return { type: 'action', text: t };
    }
    return { type: 'narration', text: t };
  };

  // Split text when it starts with narration before character action.
  // Only splits off a leading narration segment; the rest stays as action.
  const splitLeadingNarration = (text: string): NarrativeSegment[] => {
    const segs: NarrativeSegment[] = [];
    const sentences = text.match(/[^。！？]*[。！？]|[^。！？]+/g) || [text];
    let firstActionIdx = -1;
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i].trim();
      if (!s) continue;
      const isAction = mentionsChar(s) || mentionsPlayer(s) || isCharPronoun(s);
      if (isAction) {
        firstActionIdx = i;
        break;
      }
    }
    if (firstActionIdx > 0) {
      // Leading narration sentences → narration
      const narText = sentences.slice(0, firstActionIdx).join('').trim();
      if (narText) segs.push({ type: 'narration', text: narText });
      // Rest → action
      const restText = sentences.slice(firstActionIdx).join('').trim();
      if (restText) segs.push({ type: 'action', text: restText });
    } else {
      // No leading narration — classify as single chunk
      segs.push(classifyChunk(text));
    }
    return segs;
  };

  // Check if text is purely a scene/environment description (no character involved)
  const isPureNarration = (text: string): boolean => {
    return !mentionsChar(text) && !mentionsPlayer(text) && !isCharPronoun(text);
  };

  // Check if text sounds like dialogue (has speech verbs like 说/道/问/告诉/回答)
  const isSpeechLike = (text: string): boolean => {
    return /[说曰道问答告诉回答解释喊叫骂称赞劝安慰承诺拒绝承认否认吩咐叮嘱提醒][了着过]?[：，,:：]/.test(text) || /[说曰道]/.test(text);
  };

  // Full-line quote 「...」 — check if it's narration rather than dialogue
  const fullQuoteMatch = trimmed.match(/^[「""](.+?)[」""]$/);
  if (fullQuoteMatch) {
    const inner = fullQuoteMatch[1].trim();
    if (isPureNarration(inner)) {
      results.push({ type: 'narration', text: inner });
    } else if (inner.startsWith('我') || (playerName && inner.includes(playerName))) {
      results.push({ type: 'player_dialogue', text: inner, speakerName: playerName });
    } else {
      results.push({ type: 'character_dialogue', text: inner, speakerName: resolveSpeaker(inner) || charNames[0] });
    }
    return results;
  }

  // Anything before 「dialogue」at end: "叶奈法微微一笑，「你好」"
  const dialogueMatch = trimmed.match(/^(.+?)[「""](.+?)[」""]$/);
  if (dialogueMatch) {
    const beforeQuote = dialogueMatch[1].trim();
    const dialogueText = dialogueMatch[2].trim();

    if (beforeQuote) {
      results.push(...splitLeadingNarration(beforeQuote));

      if (isPlayerSpeaker(beforeQuote) && !mentionsChar(beforeQuote) && !isCharPronoun(beforeQuote)) {
        results.push({ type: 'player_dialogue', text: dialogueText, speakerName: playerName });
      } else {
        const who = resolveSpeaker(beforeQuote);
        results.push({ type: 'character_dialogue', text: dialogueText, speakerName: who || charNames[0] });
      }
    } else {
      if (dialogueText.startsWith('我') || (playerName && dialogueText.includes(playerName))) {
        results.push({ type: 'player_dialogue', text: dialogueText, speakerName: playerName });
      } else {
        results.push({ type: 'character_dialogue', text: dialogueText, speakerName: charNames[0] });
      }
    }
    return results;
  }

  // Lines with quotes somewhere (not at end): 「你好」叶奈法说
  if (trimmed.includes('「') || trimmed.includes('」') || /["""]/.test(trimmed)) {
    const quoteContent = trimmed.match(/[「""](.+?)[」""]/);
    if (quoteContent) {
      const beforeQuote = trimmed.substring(0, trimmed.indexOf(quoteContent[0])).trim();
      const afterQuote = trimmed.substring(trimmed.indexOf(quoteContent[0]) + quoteContent[0].length).trim();
      const dialogueText = quoteContent[1];

      if (beforeQuote) {
        results.push(...splitLeadingNarration(beforeQuote));
        if (isPlayerSpeaker(beforeQuote) && !mentionsChar(beforeQuote) && !isCharPronoun(beforeQuote)) {
          results.push({ type: 'player_dialogue', text: dialogueText, speakerName: playerName });
        } else {
          const who = resolveSpeaker(beforeQuote);
          results.push({ type: 'character_dialogue', text: dialogueText, speakerName: who || charNames[0] });
        }
      } else if (isPureNarration(dialogueText)) {
        // 「环境描写」with no attribution → narration
        results.push({ type: 'narration', text: dialogueText });
      } else if (dialogueText.startsWith('我') || (playerName && dialogueText.includes(playerName))) {
        results.push({ type: 'player_dialogue', text: dialogueText, speakerName: playerName });
      } else {
        results.push({ type: 'character_dialogue', text: dialogueText, speakerName: charNames[0] });
      }

      if (afterQuote) {
        results.push(classifyChunk(afterQuote));
      }
    } else {
      results.push(classifyChunk(trimmed));
    }
    return results;
  }

  // No quotes at all — split leading narration like dialogue path
  if (mentionsChar(trimmed) || mentionsPlayer(trimmed) || isCharPronoun(trimmed)) {
    results.push(...splitLeadingNarration(trimmed));
  } else {
    results.push({ type: 'narration', text: trimmed });
  }

  return results;
}


export default function HunterApp() {
  const { settings, characters, closeApp } = useAppStore();
  const [view, setView] = useState<View>('menu');
  const [game, setGame] = useState<HunterGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showAffectionPanel, setShowAffectionPanel] = useState(false);
  const [showCharAffectionPanel, setShowCharAffectionPanel] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Setup state
  const [setupMode, setSetupMode] = useState<'chase' | 'being_chased'>('chase');
  const [setupCharacters, setSetupCharacters] = useState<string[]>([]);
  const [setupBackground, setSetupBackground] = useState('');
  const [setupPlayerName, setSetupPlayerName] = useState('');
  const [useSystemPersona, setUseSystemPersona] = useState(true);
  const [customPersona, setCustomPersona] = useState<PlayerPersona>({
    name: '', age: '', profession: '', identity: '', appearance: '', experience: '',
  });

  // Save/Load state
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
    } catch { return []; }
  });
  const [deleteTarget, setDeleteTarget] = useState<{ slotId: string; label: string; isAutoSave?: boolean } | null>(null);

  // Predefined slot labels
  const SLOT_LABELS = ['存档A', '存档B', '存档C', '存档D', '存档E', '存档F'];

  const storyEndRef = useRef<HTMLDivElement>(null);

  // Force light pink theme — never dark
  const isDark = false;
  const bg = 'bg-pink-100';
  const cardBg = 'bg-white/80';
  const textColor = 'text-slate-800';
  const subText = 'text-gray-500';
  const inputBg = 'bg-gray-50 border-gray-200 text-slate-800';
  const sakuraBtnBg = { background: 'rgba(251,207,232,0.55)', backdropFilter: 'blur(12px) saturate(150%)' as const, textShadow: '0 1px 4px rgba(0,0,0,0.35)' };

  useEffect(() => {
    storyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [game?.segments]);

  const availableCharacters = Object.values(characters).filter(c => c.isWeChatFriend !== false);

  const getCharacterById = useCallback((id: string) => characters[id], [characters]);

  // Analyze choice text for affection change
  // Rule: can drop sharply (-2 possible) but can NOT increase sharply (max +1, very rare)
  const getAffectionChange = (choice: string | undefined): number => {
    if (!choice) return 0;
    const strongPos = ['告白', '表白', '我爱你', '喜欢你', '好喜欢你', '最爱', '永远'];
    const mildPos = ['好', '是', '嗯', '帮忙', '帮助', '关心', '温柔', '友善', '答应', '陪', '谢谢', '可以', '开心', '愿意', '一起', '微笑', '承诺', '抱', '牵'];
    const strongNeg = ['滚', '恨', '讨厌', '恶心', '走开', '去死'];
    const mildNeg = ['不', '别', '不要', '拒绝', '离开', '烦', '停', '算了', '不必', '讨厌你', '滚开'];

    let score = 0;
    if (strongPos.some(w => choice.includes(w))) score += 2;
    else if (mildPos.some(w => choice.includes(w))) score += 1;
    if (strongNeg.some(w => choice.includes(w))) score -= 2;
    else if (mildNeg.some(w => choice.includes(w))) score -= 1;

    const r = Math.random();
    // ❤️ Increases: capped at +1 with very low probability
    if (score >= 2) return r < 0.05 ? 1 : 0;
    if (score === 1) return r < 0.1 ? 1 : 0;
    if (score === 0) return r < 0.1 ? (Math.random() < 0.5 ? 1 : -1) : 0;
    // 💔 Drops: can be sharp (-2 possible, higher chance than before)
    if (score === -1) return r < 0.4 ? -1 : 0;
    return r < 0.25 ? -2 : (r < 0.65 ? -1 : 0);
  };

  const generateStory = useCallback(async (currentGame: HunterGameState, playerChoice?: string) => {
    setLoading(true);
    setError('');
    setShowCustomInput(false);

    try {
      const charInfos = currentGame.characterIds.map(id => {
        const c = characters[id];
        return c ? `${c.name}（性格: ${c.personality}，与你的关系: ${c.relationship}）` : id;
      }).join('\n');

      const affectionStr = currentGame.characterIds.map(id => {
        const c = characters[id];
        const val = currentGame.currentAffection[id] ?? 0;
        return `${c?.name || id}: 好感度${val}/100（${getAffectionLabel(val)}）`;
      }).join('\n');

      const playerAffectionStr = currentGame.characterIds.map(id => {
        const c = characters[id];
        const val = currentGame.playerAffection[id] ?? 0;
        return `${c?.name || id}: 你对TA的好感度${val}/100`;
      }).join('\n');

      const historyStr = currentGame.segments.slice(-6).map(s => {
        const choicePart = s.playerChoice ? `\n你的选择: ${s.playerChoice}` : '';
        return `【剧情】${s.narrative}${choicePart}`;
      }).join('\n\n');

      let modeDesc = currentGame.mode === 'chase'
        ? `你正在主动追求/攻略这些角色，你的目标是赢得他们的好感。`
        : `你正在被这些角色追求/攻略，他们对你有不同程度的好感。`;

      let endingCheck = '';
      const maxRounds = 15;
      const minRounds = 6;
      const round = currentGame.round;
      if (round >= maxRounds) {
        endingCheck = '\n这是最终回合。请为这个故事写一个结局。根据角色好感度和故事发展决定结局类型：happy_ending（好结局）, normal_ending（普通结局）, bad_ending（坏结局）。在结局后不要提供选择。';
      } else if (round >= minRounds) {
        const highAff = Object.entries(currentGame.currentAffection).filter(([, v]) => v >= 70).length;
        const lowAff = Object.entries(currentGame.currentAffection).filter(([, v]) => v <= 20).length;
        if (highAff === currentGame.characterIds.length) {
          endingCheck = '\n所有角色好感度都很高。请为这个故事写一个完美结局（happy_ending）。在结局后不要提供选择。';
        } else if (lowAff === currentGame.characterIds.length) {
          endingCheck = '\n所有角色好感度都很低。请为这个故事写一个失败结局（bad_ending）。在结局后不要提供选择。';
        }
      }

      const prompt = `你是一个文字恋爱游戏(GALGAME)的叙述者（旁白/系统）。请根据以下游戏状态，续写一段剧情并提供选择。

## 故事背景
${currentGame.background || '一个普通的世界'}

## 你的身份
${currentGame.mode === 'chase' ? '你是追求者。' : '你是被追求的对象。'}
${(() => {
  const p = currentGame.playerPersona;
  const parts: string[] = [];
  if (p.age) parts.push(`年龄: ${p.age}`);
  if (p.profession) parts.push(`职业: ${p.profession}`);
  if (p.identity) parts.push(`身份: ${p.identity}`);
  if (p.appearance) parts.push(`外貌: ${p.appearance}`);
  if (p.experience) parts.push(`经历: ${p.experience}`);
  return parts.length ? parts.join('\n') : '一个普通人';
})()}

## 模式
${modeDesc}

## 角色信息
${charInfos}

## 当前好感度（角色对你的感觉）
${affectionStr}

## 你对角色的好感度
${playerAffectionStr}

## 游戏进程
- 当前回合: 第${currentGame.round + 1}回合
- 最大回合数: ${maxRounds}

## 之前的剧情
${historyStr || '故事还没有开始，请写一个开场剧情。'}

${playerChoice ? `## 玩家上一轮的选择\n${playerChoice}\n请根据这个选择推进剧情。` : ''}
${endingCheck}

## 要求
1. 以旁白/叙述者的身份写一段剧情（100-250字），描写场景、环境和角色的动作、对话、神态
2. 剧情要能体现角色的性格，并且根据好感度不同，角色的态度应有明显区别（好感度高则亲近，好感度低则疏远冷淡）
3. 禁止描写角色的内心想法和心理活动！只能通过角色的动作、神态、对话和外在表现来展现角色。读者只能看到角色说了什么和做了什么，不能看到角色的内心。
4. **所有对话必须用「」标记**，并且写清楚说话者是谁。例如：叶奈法微微一笑，「你来了。」 或 我说，「好的，我这就过去。」
5. 提供2-4个让玩家选择的选项，选项应推动剧情或影响好感度
6. 如果有结局，不要提供选择，直接写结局内容并在结尾标注【ENDING:类型】

## 输出格式
请严格使用以下JSON格式（不要其他内容）：
{
  "narrative": "一段完整的剧情文本（包含旁白、动作、对话），可读性强",
  "segments": [
    {"type": "narration", "text": "纯场景环境描写，不涉及任何角色具体动作"},
    {"type": "action", "text": "角色或玩家的动作/神态/行为描写", "speaker": "角色名（如果是角色相关动作）"},
    {"type": "dialogue", "text": "角色说的对话", "speaker": "角色名"},
    {"type": "dialogue", "text": "我（玩家）说的对话", "speaker": "玩家名"}
  ],
  "choices": ["选项一", "选项二", "选项三"]
}

segments中每条的类型说明：
- narration: 纯场景/环境描写，没有角色动作
- action: 角色的动作、神态、行为（有角色参与但没有对话）
- dialogue: 角色的对话（必须明确 speaker 是谁）
- 玩家的对话用 type=dialogue + speaker=玩家名

注意：segments 应该覆盖 narrative 中的全部内容，但以结构化方式呈现。
segments 数组长度至少2条，最多8条，每条 text 10-80字。`;

      const result = await generateAIResponse(prompt, '你是一个GALGAME文字游戏的叙述者。请用中文创作。重要的剧情选择会影响角色好感度和故事走向。禁止描写角色的内心想法和心理活动，只能描写角色看得见的动作、神态、对话和外在表现。');
      const { narrative, choices } = parseAIResponse(result);

      // Parse structured segments from JSON response
      let parsedNarrative: NarrativeSegment[] | undefined = undefined;
      try {
        const jsonMatch = result.match(/\{[\s\S]*"segments"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.segments)) {
            parsedNarrative = parsed.segments
              .filter((s: any) => s && s.type && s.text)
              .map((s: any) => {
                if (s.type === 'dialogue') {
                  const isPlayer = s.speaker === currentGame.playerName || s.speaker === '我' || s.text.startsWith('我');
                  return {
                    type: isPlayer ? 'player_dialogue' as const : 'character_dialogue' as const,
                    text: s.text,
                    speakerName: isPlayer ? currentGame.playerName : s.speaker,
                  };
                }
                if (s.type === 'action') {
                  return { type: 'action' as const, text: s.text, speakerName: s.speaker };
                }
                return { type: 'narration' as const, text: s.text };
              });
            if (parsedNarrative.length === 0) parsedNarrative = undefined;
          }
        }
      } catch {}

      // Check for ending
      const isEnding = result.includes('【ENDING:') || result.includes('ENDING:') || !choices || choices.length === 0 || round >= maxRounds;
      let endingType = '';
      let endingTitle = '';
      let endingText = '';

      if (isEnding) {
        if (result.includes('happy_ending') || result.includes('好结局') || result.includes('HE')) {
          endingType = 'happy';
          endingTitle = '好结局 💕';
        } else if (result.includes('bad_ending') || result.includes('坏结局') || result.includes('BE')) {
          endingType = 'bad';
          endingTitle = '坏结局 💔';
        } else {
          endingType = 'normal';
          endingTitle = '普通结局 🤍';
        }
        endingText = narrative;

        // Small ending affection adjustment
        const newAffection = { ...currentGame.currentAffection };
        const newPlayerAffection = { ...(currentGame.playerAffection || currentGame.currentAffection) };
        currentGame.characterIds.forEach(id => {
          const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
          newAffection[id] = Math.max(-100, Math.min(100, (newAffection[id] ?? 0) + change));
          newPlayerAffection[id] = Math.max(-100, Math.min(100, (newPlayerAffection[id] ?? 0) + Math.floor(Math.random() * 3) - 1));
        });

        const finalSegment: StorySegment = {
          narrative,
          choices: [],
          characterAffection: { ...newAffection },
          playerAffection: { ...newPlayerAffection },
          timestamp: Date.now(),
        };

        setGame({
          ...currentGame,
          round: round + 1,
          segments: [...currentGame.segments, finalSegment],
          currentAffection: newAffection,
          characterStats: currentGame.characterStats,
          endingTitle,
          endingText,
          endingType,
          isFinished: true,
          updatedAt: Date.now(),
        });
        setView('ending');
        setLoading(false);
        return;
      }

      // Calculate small affection changes based on player's choice
      const affChanges: Record<string, number> = {};
      currentGame.characterIds.forEach(id => {
        const change = getAffectionChange(playerChoice);
        // Add small personality-based variance: different chars react slightly differently
        const personality = characters[id]?.personality || '';
        const variance = personality.includes('傲') || personality.includes('冷') || personality.includes('沉默') ? -1
                       : personality.includes('阳光') || personality.includes('开朗') || personality.includes('温柔') ? 1 : 0;
        affChanges[id] = Math.max(-2, Math.min(2, change + (variance !== 0 && Math.random() < 0.4 ? variance : 0)));
      });

      // Player's own affection changes (slower, only when choice clearly signals)
      const playerAffChanges: Record<string, number> = {};
      currentGame.characterIds.forEach(id => {
        // Only change player affection if playerChoice has strong signals
        const change = getAffectionChange(playerChoice);
        // Player affection moves even slower: cap at 1, mostly 0
        const r = Math.random();
        let final = 0;
        if (change === 2) final = r < 0.15 ? 1 : 0;
        else if (change === 1) final = r < 0.1 ? 1 : 0;
        else if (change === -1) final = r < 0.1 ? -1 : 0;
        else if (change <= -2) final = r < 0.15 ? -1 : 0;
        playerAffChanges[id] = final;
      });

      // Compute choice context for stat changes
      const choiceContext = {
        healthDelta: 0,
      };
      if (playerChoice) {
        if (/救|治疗|药|医生|医院|休息/.test(playerChoice)) choiceContext.healthDelta = 3;
        else if (/伤|打|斗|战|累/.test(playerChoice)) choiceContext.healthDelta = -3;
      }

      const newAffection = { ...currentGame.currentAffection };
      const newPlayerAffection = { ...(currentGame.playerAffection || currentGame.currentAffection) };
      const newStats = { ...(currentGame.characterStats || {}) };
      currentGame.characterIds.forEach(id => {
        newAffection[id] = Math.max(-100, Math.min(100, (newAffection[id] ?? 0) + (affChanges[id] || 0)));
        newPlayerAffection[id] = Math.max(-100, Math.min(100, (newPlayerAffection[id] ?? 0) + (playerAffChanges[id] || 0)));
        // Stats fluctuate based on choice context
        if (newStats[id]) {
          const nudge = (Math.random() < 0.3 ? (Math.random() < 0.5 ? -2 : 2) : 0);
          newStats[id] = {
            health: Math.max(0, Math.min(100, (newStats[id]?.health ?? 60) + choiceContext.healthDelta)),
            energy: Math.max(0, Math.min(100, (newStats[id]?.energy ?? 60) + nudge)),
            mood: Math.max(0, Math.min(100, (newStats[id]?.mood ?? 60) + (affChanges[id] || 0) * 3)),
          };
        }
      });

      const segment: StorySegment = {
        narrative,
        choices,
        characterAffection: { ...newAffection },
        playerAffection: { ...newPlayerAffection },
        playerChoice,
        timestamp: Date.now(),
        parsedNarrative,
      };

      const updatedGame = {
        ...currentGame,
        round: round + 1,
        segments: [...currentGame.segments, segment],
        currentAffection: newAffection,
        playerAffection: newPlayerAffection,
        characterStats: newStats,
        updatedAt: Date.now(),
      };

      setGame(updatedGame);
      // Auto-save (only if no manual save exists for this game)
      try {
        const existingSaves: SaveSlot[] = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
        if (!existingSaves.some((s: SaveSlot) => s.gameId === currentGame.id)) {
          localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(updatedGame));
        }
      } catch {}
    } catch (e: any) {
      setError(e?.message || '生成剧情失败，请重试');
    }

    setLoading(false);
  }, [characters]);

  const handleStartGame = async () => {
    if (setupCharacters.length === 0) {
      setError('请至少选择一个角色');
      return;
    }

    const initialAffection: Record<string, number> = {};
    const initialPlayerAffection: Record<string, number> = {};
    const initialStats: Record<string, CharacterStats> = {};
    setupCharacters.forEach(id => {
      initialAffection[id] = setupMode === 'chase' ? 5 + Math.floor(Math.random() * 11) : 60 + Math.floor(Math.random() * 11);
      initialPlayerAffection[id] = setupMode === 'chase' ? 60 + Math.floor(Math.random() * 11) : 5 + Math.floor(Math.random() * 11);
      initialStats[id] = {
        health: 60 + Math.floor(Math.random() * 31),
        energy: 50 + Math.floor(Math.random() * 31),
        mood: 50 + Math.floor(Math.random() * 31),
      };
    });

    const persona: PlayerPersona = useSystemPersona
      ? { ...settings.persona, name: setupPlayerName || settings.persona.name || settings.wechatName || '我' }
      : { ...customPersona, name: setupPlayerName || customPersona.name || '我' };

    const initialPlayerStats: CharacterStats = {
      health: 70 + Math.floor(Math.random() * 21),
      energy: 60 + Math.floor(Math.random() * 21),
      mood: 60 + Math.floor(Math.random() * 21),
    };

    const newGame: HunterGameState = {
      id: Date.now().toString(),
      mode: setupMode,
      playerName: persona.name,
      playerPersona: persona,
      characterIds: setupCharacters,
      background: setupBackground || '一个普通的世界',
      round: 0,
      segments: [],
      currentAffection: initialAffection,
      playerAffection: initialPlayerAffection,
      characterStats: initialStats,
      playerStats: initialPlayerStats,
      flags: {},
      endingTitle: '',
      endingText: '',
      endingType: '',
      isFinished: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setGame(newGame);
    setView('game');
    await generateStory(newGame);
  };

  const handleChoice = async (choice: string) => {
    if (!game || loading) return;
    // Update flags based on choice keywords
    const newFlags = { ...game.flags };
    if (choice.includes('告白') || choice.includes('表白') || choice.includes('我爱你')) newFlags.confessed = true;
    if (choice.includes('拒绝') || choice.includes('离开') || choice.includes('分手')) newFlags.rejected = true;
    if (choice.includes('帮忙') || choice.includes('帮助') || choice.includes('救')) newFlags.helped = true;
    if (choice.includes('礼物') || choice.includes('送')) newFlags.gifted = true;
    if (choice.includes('牵手') || choice.includes('拥抱') || choice.includes('吻')) newFlags.physical = true;

    const updatedGame = { ...game, flags: newFlags };
    setGame(updatedGame);
    await generateStory(updatedGame, choice);
  };

  const handleCustomSubmit = async () => {
    if (!game || loading || !customInput.trim()) return;
    setGame({ ...game, flags: { ...game.flags, customAction: true } });
    await generateStory(game, customInput.trim());
    setCustomInput('');
  };

  const adjustPlayerAffection = (characterId: string, delta: number) => {
    if (!game || game.mode !== 'being_chased') return;
    const current = game.playerAffection[characterId] ?? 0;
    const newVal = Math.max(-100, Math.min(100, current + delta));
    const newPlayerAffection = { ...game.playerAffection, [characterId]: newVal };
    const newSegments = [...game.segments];
    if (newSegments.length > 0) {
      newSegments[newSegments.length - 1] = {
        ...newSegments[newSegments.length - 1],
        playerAffection: { ...(newSegments[newSegments.length - 1].playerAffection || {}), [characterId]: newVal },
      };
    }
    setGame({ ...game, playerAffection: newPlayerAffection, segments: newSegments, updatedAt: Date.now() });
  };

  const handleSaveToSlot = (label: string) => {
    if (!game) return;
    const existing = saveSlots.find(s => s.gameId === game.id && s.label === label);
    const newSlot: SaveSlot = {
      id: existing?.id || `${game.id}_${label}`,
      gameId: game.id,
      label,
      game: { ...game },
      timestamp: Date.now(),
    };
    const updated = existing
      ? saveSlots.map(s => s.id === newSlot.id ? newSlot : s)
      : [...saveSlots, newSlot];
    setSaveSlots(updated);
    localStorage.setItem(SAVE_KEY, JSON.stringify(updated));
    setView('game');
  };

  const handleLoadSlot = (slot: SaveSlot) => {
    setGame(slot.game);
    setView('game');
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.isAutoSave) {
      localStorage.removeItem(AUTO_SAVE_KEY);
    } else {
      const updated = saveSlots.filter(s => s.id !== deleteTarget.slotId);
      setSaveSlots(updated);
      localStorage.setItem(SAVE_KEY, JSON.stringify(updated));
    }
    setDeleteTarget(null);
  };

  const handleNewGame = () => {
    setGame(null);
    setSetupCharacters([]);
    setSetupBackground('');
    setSetupPlayerName('');
    setUseSystemPersona(true);
    setCustomPersona({ name: '', age: '', profession: '', identity: '', appearance: '', experience: '' });
    setError('');
    setView('menu');
  };

  const toggleCharacter = (id: string) => {
    setSetupCharacters(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const renderBack = (onClick: () => void) => (
    <button onClick={onClick} className="w-8 h-8 flex items-center -ml-2 text-gray-500">
      <ChevronLeft size={24} />
    </button>
  );

  // ===== VIEW: MENU =====
  if (view === 'menu') {
    return (
      <div className={`h-full flex flex-col max-w-full overflow-x-hidden ${bg}`}>
        <div className={`flex-1 flex flex-col items-center justify-center p-8`}>
          <div className="text-6xl mb-4">💘</div>
          <h1 className={`text-3xl font-bold mb-2 ${textColor}`}>猎心</h1>
          <p className={`text-sm mb-10 ${subText}`}>GALGAME 文字恋爱模拟</p>

          <button
            onClick={() => setView('setup')}
            className="w-full max-w-[240px] py-4 backdrop-blur-md text-white font-bold rounded-2xl shadow-lg mb-4 hover:scale-105 transition-transform"
            style={sakuraBtnBg}
          >
            开始新游戏
          </button>

          {/* 继续游戏（从自动存档恢复） */}
          {(() => {
            try {
              const auto = localStorage.getItem(AUTO_SAVE_KEY);
              if (auto) {
                const data = JSON.parse(auto);
                return (
                  <button
                    onClick={() => {
                      setGame(data);
                      setView('game');
                    }}
                    className="w-full max-w-[240px] py-4 backdrop-blur-md text-white font-bold rounded-2xl shadow-lg mb-4 hover:scale-105 transition-transform"
                    style={sakuraBtnBg}
                  >
                    继续游戏（第{data.round}回合）
                  </button>
                );
              }
            } catch {}
            return null;
          })()}

          <button
            onClick={() => setView('load')}
            className="w-full max-w-[240px] py-4 bg-white/10 border border-white/20 text-pink-300 font-bold rounded-2xl mb-4 hover:bg-white/20 transition-colors"
          >
            读取存档
          </button>

          <button
            onClick={closeApp}
            className={`text-sm ${subText} hover:text-gray-300 transition-colors`}
          >
            返回桌面
          </button>

        </div>
      </div>
    );
  }

  // ===== VIEW: SETUP =====
  if (view === 'setup') {
    return (
      <div className={`h-full flex flex-col max-w-full overflow-x-hidden ${bg}`}>
        <div className={`relative flex items-center justify-center px-4 pt-7 pb-4 border-b border-white/5 shrink-0 ${cardBg}`}>
          <div className="absolute left-4">{renderBack(() => setView('menu'))}</div>
          <h1 className={`text-lg font-bold text-ellipsis overflow-hidden whitespace-nowrap ${textColor}`}>新游戏设置</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-full">
          {error && (
            <div className="flex items-start gap-2 text-red-500 text-sm bg-red-500/10 p-3 rounded-xl max-w-full">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="break-words min-w-0">{error}</span>
            </div>
          )}

          {/* Mode selection */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
            <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-3`}>游戏模式</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSetupMode('chase')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  setupMode === 'chase'
                    ? 'border-pink-300/50 bg-pink-200/30'
                    : `border-transparent ${isDark ? 'bg-white/5' : 'bg-gray-50'}`
                }`}
              >
                <Sword size={24} className="mx-auto mb-2 text-pink-400" />
                <div className={`text-sm font-bold ${textColor}`}>攻略</div>
                <div className={`text-xs ${subText}`}>主动追求角色</div>
              </button>
              <button
                onClick={() => setSetupMode('being_chased')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  setupMode === 'being_chased'
                    ? 'border-pink-300/50 bg-pink-200/30'
                    : `border-transparent ${isDark ? 'bg-white/5' : 'bg-gray-50'}`
                }`}
              >
                <Heart size={24} className="mx-auto mb-2 text-pink-300" />
                <div className={`text-sm font-bold ${textColor}`}>被攻略</div>
                <div className={`text-xs ${subText}`}>被角色追求</div>
              </button>
            </div>
          </div>

          {/* Player name */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
            <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-3`}>你的名字</h2>
            <input
              type="text"
              value={setupPlayerName}
              onChange={e => setSetupPlayerName(e.target.value)}
              placeholder={settings.wechatName || '输入你的名字'}
              className={`w-full border rounded-xl p-3 text-sm outline-none focus:border-pink-300/50 transition-colors ${inputBg}`}
            />
          </div>

          {/* Persona / 身份设定 */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>身份设定</h2>
              <button
                onClick={() => setUseSystemPersona(!useSystemPersona)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  useSystemPersona
                    ? 'bg-pink-200/40 text-pink-400'
                    : `${isDark ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-slate-600'}`
                }`}
              >
                {useSystemPersona ? '✓ 使用系统身份' : '自定义身份'}
              </button>
            </div>

            {useSystemPersona ? (
              <div className={`text-sm space-y-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <p>年龄: {settings.persona.age || '未设置'}</p>
                <p>职业: {settings.persona.profession || '未设置'}</p>
                <p>身份: {settings.persona.identity || '未设置'}</p>
                <p>外貌: {settings.persona.appearance || '未设置'}</p>
                <p>经历: {settings.persona.experience || '未设置'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {([
                  { key: 'age', label: '年龄', placeholder: '例如: 22岁' },
                  { key: 'profession', label: '职业', placeholder: '例如: 大学生' },
                  { key: 'identity', label: '身份', placeholder: '例如: 普通市民 / 义警助手' },
                  { key: 'appearance', label: '外貌', placeholder: '例如: 黑发蓝眼，身材修长' },
                  { key: 'experience', label: '经历', placeholder: '例如: 从小在哥谭长大...' },
                ] as const).map(field => (
                  <div key={field.key}>
                    <label className={`block text-xs ${subText} mb-1`}>{field.label}</label>
                    <input
                      type="text"
                      value={(customPersona as any)[field.key]}
                      onChange={e => setCustomPersona(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className={`w-full border rounded-xl p-3 text-sm outline-none focus:border-pink-300/50 transition-colors ${inputBg}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Character selection */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
            <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-3`}>
              {setupMode === 'chase' ? '选择攻略对象（可多选）' : '选择追求你的角色（可多选）'}
            </h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {availableCharacters.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCharacter(c.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    setupCharacters.includes(c.id)
                      ? 'border-pink-300/50 bg-pink-200/30'
                      : `border-transparent ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg shrink-0"
                    style={{
                      background: c.avatar?.startsWith('#') ? c.avatar : `url(${c.avatar || ''}) center/cover`,
                    }}
                  />
                  <div className="text-left flex-1">
                    <div className={`text-sm font-medium ${textColor}`}>{c.name}</div>
                    <div className={`text-xs ${subText}`}>{c.relationship}</div>
                  </div>
                  {setupCharacters.includes(c.id) && (
                    <div className="w-6 h-6 rounded-full bg-pink-300 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </button>
              ))}
              {availableCharacters.length === 0 && (
                <p className={`text-sm ${subText}`}>暂无可用角色</p>
              )}
            </div>
          </div>

          {/* Background */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
            <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-3`}>故事背景</h2>
            <textarea
              value={setupBackground}
              onChange={e => setSetupBackground(e.target.value)}
              placeholder={`例如：你们是大学同学，在校园里经常相遇的故事...
或者：你们是同事，在同一个公司上班的故事...
或者：自定义任何你想玩的故事背景`}
              className={`w-full border rounded-xl p-3 text-sm outline-none focus:border-pink-300/50 transition-colors resize-none h-24 ${inputBg}`}
            />
          </div>

          <button
            onClick={handleStartGame}
            disabled={setupCharacters.length === 0}
            className={`w-full py-4 rounded-2xl font-bold text-white transition-all backdrop-blur-md ${
              setupCharacters.length > 0
                ? 'hover:scale-[1.02] shadow-lg'
                : 'bg-gray-500/50 cursor-not-allowed'
            }`}
            style={setupCharacters.length > 0 ? sakuraBtnBg : undefined}
          >
            开始游戏
          </button>

          <div className="h-8" />
        </div>
      </div>
    );
  }

  // ===== VIEW: GAME =====
  if (view === 'game' && game) {
    const lastSegment = game.segments[game.segments.length - 1];

    return (
      <div className={`h-full flex flex-col max-w-full overflow-x-hidden ${bg}`}>
        <div className={`relative flex items-center justify-center px-4 pt-7 pb-3 border-b border-white/5 shrink-0 ${cardBg}`}>
          <div className="absolute left-4">{renderBack(() => setView('menu'))}</div>
          <h1 className={`text-lg font-bold text-ellipsis overflow-hidden whitespace-nowrap ${textColor}`}>
            第{game.round}回合
          </h1>
          <div className="absolute right-4 flex items-center gap-2">
            <button
              onClick={() => setView('status')}
              className="p-2 text-pink-400 hover:bg-pink-200/30 rounded-lg transition-colors"
            >
              <Heart size={20} />
            </button>
            <button
              onClick={() => {
                setSaveName('');
                setView('saves');
              }}
              className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
            >
              <Save size={20} />
            </button>
          </div>
        </div>

        {/* Player affection manual adjust panel (being_chased mode only) */}
        {game.mode === 'being_chased' && (
          <div className={`${cardBg} border-b border-white/5 shrink-0`}>
            <button
              onClick={() => setShowAffectionPanel(!showAffectionPanel)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm"
            >
              <span className={`font-medium ${textColor}`}>💕 我对角色的好感</span>
              <span className={`text-xs ${subText}`}>{showAffectionPanel ? '收起 ▲' : '展开 ▼'}</span>
            </button>
            {showAffectionPanel && (
              <div className="px-4 pb-3 space-y-2 max-w-full">
                {game.characterIds.map(id => {
                  const c = getCharacterById(id);
                  const aff = game.playerAffection[id] ?? 0;
                  return (
                    <div key={id} className="flex items-center gap-3 py-1 max-w-full">
                      <span className={`text-sm ${textColor} w-16 truncate shrink-0`}>{c?.name || id}</span>
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => adjustPlayerAffection(id, -1)}
                          className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-sm font-bold hover:bg-red-500/30 transition-colors"
                        >
                          -1
                        </button>
                        <div className={`flex-1 h-2 rounded-full relative ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                          <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400/50 -translate-x-1/2 rounded-full" />
                          <div
                            className={`h-full rounded-full transition-all ${getStageColor(aff, 'bar')}`}
                            style={{ width: `${Math.max(0, aff)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold w-8 text-right ${getStageColor(aff, 'text')}`}>{aff}</span>
                        <button
                          onClick={() => adjustPlayerAffection(id, 1)}
                          className="w-7 h-7 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-sm font-bold hover:bg-green-500/30 transition-colors"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Character affection panel (chase mode) */}
        {game.mode === 'chase' && (
          <div className={`${cardBg} border-b border-white/5 shrink-0`}>
            <button
              onClick={() => setShowCharAffectionPanel(!showCharAffectionPanel)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm"
            >
              <span className={`font-medium ${textColor}`}>♥ 角色对我的好感</span>
              <span className={`text-xs ${subText}`}>{showCharAffectionPanel ? '收起 ▲' : '展开 ▼'}</span>
            </button>
            {showCharAffectionPanel && (
              <div className="px-4 pb-3 space-y-2 max-w-full">
                {game.characterIds.map(id => {
                  const c = getCharacterById(id);
                  const aff = game.currentAffection[id] ?? 0;
                  return (
                    <div key={id} className="flex items-center gap-3 py-1 max-w-full">
                      <span className={`text-sm ${textColor} w-16 truncate shrink-0`}>{c?.name || id}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`w-full h-2 rounded-full relative ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                          <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400/50 -translate-x-1/2 rounded-full" />
                          <div
                            className={`h-full rounded-full transition-all ${getStageColor(aff, 'bar')}`}
                            style={{ width: `${Math.max(0, aff)}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-sm font-bold w-8 text-right shrink-0 ${getStageColor(aff, 'text')}`}>{aff}</span>
                      <span className={`text-xs w-12 text-right shrink-0 ${getStageColor(aff, 'text')}`}>{getAffectionLabel(aff)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-full">
          {game.segments.map((seg, idx) => {
            const charNames = game.characterIds.map(id => getCharacterById(id)?.name || '').filter(Boolean);
            // Use structured segments from AI if available, otherwise fall back to text parsing
            const parsedParts: NarrativeSegment[] = seg.parsedNarrative && seg.parsedNarrative.length > 0
              ? seg.parsedNarrative
              : (() => {
                  const narrativeParts = seg.narrative.split('\n').filter(Boolean);
                  const parts: NarrativeSegment[] = [];
                  narrativeParts.forEach(part => {
                    const results = parseNarrativeLine(part, charNames, game.playerName);
                    parts.push(...results);
                  });
                  if (parts.length === 0) {
                    parts.push({ type: 'narration', text: seg.narrative });
                  }
                  return parts;
                })()
            return (
            <div key={idx} className="max-w-full">
              <div className="mb-3 space-y-2 max-w-full">
                {/* 玩家选择：右侧绿色气泡（玩家自己的消息） */}
                {seg.playerChoice && (
                  <div className="flex justify-end px-2">
                    <div className="max-w-[80%]">
                      <div className="text-[11px] text-gray-400 mb-0.5 mr-1 text-right">{game.playerName}</div>
                      <div className="bg-green-500 rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-white">
                          {seg.playerChoice.replace(/[「」]/g, '')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {/* 剧情：旁白 + 行动气泡 + 对话气泡 */}
                {parsedParts.map((part, pi) => part.type === 'narration' ? (
                  <p key={pi} className="text-sm leading-relaxed whitespace-pre-wrap break-words text-center text-gray-400 px-2 max-w-full">
                    {part.text.replace(/[「」]/g, '')}
                  </p>
                ) : part.type === 'action' ? (
                  <div key={pi} className={`${cardBg} rounded-2xl p-4 shadow-sm mx-2 max-w-[85%] mx-auto`}>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words text-center ${textColor}`}>
                      {part.text.replace(/[「」]/g, '')}
                    </p>
                  </div>
                ) : part.type === 'character_dialogue' ? (
                  <div key={pi} className="flex justify-start px-2 max-w-full">
                    <div className="max-w-[80%]">
                      {part.speakerName && (
                        <div className="text-[11px] text-gray-400 mb-0.5 ml-1">{part.speakerName}</div>
                      )}
                      <div className="bg-white dark:bg-[#2b2b2b] rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-slate-800 dark:text-gray-100">
                          {part.text.replace(/[「」]/g, '')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={pi} className="flex justify-end px-2 max-w-full">
                    <div className="max-w-[80%]">
                      {part.speakerName && (
                        <div className="text-[11px] text-gray-400 mb-0.5 mr-1 text-right">{part.speakerName}</div>
                      )}
                      <div className="bg-green-500 rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-white">
                          {part.text.replace(/[「」]/g, '')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Affection changes indicator + manual adjust (being_chased mode) */}
              {idx === game.segments.length - 1 && game.round > 1 && (
                <div className="space-y-1.5 mb-3 max-w-full px-2">
                  {game.characterIds.map(id => {
                    const c = getCharacterById(id);
                    const prevSeg = game.segments[game.segments.length - 2];
                    const prevAff = prevSeg?.characterAffection[id] ?? 0;
                    const currAff = seg.characterAffection[id] ?? 0;
                    const diff = currAff - prevAff;
                    if (diff === 0 && game.mode !== 'being_chased') return null;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-12 truncate shrink-0">{c?.name || id}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-white/10 relative overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-pink-300 to-pink-400"
                            style={{ width: `${Math.max(0, currAff)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-6 text-right shrink-0 ${getStageColor(currAff, 'text')}`}>
                          {currAff}
                        </span>
                        {game.mode === 'being_chased' && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => {
                                const newSegs = [...game.segments];
                                const cur = newSegs[newSegs.length - 1];
                                const newAff = { ...cur.characterAffection, [id]: Math.max(-100, Math.min(100, (cur.characterAffection[id] ?? 0) + 5)) };
                                newSegs[newSegs.length - 1] = { ...cur, characterAffection: newAff };
                                setGame({ ...game, segments: newSegs, currentAffection: { ...game.currentAffection, [id]: newAff[id] } });
                              }}
                              className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px] font-bold hover:bg-green-500/30"
                            >+5</button>
                            <button
                              onClick={() => {
                                const newSegs = [...game.segments];
                                const cur = newSegs[newSegs.length - 1];
                                const newAff = { ...cur.characterAffection, [id]: Math.max(-100, Math.min(100, (cur.characterAffection[id] ?? 0) + 1)) };
                                newSegs[newSegs.length - 1] = { ...cur, characterAffection: newAff };
                                setGame({ ...game, segments: newSegs, currentAffection: { ...game.currentAffection, [id]: newAff[id] } });
                              }}
                              className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px] font-bold hover:bg-green-500/30"
                            >+1</button>
                            <button
                              onClick={() => {
                                const newSegs = [...game.segments];
                                const cur = newSegs[newSegs.length - 1];
                                const newAff = { ...cur.characterAffection, [id]: Math.max(-100, Math.min(100, (cur.characterAffection[id] ?? 0) - 1)) };
                                newSegs[newSegs.length - 1] = { ...cur, characterAffection: newAff };
                                setGame({ ...game, segments: newSegs, currentAffection: { ...game.currentAffection, [id]: newAff[id] } });
                              }}
                              className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold hover:bg-red-500/30"
                            >-1</button>
                            <button
                              onClick={() => {
                                const newSegs = [...game.segments];
                                const cur = newSegs[newSegs.length - 1];
                                const newAff = { ...cur.characterAffection, [id]: Math.max(-100, Math.min(100, (cur.characterAffection[id] ?? 0) - 5)) };
                                newSegs[newSegs.length - 1] = { ...cur, characterAffection: newAff };
                                setGame({ ...game, segments: newSegs, currentAffection: { ...game.currentAffection, [id]: newAff[id] } });
                              }}
                              className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold hover:bg-red-500/30"
                            >-5</button>
                          </div>
                        )}
                        {game.mode !== 'being_chased' && diff !== 0 && (
                          <span className={`text-xs shrink-0 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          })}

          {/* Loading indicator */}
          {loading && (
            <div className={`${cardBg} rounded-2xl p-8 shadow-sm flex flex-col items-center max-w-full`}>
              <RotateCw size={32} className="text-pink-400 animate-spin mb-3" />
              <p className={`text-sm ${subText}`}>剧情生成中...</p>
            </div>
          )}

          {/* Choices */}
          {!loading && lastSegment && lastSegment.choices.length > 0 && (
            <div className="space-y-2 max-w-full">
              <p className={`text-xs font-bold ${subText} mb-1`}>选择你的行动：</p>
              {lastSegment.choices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChoice(choice)}
                  className={`w-full text-left p-4 rounded-xl border-2 border-pink-200/40 ${
                    isDark ? 'bg-[#1a1a1a] text-white hover:bg-pink-200/30' : 'bg-white text-slate-800 hover:bg-pink-50'
                  } transition-all hover:border-pink-300/50 active:scale-[0.98] max-w-full`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-pink-200/40 text-pink-400 text-xs flex items-center justify-center shrink-0 font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm break-words min-w-0">{choice}</span>
                  </div>
                </button>
              ))}

              {/* Custom input */}
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className={`w-full text-left p-4 rounded-xl border-2 border-dashed ${
                    isDark ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'
                  } hover:border-pink-300/50 transition-colors`}
                >
                  <div className="flex items-center gap-2">
                    <Plus size={16} />
                    <span className="text-sm">自定义行动...</span>
                  </div>
                </button>
              ) : (
                <div className={`${cardBg} rounded-xl p-3 shadow-sm space-y-2 max-w-full`}>
                  <textarea
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    placeholder="输入你想要做的行动..."
                    className={`w-full border rounded-xl p-3 text-sm outline-none focus:border-pink-300/50 transition-colors resize-none h-20 ${inputBg}`}
                    autoFocus
                  />
                  <div className="flex gap-2 max-w-full">
                    <button
                      onClick={handleCustomSubmit}
                      disabled={!customInput.trim()}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                        customInput.trim() ? 'backdrop-blur-md font-bold shadow-lg' : 'bg-gray-500/50 cursor-not-allowed'
                      }`}
                      style={customInput.trim() ? sakuraBtnBg : undefined}
                    >
                      确认
                    </button>
                    <button
                      onClick={() => setShowCustomInput(false)}
                      className={`px-4 py-2 rounded-lg text-sm ${subText} hover:bg-white/10 transition-colors`}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-red-500 text-sm bg-red-500/10 p-3 rounded-xl max-w-full">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="break-words min-w-0 flex-1">{error}</span>
              <button
                onClick={() => generateStory(game)}
                className="shrink-0 px-3 py-1 bg-red-500/20 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
              >
                重试
              </button>
            </div>
          )}

          <div ref={storyEndRef} />
        </div>
      </div>
    );
  }

  // ===== VIEW: STATUS =====
  if (view === 'status' && game) {
    return (
      <div className={`h-full flex flex-col max-w-full overflow-x-hidden ${bg}`}>
        <div className={`relative flex items-center justify-center px-4 pt-7 pb-4 border-b border-white/5 shrink-0 ${cardBg}`}>
          <div className="absolute left-4">{renderBack(() => setView('game'))}</div>
          <h1 className={`text-lg font-bold text-ellipsis overflow-hidden whitespace-nowrap ${textColor}`}>角色状态</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-full">
          {/* Game info */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={16} className={subText} />
              <span className={`text-sm ${subText}`}>背景: {game.background}</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className={subText} />
              <span className={`text-sm ${subText}`}>回合: {game.round}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Sword size={16} className={subText} />
              <span className={`text-sm ${subText}`}>模式: {game.mode === 'chase' ? '攻略' : '被攻略'}</span>
            </div>
          </div>

          {/* Player stats (being_chased mode) */}
          {game.mode === 'being_chased' && (
            <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
              <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-4`}>
                我的状态
                <span className="text-xs font-normal ml-2">👤</span>
              </h2>
              <div className="space-y-3">
                {([
                  { key: 'health' as const, label: '健康', icon: '❤️' },
                  { key: 'energy' as const, label: '精力', icon: '⚡' },
                  { key: 'mood' as const, label: '心情', icon: '😊' },
                ]).map(item => {
                  const val = game.playerStats[item.key];
                  return (
                    <div key={item.key} className="flex items-center gap-2">
                      <span className="text-xs w-8 shrink-0">{item.icon}</span>
                      <span className={`text-xs w-8 shrink-0 ${getStatTextColor(val)}`}>{getStatLabel(val)}</span>
                      <div className={`flex-1 h-2 rounded-full relative ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                        <div
                          className={`h-full rounded-full transition-all ${getStatBarColor(val)}`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold w-7 text-right ${getStatTextColor(val)}`}>{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Affection table — character affection */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
            <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-4`}>
              角色对我的好感
              <span className="text-xs font-normal ml-2">♥</span>
            </h2>
            <div className="space-y-3">
              {game.characterIds.map(id => {
                const c = getCharacterById(id);
                const aff = game.currentAffection[id] ?? 0;
                return (
                  <div key={id} className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-10 h-10 rounded-lg shrink-0"
                        style={{
                          background: c?.avatar?.startsWith('#') ? c.avatar : `url(${c?.avatar || ''}) center/cover`,
                        }}
                      />
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${textColor}`}>{c?.name || id}</div>
                        <div className={`text-xs ${subText}`}>{c?.relationship || ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-right ${getStageColor(aff, 'text')}`}>
                          <div className="text-lg font-bold">{aff}</div>
                          <div className="text-xs">{getAffectionLabel(aff)}</div>
                        </div>
                        <Heart size={20} className={getStageColor(aff, 'heart')} />
                      </div>
                    </div>
                    {/* Multi-color affection bar */}
                    <div className={`w-full h-2.5 rounded-full relative ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                      <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400/50 -translate-x-1/2 rounded-full" />
                      <div
                        className={`h-full rounded-full transition-all ${getStageColor(aff, 'bar')}`}
                        style={{ width: `${Math.max(0, aff)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Player affection section */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
            <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-4`}>
              我对角色的好感
              <span className="text-xs font-normal ml-2 text-pink-300">💕</span>
              {game.mode === 'being_chased' && (
                <span className="text-xs font-normal ml-2 text-green-400">（可在游戏中调整）</span>
              )}
            </h2>
            <div className="space-y-3">
              {game.characterIds.map(id => {
                const c = getCharacterById(id);
                const aff = game.playerAffection[id] ?? 0;
                return (
                  <div key={id} className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-10 h-10 rounded-lg shrink-0"
                        style={{
                          background: c?.avatar?.startsWith('#') ? c.avatar : `url(${c?.avatar || ''}) center/cover`,
                        }}
                      />
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${textColor}`}>{c?.name || id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-right ${getStageColor(aff, 'text')}`}>
                          <div className="text-lg font-bold">{aff}</div>
                          <div className="text-xs">{getAffectionLabel(aff)}</div>
                        </div>
                        <Heart size={20} className={getStageColor(aff, 'heart')} />
                      </div>
                    </div>
                    <div className={`w-full h-2.5 rounded-full relative ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                      <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400/50 -translate-x-1/2 rounded-full" />
                      <div
                        className={`h-full rounded-full transition-all ${getStageColor(aff, 'bar')}`}
                        style={{ width: `${Math.max(0, aff)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Character stats section */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
            <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-4`}>
              角色状态
              <span className="text-xs font-normal ml-2 text-green-400">📊</span>
            </h2>
            <div className="space-y-4">
              {game.characterIds.map(id => {
                const c = getCharacterById(id);
                const stats = (game.characterStats || {})[id] || { health: 60, energy: 60, mood: 60 };
                const statItems: { key: keyof typeof stats; label: string; icon: string }[] = [
                  { key: 'health', label: '健康', icon: '❤️' },
                  { key: 'energy', label: '精力', icon: '⚡' },
                  { key: 'mood', label: '心情', icon: '😊' },
                ];
                return (
                  <div key={id} className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg shrink-0"
                        style={{
                          background: c?.avatar?.startsWith('#') ? c.avatar : `url(${c?.avatar || ''}) center/cover`,
                        }}
                      />
                      <div className={`text-sm font-medium ${textColor}`}>{c?.name || id}</div>
                    </div>
                    <div className="space-y-2 pl-1">
                      {statItems.map(item => {
                        const val = stats[item.key];
                        return (
                          <div key={item.key} className="flex items-center gap-2">
                            <span className="text-xs w-8 shrink-0">{item.icon}</span>
                            <span className={`text-xs w-8 shrink-0 ${getStatTextColor(val)}`}>{getStatLabel(val)}</span>
                            <div className={`flex-1 h-2 rounded-full relative ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                              <div
                                className={`h-full rounded-full transition-all ${getStatBarColor(val)}`}
                                style={{ width: `${val}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold w-7 text-right ${getStatTextColor(val)}`}>{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flags */}
          {Object.keys(game.flags).length > 0 && (
            <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
              <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-3`}>已触发事件</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(game.flags).filter(([, v]) => v).map(([key]) => (
                  <span key={key} className="px-3 py-1 bg-pink-200/40 text-pink-400 text-xs rounded-full">
                    {key === 'confessed' ? '💌 告白' :
                     key === 'rejected' ? '💔 拒绝' :
                     key === 'helped' ? '🤝 帮助' :
                     key === 'gifted' ? '🎁 礼物' :
                     key === 'physical' ? '💏 亲密接触' :
                     key === 'customAction' ? '✍️ 自定义行动' : key}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== CONFIRM MODAL =====
  const ConfirmModal = () => {
    if (!deleteTarget) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
        <div className="relative bg-white rounded-2xl p-6 w-[280px] shadow-2xl">
          <h3 className="text-lg font-bold mb-2 text-slate-800">删除存档</h3>
          <p className="text-sm mb-6 text-gray-500">确定要删除「{deleteTarget.label}」吗？此操作不可撤销。</p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 py-3 rounded-xl font-medium bg-gray-100 text-slate-700 hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-3 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===== VIEW: SAVES =====
  if (view === 'saves' && game) {
    const gameSlots = saveSlots.filter(s => s.gameId === game.id);

    return (
      <div className={`h-full flex flex-col max-w-full overflow-x-hidden ${bg}`}>
        <ConfirmModal />
        <div className={`relative flex items-center justify-center px-4 pt-7 pb-4 border-b border-white/5 shrink-0 ${cardBg}`}>
          <div className="absolute left-4">{renderBack(() => setView('game'))}</div>
          <h1 className={`text-lg font-bold text-ellipsis overflow-hidden whitespace-nowrap ${textColor}`}>保存游戏</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 max-w-full">
          {/* Auto-save status */}
          {(() => {
            try {
              const autoData = localStorage.getItem(AUTO_SAVE_KEY);
              if (autoData && game) {
                const auto = JSON.parse(autoData);
                return (
                  <div className={`${cardBg} rounded-2xl p-4 shadow-sm border border-pink-100 mb-4 flex items-center gap-3`}>
                    <div className="w-10 h-10 rounded-xl bg-pink-200/40 flex items-center justify-center shrink-0">
                      <RotateCw size={18} className="text-pink-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${textColor}`}>自动存档 · 第{auto.round}回合</div>
                      <div className={`text-xs ${subText}`}>
                        {new Date(auto.updatedAt || auto.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget({ slotId: 'auto-save', label: '自动存档', isAutoSave: true })}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              }
            } catch {}
            return null;
          })()}
          <div className="grid grid-cols-2 gap-3">
            {SLOT_LABELS.map(label => {
              const slot = gameSlots.find(s => s.label === label);
              const isUsed = !!slot;
              return (
                <button
                  key={label}
                  onClick={() => handleSaveToSlot(label)}
                  className={`${cardBg} rounded-2xl p-5 shadow-sm border-2 transition-all text-left ${
                    isUsed ? 'border-pink-300 hover:border-pink-300/50' : 'border-dashed border-gray-300 hover:border-pink-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold ${isUsed ? 'text-pink-400' : 'text-gray-400'}`}>{label}</span>
                    {isUsed && (
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-400`}>
                        已存档
                      </span>
                    )}
                  </div>
                  {isUsed ? (
                    <div className="space-y-1">
                      <p className={`text-xs ${subText}`}>第{slot.game.round}回合</p>
                      <p className={`text-xs ${subText}`}>{new Date(slot.timestamp).toLocaleString('zh-CN')}</p>
                      <p className="text-xs text-gray-400 truncate">{slot.game.background}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">空</p>
                  )}
                </button>
              );
            })}
          </div>

          {gameSlots.length > 0 && (
            <div className="mt-6">
              <h2 className={`text-sm font-bold ${subText} mb-3 px-1`}>管理存档</h2>
              <div className="space-y-2">
                {gameSlots.map(slot => (
                  <div key={slot.id} className={`${cardBg} rounded-2xl p-4 shadow-sm flex items-center gap-3`}>
                    <div className={`w-10 h-10 rounded-xl bg-pink-200/40 flex items-center justify-center shrink-0`}>
                      <BookOpen size={18} className="text-pink-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${textColor}`}>{slot.label} · 第{slot.game.round}回合</div>
                      <div className={`text-xs ${subText}`}>{new Date(slot.timestamp).toLocaleString('zh-CN')}</div>
                    </div>
                    <button
                      onClick={() => handleLoadSlot(slot)}
                      className="px-3 py-2 bg-pink-200/40 text-pink-400 text-xs font-medium rounded-lg hover:bg-pink-500/30 transition-colors"
                    >
                      读取
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ slotId: slot.id, label: slot.label })}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== VIEW: LOAD =====
  if (view === 'load') {
    // Group saves by game session (includes auto-save merged into same game group)
    const groups = new Map<string, { name: string; slots: SaveSlot[] }>();
    saveSlots.forEach(slot => {
      const key = slot.gameId;
      if (!groups.has(key)) {
        const name = slot.game.background || `游戏 ${key.slice(-4)}`;
        groups.set(key, { name, slots: [] });
      }
      groups.get(key)!.slots.push(slot);
    });

    // Merge auto-save into its game group
    try {
      const autoData = localStorage.getItem(AUTO_SAVE_KEY);
      if (autoData) {
        const auto = JSON.parse(autoData);
        const key = auto.id;
        if (!groups.has(key)) {
          const name = auto.background || `游戏 ${key.slice(-4)}`;
          groups.set(key, { name, slots: [] });
        }
        groups.get(key)!.slots.unshift({
          id: 'auto-save',
          gameId: key,
          label: '自动存档',
          game: auto,
          timestamp: auto.updatedAt || auto.createdAt,
        });
      }
    } catch {}

    return (
      <div className={`h-full flex flex-col max-w-full overflow-x-hidden ${bg}`}>
        <ConfirmModal />
        <div className={`relative flex items-center justify-center px-4 pt-7 pb-4 border-b border-white/5 shrink-0 ${cardBg}`}>
          <div className="absolute left-4">{renderBack(() => setView('menu'))}</div>
          <h1 className={`text-lg font-bold text-ellipsis overflow-hidden whitespace-nowrap ${textColor}`}>读取存档</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-full">
          {groups.size === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📂</div>
              <p className={`text-sm ${subText}`}>暂无存档</p>
              <p className={`text-xs ${subText} mt-1`}>开始新游戏后可以在游戏中保存存档</p>
            </div>
          ) : (
            Array.from(groups.entries()).map(([gameId, group]) => (
              <div key={gameId}>
                <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} px-1 mb-2`}>
                  {group.name}
                  <span className={`text-xs font-normal ${subText} ml-2`}>{group.slots.length}个存档</span>
                </h2>
                <div className="space-y-2">
                  {group.slots.sort((a, b) => a.label.localeCompare(b.label)).map(slot => (
                    <div key={slot.id} className={`${cardBg} rounded-2xl p-4 shadow-sm flex items-center gap-3 border border-pink-100`}>
                      <div className={`w-10 h-10 rounded-xl bg-pink-200/40 flex items-center justify-center shrink-0`}>
                        <Save size={18} className="text-pink-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${textColor}`}>
                          {slot.label} · 第{slot.game.round}回合
                        </div>
                        <div className={`text-xs ${subText}`}>
                          {new Date(slot.timestamp).toLocaleString('zh-CN')}
                        </div>
                        <div className={`text-xs ${subText} truncate`}>
                          {slot.game.mode === 'chase' ? '攻略' : '被攻略'} · {slot.game.characterIds.map(id => characters[id]?.name || id).join('、')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleLoadSlot(slot)}
                        className="px-4 py-2 bg-pink-200/40 text-pink-400 text-sm font-medium rounded-lg hover:bg-pink-500/30 transition-colors"
                      >
                        读取
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ slotId: slot.id, label: slot.label, isAutoSave: slot.id === 'auto-save' })}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

    // ===== VIEW: ENDING =====
  if (view === 'ending' && game) {
    const endingColors: Record<string, string> = {
      happy: 'from-pink-300 to-pink-400',
      normal: 'from-blue-400 to-purple-500',
      bad: 'from-gray-600 to-gray-800',
    };
    const endingEmojis: Record<string, string> = {
      happy: '💕',
      normal: '🤍',
      bad: '💔',
    };

    return (
      <div className={`h-full flex flex-col max-w-full overflow-x-hidden ${bg}`}>
        <div className={`flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center max-w-full`}>
          <div className="text-6xl mb-6">{endingEmojis[game.endingType] || '🎭'}</div>
          <h1 className={`text-2xl font-bold mb-2 ${textColor}`}>{game.endingTitle}</h1>
          <p className={`text-sm ${subText} mb-2`}>
            经过了{game.round}回合的历程
          </p>

          <div className={`${cardBg} rounded-2xl p-6 shadow-sm mb-6 max-w-sm`}>
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${textColor}`}>
              {game.endingText}
            </p>
          </div>

          {/* Final affection */}
          <div className={`${cardBg} rounded-2xl p-5 shadow-sm mb-6 w-full max-w-sm`}>
            <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-3 text-center`}>最终好感度</h2>
            <div className="space-y-2">
              {game.characterIds.map(id => {
                const c = getCharacterById(id);
                const aff = game.currentAffection[id] ?? 0;
                return (
                  <div key={id} className="flex items-center justify-between">
                    <span className={`text-sm ${textColor}`}>{c?.name || id}</span>
                    <span className={`text-sm font-bold ${getAffectionColor(aff)}`}>{aff}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setView('menu'); setGame(null); }}
              className="px-6 py-3 backdrop-blur-md text-white font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform"
              style={sakuraBtnBg}
            >
              返回主菜单
            </button>
            <button
              onClick={closeApp}
              className={`px-6 py-3 ${cardBg} ${textColor} font-bold rounded-2xl shadow-sm border ${isDark ? 'border-white/10' : 'border-gray-200'} hover:scale-105 transition-transform`}
            >
              返回桌面
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
