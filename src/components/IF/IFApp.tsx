import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, History, Sparkles, Trash2, Play, Plus, SendHorizonal, UserRound, Theater, Wand2, Users } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { IFRoleIdentity, IFSession, IFSessionMessage } from '../../types';

const BACKGROUNDS = ['现代都市', '赛博朋克', '西幻王国', '校园', '末日废土', '悬浮星港', '民国迷城', '神祇都市', '哥谭夜色', '异能研究所'];
const THEMES = ['暧昧拉扯', '生存冒险', '权谋博弈', '日常治愈', '黑色幽默', '宿命对抗', '轻悬疑', '公路流浪', '高压任务', '宇宙奇遇'];

type ViewMode = 'list' | 'setup' | 'generating' | 'play';

const cleanNarrativeText = (text: string) =>
  (text || '')
    .replace(/```json|```/g, '')
    .replace(/^[#*\-\s]+/gm, '')
    .replace(/[*#`_]/g, '')
    .trim();

const parseJsonBlock = <T,>(text: string): T => JSON.parse(cleanNarrativeText(text)) as T;

const parseSceneReply = (text: string): IFSessionMessage[] => {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [{ role: 'narrator', name: '旁白', text: cleanNarrativeText(text) }];
  }

  return lines.map(line => {
    const match = line.match(/^([^:：]{1,18})[:：]\s*(.+)$/);
    if (!match) {
      return { role: 'narrator' as const, name: '旁白', text: line };
    }
    const speaker = match[1].trim();
    const content = cleanNarrativeText(match[2]);
    if (speaker === '系统') return { role: 'system' as const, name: '系统', text: content };
    if (speaker === '旁白' || speaker === '环境') return { role: 'narrator' as const, name: '旁白', text: content };
    return { role: 'character' as const, name: speaker, text: content };
  });
};

export default function IFApp() {
  const {
    closeApp,
    characters,
    worldSettings,
    ifSessions,
    createIFSession,
    updateIFSession,
    deleteIFSession,
    addActivityLog,
  } = useAppStore();

  const enabledCharacters = useMemo(
    () => Object.values(characters).filter(char => (char as any).isDisabled !== true),
    [characters]
  );

  const sessions = useMemo(
    () => Object.values(ifSessions || {}).sort((a, b) => b.updatedAt - a.updatedAt),
    [ifSessions]
  );

  const [view, setView] = useState<ViewMode>('list');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [backgroundMode, setBackgroundMode] = useState<'preset' | 'custom'>('preset');
  const [selectedBackground, setSelectedBackground] = useState(BACKGROUNDS[0]);
  const [customBackground, setCustomBackground] = useState('');
  const [themeMode, setThemeMode] = useState<'preset' | 'custom'>('preset');
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [customTheme, setCustomTheme] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<IFSessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<IFSession | null>(null);
  const [showWorldInfo, setShowWorldInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const resetSetup = () => {
    setSelectedCharIds([]);
    setBackgroundMode('preset');
    setSelectedBackground(BACKGROUNDS[0]);
    setCustomBackground('');
    setThemeMode('preset');
    setSelectedTheme(THEMES[0]);
    setCustomTheme('');
    setCurrentSessionId(null);
    setCurrentSession(null);
    setMessages([]);
    setInput('');
    setLoading(false);
  };

  const openSession = (session: IFSession) => {
    setCurrentSessionId(session.id);
    setCurrentSession(session);
    setMessages(session.messages || []);
    setView('play');
  };

  const toggleCharacter = (id: string) => {
    setSelectedCharIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const startGame = async () => {
    if (selectedCharIds.length < 1) return;
    setView('generating');
    setLoading(true);

    const finalBackground = backgroundMode === 'preset' ? selectedBackground : customBackground.trim();
    const finalTheme = themeMode === 'preset' ? selectedTheme : customTheme.trim();
    const worldSummary = worldSettings.map(item => `${item.title}：${item.content}`).join('\n');
    const charSummary = selectedCharIds
      .map(id => {
        const char = characters[id];
        return `${id} / ${char.name} / 性格=${char.personality} / 关系=${char.relationship}`;
      })
      .join('\n');

    const prompt = `你要创建一个高自由度的 IF 互动叙事世界。
背景：${finalBackground}
主题：${finalTheme}
世界设定参考：
${worldSummary || '暂无'}
参与角色：
${charSummary}

请返回严格 JSON，不要 Markdown，不要解释。格式：
{
  "name":"本次世界名",
  "worldSummary":"这个宇宙当前的整体设定摘要，120字内",
  "opening":"开场文字，直接把人带入当前宇宙，120到220字",
  "userIdentity":{"playerId":"user","name":"我","identity":"我的身份","publicStatus":"公开身份/处境","personality":"这个宇宙下我的状态","goal":"我当前可能想做的事","hiddenInfo":"可留空"},
  "characterIdentities":[
    {"playerId":"bruce","name":"布鲁斯","identity":"该角色在此宇宙的身份","publicStatus":"公开身份/处境","personality":"在此宇宙下的性格状态","goal":"当前诉求","hiddenInfo":"隐藏信息"}
  ],
  "firstMessages":[
    {"role":"narrator","name":"旁白","text":"环境描述"},
    {"role":"character","name":"角色名","text":"角色第一句"}
  ]
}
规则：
1. 高自由度，不要做成剧本杀、也不要做成必须破案。
2. 重点是不同宇宙的多样性，可以荒诞、浪漫、危险、温柔、失控。
3. 用户身份和所有角色身份必须明确，而且要和背景/主题强相关。
4. 角色之间不必全是原设身份，允许平行宇宙重构。
5. 开场后要能让用户立刻自由行动。`;

    try {
      const generated = parseJsonBlock<{
        name: string;
        worldSummary: string;
        opening: string;
        userIdentity: IFRoleIdentity;
        characterIdentities: IFRoleIdentity[];
        firstMessages?: IFSessionMessage[];
      }>(await generateAIResponse(prompt));

      const sessionId = Date.now().toString();
      const baseMessages: IFSessionMessage[] = [
        { role: 'system', name: '系统', text: cleanNarrativeText(`你在这个世界的身份：${generated.userIdentity.identity}。${generated.userIdentity.publicStatus}`) },
        { role: 'narrator', name: '旁白', text: cleanNarrativeText(generated.opening) },
        ...((generated.firstMessages || []).map(item => ({
          role: item.role || 'narrator',
          name: item.name,
          text: cleanNarrativeText(item.text)
        } as IFSessionMessage)))
      ];

      const session: IFSession = {
        id: sessionId,
        name: generated.name || `${finalBackground} · ${finalTheme}`,
        background: finalBackground,
        theme: finalTheme,
        characterIds: selectedCharIds,
        opening: generated.opening,
        worldSummary: generated.worldSummary || '',
        userIdentity: generated.userIdentity,
        characterIdentities: generated.characterIdentities || [],
        messages: baseMessages,
        updatedAt: Date.now()
      };

      createIFSession(session);
      addActivityLog({
        id: `${Date.now()}_if_start`,
        title: `开启 IF：${session.name}`,
        detail: `${session.background} / ${session.theme}`,
        timestamp: Date.now(),
        relatedCharacterIds: selectedCharIds
      });
      setCurrentSessionId(sessionId);
      setCurrentSession(session);
      setMessages(baseMessages);
      setShowWorldInfo(false);
      setView('play');
    } catch (error: any) {
      const fallbackMessages: IFSessionMessage[] = [
        { role: 'system', name: '系统', text: '这个宇宙创建失败了，请换个背景或主题再试一次。' },
        { role: 'narrator', name: '旁白', text: error?.message || '生成失败' }
      ];
      setMessages(fallbackMessages);
      setView('play');
      setCurrentSession(null);
      setCurrentSessionId(null);
    } finally {
      setLoading(false);
    }
  };

  const pushScene = async () => {
    if (!currentSession || !currentSessionId || !input.trim()) return;
    const userAction = input.trim();
    const nextMessages = [...messages, { role: 'user' as const, name: '我', text: userAction }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    const recentHistory = nextMessages.slice(-14).map(message => {
      const speaker = message.name || (message.role === 'user' ? '我' : message.role === 'narrator' ? '旁白' : '系统');
      return `${speaker}: ${message.text}`;
    }).join('\n');

    const characterIdentitySummary = currentSession.characterIdentities
      .map(item => `${item.name} / 身份=${item.identity} / 公开处境=${item.publicStatus} / 目标=${item.goal} / 隐藏信息=${item.hiddenInfo || '无'}`)
      .join('\n');

    const prompt = `我们正在进行一个高自由度 IF 互动叙事。
世界名：${currentSession.name}
背景：${currentSession.background}
主题：${currentSession.theme}
当前世界摘要：${currentSession.worldSummary}
用户身份：${currentSession.userIdentity.identity} / ${currentSession.userIdentity.publicStatus} / 目标=${currentSession.userIdentity.goal}
其他角色身份：
${characterIdentitySummary}

最近发生的事：
${recentHistory}

用户刚刚输入的行动是：
我：${userAction}

请继续推进这个宇宙。
要求：
1. 高自由度，不要把用户强行塞回固定剧情。
2. 可以由旁白描述环境，也可以让一个或多个角色回应。
3. 不要过度总结，要有现场感。
4. 保持人物身份一致，但允许剧情往意外方向发展。
5. 不要使用括号动作描写。
6. 输出格式只能是一行一个单位：
旁白: 内容
角色名: 内容
系统: 内容
最多输出 5 行。`;

    try {
      const reply = await generateAIResponse(prompt);
      const sceneMessages = parseSceneReply(reply);
      const persistedMessages = [...nextMessages, ...sceneMessages];
      setMessages(persistedMessages);
      const updatedSession: IFSession = {
        ...currentSession,
        messages: persistedMessages,
        updatedAt: Date.now()
      };
      setCurrentSession(updatedSession);
      updateIFSession(currentSessionId, {
        messages: persistedMessages,
        updatedAt: updatedSession.updatedAt
      });
      for (const charId of currentSession.characterIds) {
        saveInteractionMemory(charId, `在IF世界《${currentSession.name}》中和我一起推进剧情`, userAction);
        useAppStore.getState().addEmotionEvent({ characterId: charId, paDelta: 0.1, naDelta: -0.02, word: '沉浸', valence: 0.3, arousal: 0.4, matchSource: 'free_form', source: 'manual' });
      }
    } catch (error: any) {
      const failMessage: IFSessionMessage = { role: 'system', name: '系统', text: error?.message || '推进失败，请重试。' };
      const persistedMessages = [...nextMessages, failMessage];
      setMessages(persistedMessages);
      updateIFSession(currentSessionId, {
        messages: persistedMessages,
        updatedAt: Date.now()
      });
    } finally {
      setLoading(false);
    }
  };

  if (view === 'setup') {
    return (
      <div className="h-full flex flex-col bg-[#f7f2ea] text-slate-900">
        <div className="px-4 pt-7 pb-4 flex items-center justify-between border-b border-stone-200 bg-[#fbf7f1]">
          <button onClick={() => { resetSetup(); setView('list'); }}><ChevronLeft size={28} /></button>
          <div className="font-black tracking-wide">创建 IF</div>
          <div className="w-7" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-[1.75rem] bg-white border border-stone-200 p-4">
            <div className="flex items-center gap-2 font-bold mb-3"><Users size={18} /> 选择角色</div>
            <div className="text-xs text-slate-500 mb-3">至少选择 1 位，无上限。</div>
            <div className="grid grid-cols-2 gap-2">
              {enabledCharacters.map(char => (
                <button
                  key={char.id}
                  onClick={() => toggleCharacter(char.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all ${selectedCharIds.includes(char.id) ? 'border-amber-500 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}
                >
                  <div className="font-semibold">{char.name}</div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{char.personality}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-white border border-stone-200 p-4">
            <div className="flex items-center gap-2 font-bold mb-3"><Theater size={18} /> 背景</div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setBackgroundMode('preset')} className={`px-3 py-1.5 rounded-full text-sm ${backgroundMode === 'preset' ? 'bg-slate-900 text-white' : 'bg-stone-100'}`}>预设</button>
              <button onClick={() => setBackgroundMode('custom')} className={`px-3 py-1.5 rounded-full text-sm ${backgroundMode === 'custom' ? 'bg-slate-900 text-white' : 'bg-stone-100'}`}>自定义</button>
            </div>
            {backgroundMode === 'preset' ? (
              <div className="flex flex-wrap gap-2">
                {BACKGROUNDS.map(item => (
                  <button key={item} onClick={() => setSelectedBackground(item)} className={`px-3 py-2 rounded-full text-sm ${selectedBackground === item ? 'bg-violet-100 text-violet-700 border border-violet-300' : 'bg-stone-100 text-slate-700 border border-transparent'}`}>{item}</button>
                ))}
              </div>
            ) : (
              <input value={customBackground} onChange={e => setCustomBackground(e.target.value)} placeholder="自定义背景，例如：时间停滞的海上赌场" className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none" />
            )}
          </div>

          <div className="rounded-[1.75rem] bg-white border border-stone-200 p-4">
            <div className="flex items-center gap-2 font-bold mb-3"><Wand2 size={18} /> 主题</div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setThemeMode('preset')} className={`px-3 py-1.5 rounded-full text-sm ${themeMode === 'preset' ? 'bg-slate-900 text-white' : 'bg-stone-100'}`}>预设</button>
              <button onClick={() => setThemeMode('custom')} className={`px-3 py-1.5 rounded-full text-sm ${themeMode === 'custom' ? 'bg-slate-900 text-white' : 'bg-stone-100'}`}>自定义</button>
            </div>
            {themeMode === 'preset' ? (
              <div className="flex flex-wrap gap-2">
                {THEMES.map(item => (
                  <button key={item} onClick={() => setSelectedTheme(item)} className={`px-3 py-2 rounded-full text-sm ${selectedTheme === item ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-stone-100 text-slate-700 border border-transparent'}`}>{item}</button>
                ))}
              </div>
            ) : (
              <input value={customTheme} onChange={e => setCustomTheme(e.target.value)} placeholder="自定义主题，例如：白天是同事，晚上是通缉犯" className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none" />
            )}
          </div>
        </div>
        <div className="p-4 border-t border-stone-200 bg-[#fbf7f1]">
          <button
            onClick={() => void startGame()}
            disabled={selectedCharIds.length < 1 || (backgroundMode === 'custom' && !customBackground.trim()) || (themeMode === 'custom' && !customTheme.trim())}
            className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-bold disabled:opacity-50"
          >
            开始进入这个宇宙
          </button>
        </div>
      </div>
    );
  }

  if (view === 'generating') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#16151c] text-white px-8 text-center">
        <div className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center mb-5 animate-pulse">
          <Sparkles size={28} />
        </div>
        <div className="text-2xl font-black mb-3">宇宙正在搭建</div>
        <div className="text-white/65 leading-7 text-sm">正在生成你的身份、角色身份和开场场景……</div>
      </div>
    );
  }

  if (view === 'play' && currentSession) {
    return (
      <div className="h-full flex flex-col bg-[#15131a] text-white">
        <div className="px-4 pt-7 pb-4 border-b border-white/10 bg-black/25 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { setView('list'); setCurrentSession(null); setCurrentSessionId(null); }}><ChevronLeft size={28} /></button>
            <div className="font-black tracking-wide">IF</div>
            <button onClick={() => setShowWorldInfo(prev => !prev)} className="text-xs text-white/60">{showWorldInfo ? '收起设定' : '展开设定'}</button>
          </div>
          {showWorldInfo && (
          <div className="rounded-3xl bg-white/6 border border-white/10 p-4">
            <div className="text-lg font-black mb-1">{currentSession.name}</div>
            <div className="text-xs text-white/45 mb-3">{currentSession.background} · {currentSession.theme}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/6 px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/40 mb-1">我的身份</div>
                <div className="font-semibold">{currentSession.userIdentity.identity}</div>
                <div className="text-xs text-white/60 mt-1 leading-5">{currentSession.userIdentity.publicStatus}</div>
              </div>
              <div className="rounded-2xl bg-white/6 px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/40 mb-1">同行角色</div>
                <div className="text-sm leading-6">
                  {currentSession.characterIdentities.map(item => `${item.name} · ${item.identity}`).join('\n')}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const isNarrator = message.role === 'narrator';
            const isSystem = message.role === 'system';
            const isDialogueBubble = isUser || message.role === 'character';
            return (
              <div key={`${message.role}_${index}_${message.text.slice(0, 8)}`}>
                {isDialogueBubble ? (
                  <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={`max-w-[86%] rounded-[1.6rem] px-4 py-3 ${isUser ? 'bg-violet-500 text-white' : 'bg-white/8 text-white border border-white/10'}`}>
                      {!isUser && <div className="text-[11px] font-bold mb-1 text-white/45">{message.name || '角色'}</div>}
                      <div className="whitespace-pre-wrap break-words leading-7 text-[15px]">{cleanNarrativeText(message.text)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-2 text-center">
                    <div className={`text-[11px] mb-2 ${isSystem ? 'text-amber-300/80' : 'text-white/35'}`}>{message.name || (isSystem ? '系统' : '旁白')}</div>
                    <div className={`whitespace-pre-wrap break-words leading-8 text-[15px] ${isSystem ? 'text-amber-50/90' : 'text-white/88'}`}>
                      {cleanNarrativeText(message.text)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-[1.4rem] bg-white/8 border border-white/10 px-4 py-3 text-white/70">
                宇宙正在回应你的动作……
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="border-t border-white/10 bg-black/25 backdrop-blur p-3 pb-safe">
          <div className="flex gap-2">
            <div className="flex-1 rounded-[1.5rem] bg-white/8 border border-white/10 px-4 py-3 flex items-center gap-3">
              <UserRound size={18} className="text-white/45 shrink-0" />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void pushScene(); }}
                placeholder="输入你想做的事，例如：我想试探他为什么会出现在这里"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/35"
              />
            </div>
            <button onClick={() => void pushScene()} disabled={!input.trim() || loading} className="w-12 h-12 rounded-full bg-violet-500 flex items-center justify-center disabled:opacity-40">
              <SendHorizonal size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f6f1ea] text-slate-900">
      <div className="px-4 pt-7 pb-4 border-b border-stone-200 bg-[#fcfaf6]">
        <div className="flex items-center justify-between mb-3">
          <button onClick={closeApp}><ChevronLeft size={28} /></button>
          <div className="font-black tracking-wide">IF</div>
          <button onClick={() => { resetSetup(); setView('setup'); }} className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center">
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <button onClick={() => { resetSetup(); setView('setup'); }} className="w-full rounded-[1.7rem] border border-dashed border-stone-300 bg-white px-4 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center"><Play size={18} /></div>
            <div>
              <div className="font-black">开始一个新的 IF</div>
              <div className="text-sm text-slate-500 mt-1">你会先得到自己和其他角色在此宇宙中的身份，然后自由展开故事。</div>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold"><History size={16} /> 历史记录</div>
        {sessions.length === 0 ? (
          <div className="rounded-[1.7rem] bg-white border border-stone-200 px-4 py-12 text-center text-slate-400">
            还没有 IF 记录，先创建一个宇宙吧。
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="rounded-[1.7rem] bg-white border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-black mb-1">{session.name}</div>
                  <div className="text-xs text-slate-500 mb-2">{session.background} · {session.theme}</div>
                  <div className="text-sm text-slate-600 line-clamp-3 leading-6">{session.worldSummary || session.opening}</div>
                </div>
                <button onClick={() => { if (confirm('确定删除这条 IF 记录吗？')) deleteIFSession(session.id); }} className="text-rose-500 shrink-0"><Trash2 size={18} /></button>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => openSession(session)} className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold">继续游玩</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
