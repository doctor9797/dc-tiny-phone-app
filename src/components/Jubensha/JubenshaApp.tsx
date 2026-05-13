import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Scroll, ScrollText, Users, BookOpen, Send, Lightbulb, Search, Flag, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { generateAIResponse, sendCharacterActivityFollowup } from '../../lib/ai';
import { JubenshaCaseData } from '../../types';

const INS_BG = 'bg-[#f5f0eb]';
const INS_CARD = 'bg-white/80 backdrop-blur-2xl border border-white/60 rounded-2xl';
const INS_INPUT = 'bg-white/70 border border-[#e8ddd0] rounded-xl';
const INS_TEXT = 'text-[#2c2420]';
const INS_MUTED = 'text-[#8a7a6a]';
const INS_BTN = 'bg-[#2c2420] text-[#f5f0eb] hover:opacity-90';

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

type GameStep = 'list' | 'setup' | 'generating' | 'reading' | 'playing' | 'ending';

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
  const [endingText, setEndingText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [phase, setPhase] = useState<'intro' | 'investigation1' | 'discussion' | 'investigation2' | 'final_vote'>('intro');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const startGame = async () => {
    if (selectedCharIds.length < 2) return;

    setStep('generating');
    const finalBg = bgMode === 'preset' ? selectedBg : customBg;
    const finalTheme = themeMode === 'preset' ? selectedTheme : customTheme;
    const charNames = selectedCharIds.map(id => characters[id].name).join('、');

    const prompt = `我们要玩一场真实结构的剧本杀（角色扮演推理游戏）。
    背景：${finalBg}
    主题：${finalTheme}
    参与角色：我（玩家），以及 ${charNames}。
    请返回严格 JSON，不要 Markdown，不要解释。JSON 格式：
    {
      "caseTitle":"案件名",
      "background":"故事背景",
      "opening":"开场导语",
      "incident":"核心事件",
      "truth":"完整真相",
      "culpritId":"某个参与角色id，必须是 user 或角色id",
      "userRoleId":"user",
      "roles":[
        {"playerId":"user","roleName":"角色名","publicIdentity":"公开身份","personality":"角色性格","backstory":"过往经历","secret":"隐藏秘密","objective":"个人目标"},
        {"playerId":"bruce","roleName":"角色名","publicIdentity":"公开身份","personality":"角色性格","backstory":"过往经历","secret":"隐藏秘密","objective":"个人目标"}
      ],
      "clues":[
        {"id":"c1","title":"线索名","detail":"线索内容","holderId":"某角色id","location":"地点"}
      ],
      "endings":[
        {"id":"e1","title":"真相大白","summary":"达成结局描述","condition":"正确指出真凶并串联关键线索"},
        {"id":"e2","title":"误判","summary":"错误指认真凶的结局","condition":"指认错误"},
        {"id":"e3","title":"沉默者","summary":"拖太久或没有做出判断的结局","condition":"迟迟不下结论"}
      ]
    }
    规则：
    1. 每个玩家都在扮演角色，角色名、经历、性格、秘密必须完整。
    2. 角色性格可以和玩家本人不同。
    3. 必须有真凶和完整真相。
    4. 必须有至少 6 条可探索线索。
    5. 必须有至少 3 个不同结局。`;

    try {
      const generated = await generateAIResponse(prompt);
      const caseJson = JSON.parse(generated.replace(/```json|```/g, '').trim()) as JubenshaCaseData;
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
      setStep('reading');
      setMessages([{ role: 'system', text: '游戏开始。你已经阅读了剧本，现在可以开始你的行动或对话。' }]);
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
    const roleBrief = (caseData?.roles || []).map(role => `${role.playerId}: ${role.roleName}，公开身份=${role.publicIdentity}，性格=${role.personality}，经历=${role.backstory}，秘密=${role.secret}，目标=${role.objective}`).join('\n');

    const history = messages.slice(-10).map(m => {
      if (m.role === 'system') return `[系统]: ${m.text}`;
      if (m.role === 'user') return `[我]: ${m.text}`;
      return `[${m.name}]: ${m.text}`;
    }).join('\n');

    const prompt = `我们在玩真实剧本杀。背景：${finalBg}，主题：${finalTheme}。
    参与角色：我，以及 ${charNames}。
    当前案件：${caseData?.caseTitle}
    当前阶段：${phase}
    角色设定：
    ${roleBrief}
    完整真相（只给你内部参考，不能轻易直白说破）：${caseData?.truth}
    我已发现的线索：
    ${knownClues || '暂无'}
    这是最近的对话/行动记录：
    ${history}
    [我]: ${userText}

    ${isHintRequest
      ? '玩家请求了提示。请你扮演其中一个或几个角色，给出非常隐晦、不直白的提示。绝对不能直接说出真相或凶手，而是通过角色语气说出一些细思极恐的细节或引导性的疑问。'
      : `请你根据我的行动/语言，扮演其他角色（一个或多个）进行回应，或者作为DM描述环境变化。在不同阶段的要求：
	intro=偏自我介绍和气氛建立；
	investigation1/investigation2=偏搜证、试探、藏信息；
	discussion=偏互相怀疑和推理；
	final_vote=偏最后陈述。并在合适时给出一条新的可探索线索。`}

    请按照以下格式输出回应（可以有多行，每行代表一个角色的说话或系统描述）：
    角色名: 说话内容
    或者
    系统: 环境描述
    或者
    线索: 线索标题｜线索内容`;

    try {
      const reply = await generateAIResponse(prompt);

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
你现在扮演 ${characters[charId]?.name}，其角色名为 ${role?.roleName}，公开身份是 ${role?.publicIdentity}，角色性格是 ${role?.personality}，角色秘密是 ${role?.secret}。
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
      setMessages(prev => [...prev, { role: 'character', name: characters[charId]?.name, text: reply.replace(/[#*]/g, '').trim() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'character', name: characters[charId]?.name, text: '这件事，我暂时不想说得太明白。' }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const advancePhase = () => {
    const phaseOrder = ['intro', 'investigation1', 'discussion', 'investigation2', 'final_vote'] as const;
    const currentIndex = phaseOrder.indexOf(phase);
    const nextPhase = phaseOrder[Math.min(currentIndex + 1, phaseOrder.length - 1)];
    setPhase(nextPhase);
    setMessages(prev => [...prev, { role: 'system', text: `阶段推进：${nextPhase === 'intro' ? '破冰介绍' : nextPhase === 'investigation1' ? '第一轮搜证' : nextPhase === 'discussion' ? '集中讨论' : nextPhase === 'investigation2' ? '第二轮搜证' : '最终指认'}。` }]);
    if (currentSessionId) updateJubenshaSession(currentSessionId, { phase: nextPhase, updatedAt: Date.now() });
  };

  const bgStyle = bgUrl ? {
    backgroundImage: `url(${bgUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : {};

  // ─── LIST SCREEN ───
  if (step === 'list') {
    const sessionsList = Object.values(jubenshaSessions).sort((a, b) => b.updatedAt - a.updatedAt);
    return (
      <div className={`h-full flex flex-col ${INS_BG} absolute inset-0 z-50`} style={bgStyle}>
        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
        <div className="relative z-10 flex flex-col h-full">
          <div className="bg-white/40 backdrop-blur-xl px-4 pt-12 pb-4 flex items-center justify-between border-b border-stone-200/50">
            <button onClick={closeApp} className="text-stone-500"><ChevronLeft size={28} /></button>
            <h1 className="text-lg font-bold text-[#2c2420]">剧本杀</h1>
            <div className="flex gap-2">
              <button onClick={() => setShowBgPicker(true)} className="p-1.5 rounded-xl bg-white/40 text-stone-500">
                <ImageIcon size={18} />
              </button>
              <div className="w-8" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <button
              onClick={() => setStep('setup')}
              className="w-full bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-lg font-semibold rounded-2xl p-4 flex items-center justify-center gap-3 shadow-lg"
            >
              <Plus size={20} />
              开启新剧本
            </button>

            {sessionsList.length === 0 ? (
               <div className="text-center py-16">
                 <ScrollText size={64} className="mx-auto mb-4 text-stone-300" />
                 <p className="font-medium text-[#2c2420]">暂无游玩记录</p>
                 <p className="text-sm text-stone-400 mt-1">点击上方按钮开始新剧本</p>
               </div>
            ) : (
              sessionsList.map(session => (
                <div key={session.id} className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-2xl p-4 relative">
                   <button
                     onClick={() => deleteJubenshaSession(session.id)}
                     className="absolute top-4 right-4 p-2 rounded-full bg-red-50 text-red-500"
                   >
                     <Trash2 size={16} />
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
                     <h3 className="font-bold text-lg text-[#2c2420]mb-1">{session.name}</h3>
                     <div className="text-xs text-stone-400 mb-3">{new Date(session.updatedAt).toLocaleString()}</div>
                     <div className="flex items-center gap-2 text-xs text-stone-400">
                        <Users size={12} /> {session.characterIds?.map(id => characters[id]?.name || '未知').join('、')}
                     </div>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>
        {showBgPicker && (
          <div className="absolute inset-0 z-[60] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowBgPicker(false)}>
            <div className="bg-white/80 backdrop-blur-2xl rounded-2xl p-5 w-full max-w-sm border border-white/60" onClick={e => e.stopPropagation()}>
              <div className="text-sm font-semibold text-[#2c2420]mb-4">选择背景图</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {BG_PRESETS.map((url, i) => (
                  <button key={i} onClick={() => setBg(url)} className="w-full aspect-[3/2] rounded-xl overflow-hidden border border-stone-200/50 hover:opacity-80 transition-opacity">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-xl border border-stone-200/50 text-stone-600 text-sm font-medium">
                从相册导入
              </button>
              {bgUrl && (
                <button onClick={() => setBg('')} className="w-full py-3 rounded-xl text-red-500 text-sm font-medium mt-2">
                  清除背景图
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
    const accusedName = accusedCharacterId === 'user' ? '你自己' : characters[accusedCharacterId]?.name || '未知角色';
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
      if (selectedCharIds[0]) {
        sendCharacterActivityFollowup(selectedCharIds[0], `我刚刚完成了一局剧本杀《${caseData.caseTitle}》，最后指认了 ${accusedName}。请你主动发一条和这次剧本杀结果相关的微信消息给我。`);
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
      <div className={`h-full flex flex-col ${INS_BG} absolute inset-0 z-50`} style={bgStyle}>
        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
        <div className="relative z-10 flex flex-col h-full">
          <div className="bg-white/40 backdrop-blur-xl px-4 pt-12 pb-4 flex items-center justify-between border-b border-stone-200/50">
            <button onClick={() => setStep('list')} className="text-stone-500"><ChevronLeft size={28} /></button>
            <h1 className="text-lg font-bold text-[#2c2420]">创建剧本</h1>
            <div className="w-8"></div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <section>
              <h2 className="text-sm font-bold text-stone-500 mb-3">邀请角色 (至少2位)</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(char => (
                  <div
                    key={char.id}
                    onClick={() => toggleCharSelection(char.id)}
                    className={`shrink-0 w-20 flex flex-col items-center gap-2 cursor-pointer transition-all ${selectedCharIds.includes(char.id) ? 'opacity-100' : 'opacity-40 grayscale'}`}
                  >
                    <div className={`w-14 h-14 rounded-full overflow-hidden border-2 ${selectedCharIds.includes(char.id) ? 'border-[#8a7a6a] shadow-lg' : 'border-transparent'}`} style={{ background: char.background }}>
                      {char.avatar && !char.avatar.startsWith('#') && <img src={char.avatar} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-[10px] text-center line-clamp-1 text-stone-700">{char.name}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-stone-500 mb-3">选择背景</h2>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setBgMode('preset')} className={`flex-1 py-2 text-sm rounded-xl border ${bgMode === 'preset' ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-sm' : `${INS_CARD} text-stone-600 border-stone-200/50`}`}>预设</button>
                <button onClick={() => setBgMode('custom')} className={`flex-1 py-2 text-sm rounded-xl border ${bgMode === 'custom' ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-sm' : `${INS_CARD} text-stone-600 border-stone-200/50`}`}>自定义</button>
              </div>
              {bgMode === 'preset' ? (
                <div className="flex flex-wrap gap-2">
                  {BACKGROUNDS.map(bg => (
                    <button
                      key={bg} onClick={() => setSelectedBg(bg)}
                      className={`px-4 py-2 rounded-full text-sm border ${selectedBg === bg ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-sm' : `${INS_CARD} text-stone-600`}`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text" value={customBg} onChange={e => setCustomBg(e.target.value)}
                  placeholder="输入自定义背景..."
                  className={`w-full border border-stone-200/50 rounded-xl p-4 text-sm outline-none ${INS_CARD} t`}
                />
              )}
            </section>

            <section>
              <h2 className="text-sm font-bold text-stone-500 mb-3">选择主题</h2>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setThemeMode('preset')} className={`flex-1 py-2 text-sm rounded-xl border ${themeMode === 'preset' ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-sm' : `${INS_CARD} text-stone-600 border-stone-200/50`}`}>预设</button>
                <button onClick={() => setThemeMode('custom')} className={`flex-1 py-2 text-sm rounded-xl border ${themeMode === 'custom' ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-sm' : `${INS_CARD} text-stone-600 border-stone-200/50`}`}>自定义</button>
              </div>
              {themeMode === 'preset' ? (
                <div className="flex flex-wrap gap-2">
                  {THEMES.map(themeItem => (
                    <button
                      key={themeItem} onClick={() => setSelectedTheme(themeItem)}
                      className={`px-4 py-2 rounded-full text-sm border ${selectedTheme === themeItem ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-sm' : `${INS_CARD} text-stone-600`}`}
                    >
                      {themeItem}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text" value={customTheme} onChange={e => setCustomTheme(e.target.value)}
                  placeholder="输入自定义主题..."
                  className={`w-full border border-stone-200/50 rounded-xl p-4 text-sm outline-none ${INS_CARD} t`}
                />
              )}
            </section>
          </div>

          <div className="bg-white/40 backdrop-blur-xl px-5 py-4 border-t border-stone-200/50">
            <button
              onClick={startGame}
              disabled={selectedCharIds.length < 2 || (bgMode === 'custom' && !customBg) || (themeMode === 'custom' && !customTheme)}
              className="w-full py-4 rounded-2xl font-bold bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
      <div className={`h-full flex flex-col items-center justify-center ${INS_BG} absolute inset-0 z-50`} style={bgStyle}>
        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
        <div className="relative z-10 flex flex-col items-center">
          <ScrollText size={80} className="mb-6 text-stone-300 animate-pulse" />
          <div className="text-xl font-bold text-[#2c2420]mb-2">正在生成剧本</div>
          <div className="text-sm text-stone-400">这可能需要几十秒的时间</div>
        </div>
      </div>
    );
  }

  // ─── READING SCREEN ───
  if (step === 'reading') {
    return (
      <div className={`h-full flex flex-col ${INS_BG} absolute inset-0 z-50`} style={bgStyle}>
        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
        <div className="relative z-10 flex flex-col h-full">
          <div className="bg-white/40 backdrop-blur-xl px-4 pt-12 pb-4 flex items-center justify-between border-b border-stone-200/50">
            <button onClick={() => setStep('list')} className="text-stone-500"><ChevronLeft size={28} /></button>
            <h1 className="text-lg font-bold text-[#2c2420]">你的剧本</h1>
            <div className="w-8"></div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className={`whitespace-pre-wrap leading-loose t`}>{script}</div>
          </div>

          <div className="bg-white/40 backdrop-blur-xl px-5 py-4 border-t border-stone-200/50">
            <button
              onClick={() => setStep('playing')}
              className="w-full py-4 rounded-2xl font-bold bg-white/50 backdrop-blur-xl border border-white/30 text-[#2c2420] hover:bg-white/20 transition-colors"
            >
              阅读完毕，进入游戏
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ENDING SCREEN ───
  if (step === 'ending') {
    const unlocked = caseData?.endings?.filter(ending => (useAppStore.getState().jubenshaSessions[currentSessionId || '']?.unlockedEndingIds || []).includes(ending.id)) || [];
    return (
      <div className={`h-full flex flex-col ${INS_BG} absolute inset-0 z-50`} style={bgStyle}>
        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
        <div className="relative z-10 flex flex-col h-full">
          <div className="bg-white/40 backdrop-blur-xl px-4 pt-12 pb-4 flex items-center justify-between border-b border-stone-200/50">
            <button onClick={() => setStep('list')} className="text-stone-500"><ChevronLeft size={28} /></button>
            <h1 className="text-lg font-bold text-[#2c2420]">结局</h1>
            <div className="w-8"></div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="whitespace-pre-wrap leading-relaxed text-[#2c2420]">{endingText}</div>
            {unlocked.length > 0 && (
              <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-2xl p-4">
                <div className="font-bold mb-3 text-[#2c2420]">已解锁结局</div>
                <div className="space-y-2">
                  {unlocked.map(ending => <div key={ending.id} className="text-stone-500">{ending.title}：{ending.summary}</div>)}
                </div>
              </div>
            )}
          </div>
          <div className="bg-white/40 backdrop-blur-xl px-5 py-4 grid grid-cols-2 gap-3 border-t border-stone-200/50">
            <button onClick={() => setStep('setup')} className="py-3 rounded-2xl bg-white/50 backdrop-blur-xl border border-white/30 text-[#2c2420]font-medium">再来一次</button>
            <button onClick={() => setStep('list')} className="py-3 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-lg font-bold">返回首页</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── PLAYING SCREEN ───
  return (
    <div className={`h-full flex flex-col ${INS_BG} absolute inset-0 z-50`} style={bgStyle}>
      <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="bg-white/40 backdrop-blur-xl px-4 pt-12 pb-3 flex items-center justify-between border-b border-stone-200/50">
          <button onClick={() => setStep('list')} className="text-stone-500"><ChevronLeft size={28} /></button>
          <div className="text-xs font-medium text-stone-500">
            {phase === 'intro' ? '破冰介绍' : phase === 'investigation1' ? '第一轮搜证' : phase === 'discussion' ? '集中讨论' : phase === 'investigation2' ? '第二轮搜证' : '最终指认'}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowScriptModal(true)} className="p-2 rounded-xl bg-white/40">
              <BookOpen size={18} className="text-stone-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {caseData && (
            <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-2xl p-4">
              <div className="text-xs font-semibold text-stone-500 mb-2">我的角色卡</div>
              <div className="space-y-1">
                <div><span className="font-semibold text-[#2c2420]">角色名：</span><span className="text-stone-500">{caseData.roles.find(role => role.playerId === 'user')?.roleName}</span></div>
                <div><span className="font-semibold text-[#2c2420]">公开身份：</span><span className="text-stone-500">{caseData.roles.find(role => role.playerId === 'user')?.publicIdentity}</span></div>
              </div>
            </div>
          )}

          {caseData && (
            <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-2xl p-4">
              <div className="text-xs font-semibold text-stone-500 mb-2">在场角色</div>
              <div className="space-y-2">
                {caseData.roles.filter(role => role.playerId !== 'user').map(role => (
                  <div key={role.playerId} className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#2c2420]">{characters[role.playerId]?.name}</div>
                      <div className="text-xs text-stone-500">{role.publicIdentity}</div>
                    </div>
                    <button onClick={() => handleInterrogate(role.playerId)} className="px-4 py-2 rounded-xl text-sm font-medium bg-white/50 backdrop-blur-xl border border-white/30 text-[#2c2420]">
                      盘问
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleClues.length > 0 && (
            <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-2xl p-4">
              <div className="text-xs font-semibold text-stone-500 mb-2">已发现线索</div>
              <div className="space-y-2">
                {visibleClues.map(clue => (
                  <div key={clue.id}>
                    <div className="font-semibold text-[#2c2420]">{clue.title}</div>
                    <div className="text-sm text-stone-500">{clue.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'character' && <span className="text-[10px] text-stone-500 mb-1 ml-1">{msg.name}</span>}
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-lg rounded-br-none' :
                msg.role === 'system' ? 'bg-white/50 backdrop-blur-xl text-stone-500 italic text-center w-full max-w-full border border-white/30' :
                'bg-white/50 backdrop-blur-xl border border-white/30 text-[#2c2420]rounded-bl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isAiTyping && (
            <div className="flex items-start">
              <div className="bg-white/50 backdrop-blur-xl text-stone-500 p-3 rounded-2xl rounded-bl-none text-sm animate-pulse border border-white/30">
                ...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-white/40 backdrop-blur-xl px-4 py-4 space-y-3 border-t border-stone-200/50">
          <button onClick={advancePhase} disabled={phase === 'final_vote'} className="w-full py-2.5 rounded-xl bg-white/50 backdrop-blur-xl border border-white/30 text-[#2c2420]text-sm font-medium disabled:opacity-40">
            推进阶段
          </button>
          <div className="flex gap-2">
            <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-xl p-3 text-sm text-[#2c2420]flex-1">
              {locations.map(location => <option key={location} value={location}>{location}</option>)}
            </select>
            <button onClick={handleInvestigate} disabled={!(phase === 'investigation1' || phase === 'investigation2')} className="px-4 rounded-xl bg-white/50 backdrop-blur-xl border border-white/30 text-stone-600 disabled:opacity-40">
              <Search size={18} />
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={accusedCharacterId || ''}
              onChange={e => setAccusedCharacterId(e.target.value)}
              className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-xl p-3 text-sm text-[#2c2420]flex-1"
            >
              <option value="">选择指认对象</option>
              <option value="user">我自己</option>
              {selectedCharIds.map(id => <option key={id} value={id}>{characters[id].name}</option>)}
            </select>
            <button onClick={handleAccuse} disabled={!accusedCharacterId || isAiTyping || phase !== 'final_vote'} className="px-5 rounded-xl bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-lg font-bold disabled:opacity-50">
              <Flag size={18} />
            </button>
          </div>
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="输入你的行动或对话..."
              className="flex-1 bg-white/60 border border-stone-200/50 rounded-2xl p-3 text-sm text-[#2c2420]outline-none resize-none"
              rows={1}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isAiTyping}
              className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-lg flex items-center justify-center disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        {showScriptModal && (
          <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowScriptModal(false)}>
            <div className={`${INS_BG} border border-white/30 rounded-2xl w-full max-h-[80%] flex flex-col`} onClick={e => e.stopPropagation()}>
              <div className="bg-white/40 backdrop-blur-xl p-4 border-b border-stone-200/50 flex justify-between items-center rounded-t-2xl">
                <h3 className="font-bold text-[#2c2420]">你的剧本</h3>
                <button onClick={() => setShowScriptModal(false)} className="text-stone-500">关闭</button>
              </div>
              <div className="p-4 overflow-y-auto whitespace-pre-wrap text-[#2c2420]">
                {script}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
