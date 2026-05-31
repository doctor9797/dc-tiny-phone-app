import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, ScrollText, Users, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { generateAIResponse, sendCharacterActivityFollowup } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { JubenshaCaseData } from '../../types';
import { resolvePreset, LAYOUT_MAP } from './ui-engine';

const BG_STORAGE_KEY = 'jubensha_bg';
const BG_PRESETS = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  'https://images.unsplash.com/photo-1470071459604-7b8ec44ffd4b?w=400&q=80',
  'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=400&q=80',
  'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=400&q=80',
  'https://images.unsplash.com/photo-1518173946687-a36f968f7aba?w=400&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&q=80',
];

const BACKGROUNDS = ['古代西方', '古代东方', '近现代', '西方中世纪', '古希腊', '赛博朋克', '废土末日', '现代都市', '魔法学院', '星际飞船', '诡异山村', '民国时期', '深海基地'];
const THEMES = ['悬疑', '悲剧', '喜剧', '爱情', '硬核推理', '本格密室', '欢乐机制', '阵营背叛', '情感沉浸', '克苏鲁神话', '怪谈传说'];

type GameStep = 'list' | 'setup' | 'generating' | 'playing' | 'ending';

export default function JubenshaApp() {
  const { closeApp, characters, jubenshaSessions, createJubenshaSession, updateJubenshaSession, deleteJubenshaSession, addActivityLog, settings } = useAppStore();

  const [step, setStep] = useState<GameStep>('list');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);

  const [bgMode, setBgMode] = useState<'preset' | 'custom'>('preset');
  const [selectedBg, setSelectedBg] = useState(BACKGROUNDS[0]);
  const [customBg, setCustomBg] = useState('');

  const [themeMode, setThemeMode] = useState<'preset' | 'custom'>('preset');
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [customTheme, setCustomTheme] = useState('');

  const [bgUrl, setBgUrl] = useState(() => {
    try { return localStorage.getItem(BG_STORAGE_KEY) || BG_PRESETS[0]; }
    catch { return BG_PRESETS[0]; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);

  const handleBgImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setBgUrl(dataUrl);
      try { localStorage.setItem(BG_STORAGE_KEY, dataUrl); } catch {}
    };
    reader.readAsDataURL(file);
  };

  const setBg = (url: string) => {
    setBgUrl(url);
    try { localStorage.setItem(BG_STORAGE_KEY, url); } catch {}
    setShowBgPicker(false);
  };

  const [script, setScript] = useState('');
  const [messages, setMessages] = useState<{role: 'system'|'user'|'character', name?: string, text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [caseData, setCaseData] = useState<JubenshaCaseData | null>(null);
  const [discoveredClues, setDiscoveredClues] = useState<string[]>([]);
  const [accusedCharacterId, setAccusedCharacterId] = useState<string | null>(null);
  const [interrogateTarget, setInterrogateTarget] = useState<string | null>(null);
  const [endingText, setEndingText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [phase, setPhase] = useState<'intro' | 'investigation1' | 'discussion' | 'investigation2' | 'final_vote'>('intro');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const introDoneRef = useRef(false);
  const [showControls, setShowControls] = useState(false);
  const finalBg = bgMode === 'preset' ? selectedBg : customBg;
  const finalTheme = themeMode === 'preset' ? selectedTheme : customTheme;

  const visibleClues = useMemo(() => (caseData?.clues || []).filter(clue => discoveredClues.includes(clue.id)), [caseData, discoveredClues]);
  const locations = useMemo(() => Array.from(new Set((caseData?.clues || []).map(clue => clue.location || '公共区域'))), [caseData]);

  const toggleCharSelection = (id: string) => {
    if (selectedCharIds.includes(id)) {
      setSelectedCharIds(prev => prev.filter(c => c !== id));
    } else {
      setSelectedCharIds(prev => [...prev, id]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiTyping]);

  // Auto-generate character introductions when entering playing+intro
  useEffect(() => {
    if (step !== 'playing' || phase !== 'intro' || introDoneRef.current || !caseData) return;
    const existingIntros = messages.filter(m => m.role === 'character').length;
    if (existingIntros > 0) { introDoneRef.current = true; return; }
    const runIntros = async () => {
      const nonUserRoles = caseData.roles.filter(r => r.playerId !== 'user');
      if (nonUserRoles.length === 0) return;
      introDoneRef.current = true;
      for (const role of nonUserRoles) {
        const prompt = `你正在玩剧本杀。你现在扮演「${role.roleName}」，公开身份是${role.publicIdentity}，性格是${role.personality}，过往经历是${role.backstory}，隐藏秘密是${role.secret}。请以第一人称做一段简短的自我介绍，说说你是谁、你的身份、你的性格特点。语气符合角色性格，不超过80字。不要引号、括号、星号。`;
        try {
          const intro = await generateAIResponse(prompt);
          const cleanIntro = intro.replace(/[「」【】*（）()"]/g, '').trim();
          setMessages(prev => {
            const nextMsgs = [...prev, { role: 'character' as const, name: role.roleName, text: cleanIntro }];
            if (currentSessionId) updateJubenshaSession(currentSessionId, { messages: nextMsgs, updatedAt: Date.now() });
            return nextMsgs;
          });
        } catch {}
      }
      setMessages(prev => {
        const nextMsgs = [...prev, { role: 'system' as const, text: '（轮到你了，请以你的角色身份介绍一下自己）' }];
        if (currentSessionId) updateJubenshaSession(currentSessionId, { messages: nextMsgs, updatedAt: Date.now() });
        return nextMsgs;
      });
    };
    runIntros();
  }, [step, phase, caseData]);

  const startGame = async () => {
    if (selectedCharIds.length < 2) return;

    setStep('generating');
    const finalBg = bgMode === 'preset' ? selectedBg : customBg;
    const finalTheme = themeMode === 'preset' ? selectedTheme : customTheme;
    const charList = selectedCharIds.map(id => `  - id="${id}" name="${characters[id].name}"`).join('\n');

    const prompt = `我们要玩一场真实结构的剧本杀（角色扮演推理游戏）。
    背景：${finalBg}
    主题：${finalTheme}
    参与角色：我（玩家，id="user"），以及以下角色：
${charList}
    请返回严格 JSON，不要 Markdown，不要解释。JSON 格式：
    {
      "caseTitle":"案件名",
      "background":"故事背景",
      "opening":"开场导语",
      "incident":"核心事件",
      "truth":"完整真相",
      "culpritId":"某个参与角色id，必须是 user 或上面给出的角色id",
      "userRoleId":"user",
      "roles":[
        {"playerId":"user","roleName":"（虚构角色名）","publicIdentity":"公开身份","personality":"角色性格","backstory":"过往经历","secret":"隐藏秘密","objective":"个人目标"},
        {"playerId":"<上面给出的角色id>","roleName":"（虚构角色名）","publicIdentity":"公开身份","personality":"角色性格","backstory":"过往经历","secret":"隐藏秘密","objective":"个人目标"}
      ],
      "clues":[
        {"id":"c1","title":"线索名","detail":"线索内容","holderId":"某角色playerId","location":"地点"}
      ],
      "endings":[
        {"id":"e1","title":"真相大白","summary":"达成结局描述","condition":"正确指出真凶并串联关键线索"},
        {"id":"e2","title":"误判","summary":"错误指认真凶的结局","condition":"指认错误"},
        {"id":"e3","title":"沉默者","summary":"拖太久或没有做出判断的结局","condition":"迟迟不下结论"}
      ]
    }
    规则（必须严格遵守）：
    1. 每个 roleName 必须是完全虚构的角色名，禁止使用角色自己的真实姓名。例如角色名不能等于原有姓名，必须改成完全不同的虚构名字。所有 roleName 都不能与对应角色的真实姓名相同。
    2. 所有角色的 roleName 不能相同。
    3. 角色性格可以和玩家本人不同。
    4. 必须有真凶和完整真相。
    5. 必须有至少 6 条可探索线索。
    6. 必须有至少 3 个不同结局。`;

    try {
      const maxAttempts = 3;
      let attempt = 0;
      let caseJson: JubenshaCaseData;
      let allNamesOk = false;
      while (attempt < maxAttempts && !allNamesOk) {
        attempt++;
        const generated = await generateAIResponse(prompt);
        caseJson = JSON.parse(generated.replace(/```json|```/g, '').trim()) as JubenshaCaseData;
        // Check that no roleName equals a character's real name
        allNamesOk = caseJson.roles.every(role => {
          const realName = role.playerId === 'user' ? null : (characters[role.playerId]?.name || null);
          return !realName || role.roleName !== realName;
        });
        if (!allNamesOk && attempt < maxAttempts) {
          continue; // regenerate
        }
      }
      if (!allNamesOk) {
        setScript('剧本生成失败：AI 未能遵守角色命名规则，请重新生成。');
        setStep('setup');
        return;
      }
      const userRole = caseJson.roles.find(role => role.playerId === 'user');
      const generatedScript = `案件名：${caseJson.caseTitle}

故事背景：
${caseJson.background}

你拿到的角色：
${userRole?.roleName}

公开身份：
${userRole?.publicIdentity}

角色性格：
${userRole?.personality}

过往经历：
${userRole?.backstory}

隐藏秘密：
${userRole?.secret}

你的目标：
${userRole?.objective}

案发事件：
${caseJson.incident}`;
      const sessionId = Date.now().toString();
      const newSession = {
        id: sessionId,
        name: `${finalBg} · ${finalTheme}`,
        background: finalBg,
        theme: finalTheme,
        characterIds: selectedCharIds,
        script: generatedScript,
        messages: [{ role: 'system' as const, text: '游戏开始。你已经阅读了剧本，现在可以开始你的行动或对话。' }],
        updatedAt: Date.now(),
        caseData: caseJson,
        discoveredClues: [],
        accusedCharacterId: null,
        isFinished: false,
        unlockedEndingIds: [],
        phase: 'intro' as const
      };
      createJubenshaSession(newSession);
      setCurrentSessionId(sessionId);

      setScript(generatedScript);
      setCaseData(caseJson);
      setDiscoveredClues([]);
      setAccusedCharacterId(null);
      setEndingText('');
      setSelectedLocation(caseJson.clues[0]?.location || '公共区域');
      setPhase('intro');
      setStep('playing');
      // Build an array of role introductions for the start of the game
      const allRoles = caseJson.roles;
      const introLines: string[] = ['游戏开始。接下来是自我介绍环节——请每个人用角色身份介绍自己。'];
      for (const r of allRoles) {
        if (r.playerId === 'user') continue;
        const originalName = characters[r.playerId]?.name || r.playerId;
        introLines.push(`${r.roleName}（${originalName}饰）：${r.publicIdentity}，${r.personality}`);
      }
      introLines.push('（现在轮到你了，请以你的角色身份介绍一下自己）');
      setMessages([{ role: 'system', text: introLines.join('\n') }]);
    } catch (e: any) {
      setScript('剧本生成失败，请重试。' + e.message);
      setStep('setup');
    }
  };

  const handleSend = async (text: string, isHintRequest = false) => {
    if (!text.trim() && !isHintRequest) return;

    const userText = isHintRequest ? "【请求提示】我不知道该怎么办了，谁能给我一点隐晦的提示？" : text;

    if (!isHintRequest) {
      setInput('');
    }

    setMessages(prev => {
      const nextMsgs = [...prev, { role: 'user' as const, text: userText }];
      if (currentSessionId) {
        updateJubenshaSession(currentSessionId, { messages: nextMsgs, updatedAt: Date.now() });
      }
      return nextMsgs;
    });
    setIsAiTyping(true);

    const finalBg = bgMode === 'preset' ? selectedBg : customBg;
    const finalTheme = themeMode === 'preset' ? selectedTheme : customTheme;
    const charNames = selectedCharIds.map(id => characters[id].name).join('、');
    const knownClues = (caseData?.clues || []).filter(clue => discoveredClues.includes(clue.id)).map(clue => `${clue.title}：${clue.detail}`).join('\n');
    const roleBriefWithRoleNames = (caseData?.roles || []).map(role => {
      const origName = characters[role.playerId]?.name || role.playerId;
      return `${role.roleName}（${origName}饰）：公开身份=${role.publicIdentity}，性格=${role.personality}，秘密=${role.secret}，目标=${role.objective}`;
    }).join('\n');

    const history = messages.slice(-10).map(m => {
      if (m.role === 'system') return `[系统]: ${m.text}`;
      if (m.role === 'user') return `[我]: ${m.text}`;
      return `[${m.name}]: ${m.text}`;
    }).join('\n');

    const phaseInstructions: Record<string, string> = {
      intro: '自我介绍环节。DM引导气氛，每个角色以第一人称介绍自己。',
      investigation1: '第一轮搜证。搜索线索、互相试探。用"线索: 标题｜内容"给出发现。',
      discussion: '集中讨论。分享线索、提出疑问、互相怀疑。可用"线索: 标题｜内容"给新线索。',
      investigation2: '第二轮搜证。更多线索浮现。用"线索: 标题｜内容"给出关键线索。',
      final_vote: '最终指认。角色做最后陈述，等待投票。',
    };
    const prompt = `我们正在玩一局真实的剧本杀。案件：「${caseData?.caseTitle}」
背景：${finalBg}，主题：${finalTheme}
当前阶段：${phase}

【角色设定（角色名（玩家饰）：身份）】
${roleBriefWithRoleNames}

【完整真相（仅供内部参考，不能直接说破）】
${caseData?.truth}

【已发现的线索】
${knownClues || '暂无'}

【最近的对话】
${history}

【我的行动/发言】
${userText}

${isHintRequest
  ? '玩家请求提示。请以DM口吻给出非常隐晦的引导，不能直接说真相或凶手。'
  : phaseInstructions[phase] || '请根据剧情推进。'}

输出格式（可多行组合）：
- 角色发言 → 「角色名: 说话内容」
- 系统描述 → 「系统: 环境描述」
- 新线索 → 「线索: 标题｜内容」`;

    try {
      const reply = await generateAIResponse(prompt);

      // Save interaction memory for all participating characters
      for (const charId of selectedCharIds) {
        saveInteractionMemory(charId, `和${characters[charId]?.name}一起玩剧本杀《${caseData?.caseTitle}》进行了对话`, text);
        useAppStore.getState().addEmotionEvent({ characterId: charId, paDelta: 0.1, naDelta: -0.02, word: '好奇', valence: 0.3, arousal: 0.5, matchSource: 'free_form', source: 'manual' });
      }

      const lines = reply.split('\n').filter(l => l.trim());
      const newMsgs: any[] = [];

      lines.forEach(line => {
        const match = line.match(/^(.*?):\s*(.*)$/);
        if (match) {
          const name = match[1].trim();
          const content = match[2].trim();
          if (name === '线索') {
            const [title, detail] = content.split('｜');
            const clue = caseData?.clues.find(item => item.title === title || item.detail.includes(detail || ''));
            if (clue && !discoveredClues.includes(clue.id)) {
              setDiscoveredClues(prev => {
                const next = [...prev, clue.id];
                if (currentSessionId) {
                  updateJubenshaSession(currentSessionId, { discoveredClues: next, updatedAt: Date.now() });
                }
                return next;
              });
            }
            newMsgs.push({ role: 'system', text: `发现线索：${title || '未命名线索'} ${detail || ''}` });
            return;
          }
          if (name === '系统' || name === 'DM' || name === 'System') {
            newMsgs.push({ role: 'system', text: content });
          } else {
            newMsgs.push({ role: 'character', name, text: content });
          }
        } else {
          newMsgs.push({ role: 'system', text: line });
        }
      });

      setMessages(prev => {
        const nextMsgs = [...prev, ...newMsgs];
        if (currentSessionId) {
           updateJubenshaSession(currentSessionId, { messages: nextMsgs, updatedAt: Date.now() });
        }
        return nextMsgs;
      });
    } catch (e) {
      setMessages(prev => {
         const nextMsgs = [...prev, { role: 'system' as const, text: '（系统响应失败，请重试）' }];
         if (currentSessionId) {
           updateJubenshaSession(currentSessionId, { messages: nextMsgs, updatedAt: Date.now() });
         }
         return nextMsgs;
      });
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleInvestigate = () => {
    if (!caseData) return;
    if (!(phase === 'investigation1' || phase === 'investigation2')) {
      setMessages(prev => [...prev, { role: 'system', text: '当前不是搜证阶段，请先推进到搜证阶段。' }]);
      return;
    }
    const nextClue = caseData.clues.find(clue => !discoveredClues.includes(clue.id) && (clue.location || '公共区域') === selectedLocation);
    if (!nextClue) {
      setMessages(prev => [...prev, { role: 'system', text: `${selectedLocation} 暂时没有新的可见线索。` }]);
      return;
    }
    const next = [...discoveredClues, nextClue.id];
    setDiscoveredClues(next);
    setMessages(prev => [...prev, { role: 'system', text: `你在${selectedLocation}搜到线索：${nextClue.title}。${nextClue.detail}` }]);
    if (currentSessionId) updateJubenshaSession(currentSessionId, { discoveredClues: next, updatedAt: Date.now() });
  };

  const handleInterrogate = async (charId: string) => {
    if (!caseData) return;
    const role = caseData.roles.find(item => item.playerId === charId);
    const clueContext = visibleClues.map(clue => `${clue.title}:${clue.detail}`).join('\n') || '暂无公开线索';
    const prompt = `我们在玩剧本杀，案件是 ${caseData.caseTitle}。
你现在扮演 ${role?.roleName}（${characters[charId]?.name}饰），公开身份是 ${role?.publicIdentity}，角色性格是 ${role?.personality}，角色秘密是 ${role?.secret}。
案件真相是：${caseData.truth}
目前玩家已经掌握的线索：
${clueContext}
当前阶段是 ${phase}。请你以这个角色的身份，回答玩家的盘问。要求：
1. 符合角色性格
2. 可以闪躲、误导、掩饰，但不能完全脱离真相
3. 不要用 Markdown
4. 不超过60字`;
    setIsAiTyping(true);
    try {
      const reply = await generateAIResponse(prompt);
      setMessages(prev => [...prev, { role: 'character', name: role?.roleName || characters[charId]?.name, text: reply.replace(/[#*]/g, '').trim() }]);
      saveInteractionMemory(charId, `盘问了${role?.roleName || characters[charId]?.name}关于案件《${caseData?.caseTitle}》`, reply.replace(/[#*]/g, '').trim());
      useAppStore.getState().addEmotionEvent({ characterId: charId, paDelta: -0.05, naDelta: 0.15, word: '紧张', valence: -0.2, arousal: 0.5, matchSource: 'free_form', source: 'manual' });
    } catch {
      setMessages(prev => [...prev, { role: 'character', name: role?.roleName || characters[charId]?.name, text: '这件事，我暂时不想说得太明白。' }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const checkPhaseAdvanceCondition = (): { canAdvance: boolean; reason: string } => {
    const userMessages = messages.filter(m => m.role === 'user').length;
    const totalClues = caseData?.clues?.length || 0;
    const foundClues = discoveredClues.length;
    switch (phase) {
      case 'intro':
        if (!introDoneRef.current) return { canAdvance: false, reason: '等待角色自我介绍完成' };
        if (userMessages < 1) return { canAdvance: false, reason: '请先以角色身份介绍一下自己' };
        return { canAdvance: true, reason: '' };
      case 'investigation1':
        if (foundClues < 2) return { canAdvance: false, reason: `需要找到至少2条线索才能进入讨论阶段（已找到${foundClues}条）` };
        return { canAdvance: true, reason: '' };
      case 'discussion':
        if (userMessages < 3) return { canAdvance: false, reason: '请在讨论阶段多发言推理（至少发言3次）' };
        return { canAdvance: true, reason: '' };
      case 'investigation2':
        { const needed = Math.ceil(totalClues * 0.7);
        if (foundClues < needed) return { canAdvance: false, reason: `需要找到至少${needed}条线索才能进入最终指认（已找到${foundClues}条）` };
        return { canAdvance: true, reason: '' }; }
      case 'final_vote':
        return { canAdvance: false, reason: '已经是最终阶段' };
      default:
        return { canAdvance: true, reason: '' };
    }
  };

  const advancePhase = () => {
    const check = checkPhaseAdvanceCondition();
    if (!check.canAdvance) {
      setMessages(prev => [...prev, { role: 'system', text: check.reason }]);
      if (currentSessionId) updateJubenshaSession(currentSessionId, { messages: [...messages, { role: 'system', text: check.reason }], updatedAt: Date.now() });
      return;
    }
    const phaseOrder = ['intro', 'investigation1', 'discussion', 'investigation2', 'final_vote'] as const;
    const currentIndex = phaseOrder.indexOf(phase);
    const nextPhase = phaseOrder[Math.min(currentIndex + 1, phaseOrder.length - 1)];
    setPhase(nextPhase);
    const phaseNameMap: Record<string, string> = { intro: '破冰介绍', investigation1: '第一轮搜证', discussion: '集中讨论', investigation2: '第二轮搜证', final_vote: '最终指认' };
    setMessages(prev => [...prev, { role: 'system', text: `阶段推进：${phaseNameMap[nextPhase]}。` }]);
    if (currentSessionId) updateJubenshaSession(currentSessionId, { phase: nextPhase, updatedAt: Date.now() });
  };


  // ─── LIST SCREEN ───
  if (step === 'list') {
    const sessionsList = Object.values(jubenshaSessions).sort((a, b) => b.updatedAt - a.updatedAt);
    return (
      <div className="h-full flex flex-col absolute inset-0 z-50 overflow-hidden" style={{
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Frosted glass backdrop */}
        <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/50 backdrop-blur-md" />
        <div className="relative z-10 flex flex-col h-full">
          {/* Header */}
          <div className="px-4 pt-7 pb-4 flex items-center justify-between border-b border-white/30 dark:border-white/10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-2xl">
            <button onClick={closeApp} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1">
              <ChevronLeft size={26} />
            </button>
            <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">剧本杀</h1>
            <button onClick={() => setShowBgPicker(true)} className="p-1.5 rounded-xl bg-white/40 dark:bg-zinc-800/40 backdrop-blur-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              <ImageIcon size={18} />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
            {/* New Game Button */}
            <button
              onClick={() => setStep('setup')}
              className="w-full bg-white/60 dark:bg-white/10 backdrop-blur-2xl border border-white/40 dark:border-white/20 rounded-2xl p-5 flex items-center justify-center gap-3
                text-zinc-600 dark:text-zinc-300 font-semibold shadow-lg shadow-black/5
                hover:bg-white/80 dark:hover:bg-white/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <Plus size={22} className="text-zinc-400 dark:text-zinc-400" />
              开启新剧本
            </button>

            {sessionsList.length === 0 ? (
               <div className="text-center py-20">
                 <div className="w-16 h-16 rounded-full bg-white/40 dark:bg-zinc-800/40 backdrop-blur-xl flex items-center justify-center mx-auto mb-4">
                   <ScrollText size={28} className="text-zinc-400 dark:text-zinc-500" />
                 </div>
                 <p className="font-medium text-zinc-500 dark:text-zinc-400 text-sm">暂无游玩记录</p>
                 <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5">点击上方按钮开始新剧本</p>
               </div>
            ) : (
              sessionsList.map(session => (
                <div key={session.id}
                  className="bg-white/60 dark:bg-white/10 backdrop-blur-2xl border border-white/40 dark:border-white/20 rounded-2xl p-4 relative
                    shadow-lg shadow-black/5
                    hover:bg-white/80 dark:hover:bg-white/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                >
                   <button
                     onClick={() => deleteJubenshaSession(session.id)}
                     className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/50 dark:bg-zinc-800/50 backdrop-blur-xl text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                   >
                     <Trash2 size={14} />
                   </button>
                   <div
                     className="cursor-pointer"
                     onClick={() => {
                        setCurrentSessionId(session.id);
                        setScript(session.script);
                        setMessages(session.messages || []);
                        setBgMode('custom'); setCustomBg(session.background);
                        setThemeMode('custom'); setCustomTheme(session.theme);
                        setSelectedCharIds(session.characterIds || []);
                        setCaseData(session.caseData || null);
                        setDiscoveredClues(session.discoveredClues || []);
                        setAccusedCharacterId(session.accusedCharacterId || null);
                        setEndingText(session.conclusion || '');
                        setSelectedLocation(session.caseData?.clues?.[0]?.location || '公共区域');
                        setPhase(session.phase || 'intro');
                        setStep(session.isFinished ? 'ending' : 'playing');
                     }}
                   >
                     <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-[15px] mb-1 pr-8">{session.name}</h3>
                     <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{new Date(session.updatedAt).toLocaleString()}</div>
                     <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <Users size={12} /> {session.characterIds?.map(id => characters[id]?.name || '未知').join('、')}
                     </div>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Background picker modal */}
        {showBgPicker && (
          <div className="absolute inset-0 z-[60] bg-black/20 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowBgPicker(false)}>
            <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl border border-white/40 dark:border-white/20 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">选择背景图</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {BG_PRESETS.map((url, i) => (
                  <button key={i} onClick={() => setBg(url)} className="w-full aspect-[3/2] rounded-xl overflow-hidden border border-white/30 dark:border-white/10 hover:opacity-80 transition-opacity shadow-sm">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-xl bg-white/40 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/30 dark:border-white/10 text-zinc-500 dark:text-zinc-400 text-sm font-medium hover:bg-white/60 dark:hover:bg-zinc-800/60 transition-colors">
                从相册导入
              </button>
              {bgUrl && (
                <button onClick={() => setBg(BG_PRESETS[0])} className="w-full py-3 rounded-xl text-zinc-400 dark:text-zinc-500 text-sm font-medium mt-2 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                  恢复默认
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgImport} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleAccuse = async () => {
    if (!caseData || !accusedCharacterId) return;
    setIsAiTyping(true);
    const accusedRole = caseData.roles.find(r => r.playerId === accusedCharacterId);
	    const accusedName = accusedCharacterId === 'user' ? '你自己' : accusedRole?.roleName || characters[accusedCharacterId]?.name || '未知角色';
    const isCorrect = accusedCharacterId === caseData.culpritId;
    const unlockedEndingId = isCorrect ? caseData.endings[0]?.id : caseData.endings[1]?.id;
    const defaultEnding = caseData.endings.find(ending => ending.id === unlockedEndingId) || caseData.endings[0];
    const prompt = `我们正在玩剧本杀，案件名是 ${caseData.caseTitle}。玩家最终指认了 ${accusedName}。
真相是：${caseData.truth}
请你以DM口吻写一个结局，总结玩家这次的推理过程与结局走向。要求：
1. 不要 Markdown
2. 不要出现星号和井号
3. 120字以内
4. 如果指认正确，偏"真相揭晓"；如果错误，偏"遗憾误判"`;
    try {
      const res = await generateAIResponse(prompt);
      const text = res.replace(/[#*]/g, '').trim();
      setEndingText(`${defaultEnding?.title || '结局'}\n${text}`);
      setStep('ending');
      if (currentSessionId) {
        updateJubenshaSession(currentSessionId, {
          accusedCharacterId,
          conclusion: text,
          isFinished: true,
          unlockedEndingIds: Array.from(new Set([...(useAppStore.getState().jubenshaSessions[currentSessionId || '']?.unlockedEndingIds || []), unlockedEndingId].filter(Boolean) as string[])),
          updatedAt: Date.now()
        });
      }
      addActivityLog({
        id: `${Date.now()}_jubensha`,
        title: `剧本杀结局 ${caseData.caseTitle}`,
        detail: `${defaultEnding?.title || '结局'}：指认了 ${accusedName}`,
        timestamp: Date.now(),
        relatedCharacterIds: selectedCharIds
      });
      if (selectedCharIds.length > 0) {
        selectedCharIds.forEach(charId => {
          saveInteractionMemory(charId, `在剧本杀《${caseData?.caseTitle}》中指认了${accusedName}`, text, 'event', 5);
          useAppStore.getState().addEmotionEvent({ characterId: charId, paDelta: isCorrect ? 0.25 : -0.1, naDelta: isCorrect ? -0.1 : 0.2, word: isCorrect ? '得意' : '不甘', valence: isCorrect ? 0.4 : -0.3, arousal: 0.5, matchSource: 'free_form', source: 'manual' });
          sendCharacterActivityFollowup(charId, `我刚刚完成了一局剧本杀《${caseData.caseTitle}》，最后指认了 ${accusedName}。请你主动发一条和这次剧本杀结果相关的微信消息给我。`);
        });
      }
    } catch {
      setEndingText(`${defaultEnding?.title || '结局'}\n${isCorrect ? '你拨开迷雾，看见了真相。' : '你做出了判断，但真相仍从指缝中滑走。'}`);
      setStep('ending');
    } finally {
      setIsAiTyping(false);
    }
  };

  // ─── SETUP SCREEN ───
  if (step === 'setup') {
    return (
      <div className="h-full flex flex-col absolute inset-0 z-50 overflow-hidden" style={{
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/50 backdrop-blur-md" />
        <div className="relative z-10 flex flex-col h-full">
          <div className="px-4 pt-7 pb-4 flex items-center justify-between border-b border-white/30 dark:border-white/10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-2xl">
            <button onClick={() => setStep('list')} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1"><ChevronLeft size={26} /></button>
            <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">创建剧本</h1>
            <div className="w-8" />
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <section>
              <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3">邀请角色 (至少2位)</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(char => (
                  <div
                    key={char.id}
                    onClick={() => toggleCharSelection(char.id)}
                    className={`shrink-0 w-20 flex flex-col items-center gap-2 cursor-pointer transition-all ${selectedCharIds.includes(char.id) ? 'opacity-100' : 'opacity-40 grayscale'}`}
                  >
                    <div className={`w-14 h-14 rounded-full overflow-hidden border-2 ${selectedCharIds.includes(char.id) ? 'border-zinc-400 dark:border-zinc-300' : 'border-transparent'}`} style={{ background: char.background }}>
                      {char.avatar && !char.avatar.startsWith('#') && <img src={char.avatar} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-[10px] text-center line-clamp-1 text-zinc-600 dark:text-zinc-400">{char.name}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3">选择背景</h2>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setBgMode('preset')} className={`flex-1 py-2 text-sm rounded-xl border ${bgMode === 'preset'
                  ? 'bg-white/70 dark:bg-white/20 backdrop-blur-xl border-zinc-300 dark:border-white/30 text-zinc-700 dark:text-zinc-200'
                  : 'bg-white/40 dark:bg-white/5 backdrop-blur-xl border-white/30 dark:border-white/10 text-zinc-500 dark:text-zinc-400'}`}>预设</button>
                <button onClick={() => setBgMode('custom')} className={`flex-1 py-2 text-sm rounded-xl border ${bgMode === 'custom'
                  ? 'bg-white/70 dark:bg-white/20 backdrop-blur-xl border-zinc-300 dark:border-white/30 text-zinc-700 dark:text-zinc-200'
                  : 'bg-white/40 dark:bg-white/5 backdrop-blur-xl border-white/30 dark:border-white/10 text-zinc-500 dark:text-zinc-400'}`}>自定义</button>
              </div>
              {bgMode === 'preset' ? (
                <div className="flex flex-wrap gap-2">
                  {BACKGROUNDS.map(bg => (
                    <button
                      key={bg} onClick={() => setSelectedBg(bg)}
                      className={`px-4 py-2 rounded-full text-sm border backdrop-blur-xl ${selectedBg === bg
                        ? 'bg-white/70 dark:bg-white/20 border-zinc-300 dark:border-white/30 text-zinc-700 dark:text-zinc-200'
                        : 'bg-white/40 dark:bg-white/5 border-white/30 dark:border-white/10 text-zinc-500 dark:text-zinc-400'}`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text" value={customBg} onChange={e => setCustomBg(e.target.value)}
                  placeholder="输入自定义背景..."
                  className="w-full bg-white/50 dark:bg-zinc-800/50 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-xl p-4 text-sm text-zinc-700 dark:text-zinc-300 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
              )}
            </section>

            <section>
              <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3">选择主题</h2>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setThemeMode('preset')} className={`flex-1 py-2 text-sm rounded-xl border ${themeMode === 'preset'
                  ? 'bg-white/70 dark:bg-white/20 backdrop-blur-xl border-zinc-300 dark:border-white/30 text-zinc-700 dark:text-zinc-200'
                  : 'bg-white/40 dark:bg-white/5 backdrop-blur-xl border-white/30 dark:border-white/10 text-zinc-500 dark:text-zinc-400'}`}>预设</button>
                <button onClick={() => setThemeMode('custom')} className={`flex-1 py-2 text-sm rounded-xl border ${themeMode === 'custom'
                  ? 'bg-white/70 dark:bg-white/20 backdrop-blur-xl border-zinc-300 dark:border-white/30 text-zinc-700 dark:text-zinc-200'
                  : 'bg-white/40 dark:bg-white/5 backdrop-blur-xl border-white/30 dark:border-white/10 text-zinc-500 dark:text-zinc-400'}`}>自定义</button>
              </div>
              {themeMode === 'preset' ? (
                <div className="flex flex-wrap gap-2">
                  {THEMES.map(themeItem => (
                    <button
                      key={themeItem} onClick={() => setSelectedTheme(themeItem)}
                      className={`px-4 py-2 rounded-full text-sm border backdrop-blur-xl ${selectedTheme === themeItem
                        ? 'bg-white/70 dark:bg-white/20 border-zinc-300 dark:border-white/30 text-zinc-700 dark:text-zinc-200'
                        : 'bg-white/40 dark:bg-white/5 border-white/30 dark:border-white/10 text-zinc-500 dark:text-zinc-400'}`}
                    >
                      {themeItem}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text" value={customTheme} onChange={e => setCustomTheme(e.target.value)}
                  placeholder="输入自定义主题..."
                  className="w-full bg-white/50 dark:bg-zinc-800/50 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-xl p-4 text-sm text-zinc-700 dark:text-zinc-300 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
              )}
            </section>
          </div>

          <div className="px-5 py-4 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-2xl border-t border-white/30 dark:border-white/10">
            <button
              onClick={startGame}
              disabled={selectedCharIds.length < 2 || (bgMode === 'custom' && !customBg) || (themeMode === 'custom' && !customTheme)}
              className="w-full py-4 rounded-2xl font-bold bg-white/70 dark:bg-white/20 backdrop-blur-xl border border-zinc-300 dark:border-white/30 text-zinc-700 dark:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 dark:hover:bg-white/30 transition-all"
            >
              生成剧本并开始
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── GENERATING SCREEN ───
  if (step === 'generating') {
    return (
      <div className="h-full flex flex-col items-center justify-center absolute inset-0 z-50" style={{
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/50 backdrop-blur-md" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-2xl flex items-center justify-center mb-6">
            <ScrollText size={36} className="text-zinc-400 dark:text-zinc-500 animate-pulse" />
          </div>
          <div className="text-xl font-bold text-zinc-700 dark:text-zinc-200 mb-2">正在生成剧本</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">这可能需要几十秒的时间</div>
        </div>
      </div>
    );
  }

  // ─── ENDING SCREEN ───
  if (step === 'ending') {
    const unlocked = caseData?.endings?.filter(ending => (useAppStore.getState().jubenshaSessions[currentSessionId || '']?.unlockedEndingIds || []).includes(ending.id)) || [];
    return (
      <div className="h-full flex flex-col absolute inset-0 z-50 overflow-hidden" style={{
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/50 backdrop-blur-md" />
        <div className="relative z-10 flex flex-col h-full">
          <div className="px-4 pt-7 pb-4 flex items-center justify-between border-b border-white/30 dark:border-white/10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-2xl">
            <button onClick={() => setStep('list')} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1"><ChevronLeft size={26} /></button>
            <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">结局</h1>
            <div className="w-8" />
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">{endingText}</div>
            {unlocked.length > 0 && (
              <div className="bg-white/60 dark:bg-white/10 backdrop-blur-2xl border border-white/40 dark:border-white/20 rounded-2xl p-4">
                <div className="font-bold mb-3 text-zinc-700 dark:text-zinc-300">已解锁结局</div>
                <div className="space-y-2">
                  {unlocked.map(ending => <div key={ending.id} className="text-zinc-500 dark:text-zinc-400 text-sm">{ending.title}：{ending.summary}</div>)}
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-4 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-2xl border-t border-white/30 dark:border-white/10 grid grid-cols-2 gap-3">
            <button onClick={() => setStep('setup')} className="py-3 rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/30 dark:border-white/10 text-zinc-500 dark:text-zinc-400 font-medium hover:bg-white/60 dark:hover:bg-white/10 transition-all">再来一次</button>
            <button onClick={() => setStep('list')} className="py-3 rounded-2xl bg-white/70 dark:bg-white/20 backdrop-blur-xl border border-zinc-300 dark:border-white/30 text-zinc-700 dark:text-zinc-200 font-bold hover:bg-white/90 dark:hover:bg-white/30 transition-all">返回首页</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── PLAYING SCREEN ───
  const playingPreset = resolvePreset(finalBg, finalTheme);
  const PlayingLayout = LAYOUT_MAP[playingPreset.layout];
  const userRole = caseData?.roles.find(r => r.playerId === 'user');

  return (
    <div className="absolute inset-0 z-50 flex flex-col">
      <PlayingLayout
        preset={playingPreset}
        config={{ background: finalBg, theme: finalTheme }}
        caseData={caseData}
        messages={messages}
        visibleClues={visibleClues}
        locations={locations}
        selectedLocation={selectedLocation}
        accusedCharacterId={accusedCharacterId}
        phase={phase}
        isAiTyping={isAiTyping}
        showControls={showControls}
        script={script}
        showScriptModal={showScriptModal}
        characters={characters}
        selectedCharIds={selectedCharIds}
        userRole={userRole}
        input={input}
        onBack={() => setStep('list')}
        onSend={handleSend}
        onInterrogate={handleInterrogate}
        onInvestigate={handleInvestigate}
        onAdvancePhase={advancePhase}
        onAccuse={handleAccuse}
        onSetAccused={setAccusedCharacterId}
        onSetInterrogateTarget={setInterrogateTarget}
        interrogateTarget={interrogateTarget}
        onSetLocation={setSelectedLocation}
        onToggleControls={() => setShowControls(prev => !prev)}
        onToggleScript={() => setShowScriptModal(prev => !prev)}
        onSetInput={setInput}
        messagesEndRef={messagesEndRef}
      />

      {/* Script Modal */}
      {showScriptModal && (
        <div className="absolute inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowScriptModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 w-full max-h-[80%] flex flex-col rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="font-bold text-white text-lg">剧本</h3>
              <button onClick={() => setShowScriptModal(false)} className="text-zinc-400 hover:text-white transition-colors text-sm">关闭</button>
            </div>
            <div className="p-4 overflow-y-auto whitespace-pre-wrap text-zinc-300 text-sm leading-relaxed">
              {script}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
