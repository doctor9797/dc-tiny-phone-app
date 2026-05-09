import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Play, Square, CheckCircle, Circle, MessageCircle, Music, VolumeX, Send } from 'lucide-react';
import { generateAIResponse, sendCharacterActivityFollowup } from '../../lib/ai';
import ImageUploader from '../ImageUploader';

type FocusMode = 'study' | 'work' | 'read';
type Goal = { id: string; text: string; completed: boolean };

const NOISES = [
  { id: 'none', label: '关闭', url: '' },
  { id: 'rain', label: '雨声', url: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_6b7a5a8a1c.mp3?filename=rain-and-thunder-16705.mp3' },
  { id: 'cafe', label: '咖啡馆', url: 'https://cdn.pixabay.com/download/audio/2022/11/25/audio_27d7bd49eb.mp3?filename=cafe-background-noise-126293.mp3' },
  { id: 'fire', label: '篝火', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_b28fc0e6f6.mp3?filename=campfire-quiet-102555.mp3' },
  { id: 'waves', label: '海浪', url: 'https://cdn.pixabay.com/download/audio/2022/01/24/audio_3441ca4fa3.mp3?filename=ocean-wave-102377.mp3' }
];

const FOCUS_BACKGROUNDS = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&q=80&w=1400',
  'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=1400',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1400',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&q=80&w=1400'
];

export default function FocusApp() {
  const { characters, closeApp } = useAppStore();
  
  const [step, setStep] = useState<'setup' | 'focus' | 'summary' | 'history'>('setup');
  const [mode, setMode] = useState<FocusMode>('study');
  const [charId, setCharId] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  
  // Focus State
  const [elapsed, setElapsed] = useState<number>(0);
  const [charStatus, setCharStatus] = useState<string>('');
  const [sessionActions, setSessionActions] = useState<string[]>([]);
  const [encouragement, setEncouragement] = useState<string>('');
  const [summaryMsg, setSummaryMsg] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  const [noiseIdx, setNoiseIdx] = useState(0);
  const [bgIdx, setBgIdx] = useState(0);
  
  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<{sender: 'user'|'char', text: string}[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Timers
  const timerRef = useRef<NodeJS.Timeout>();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [selectedBg, setSelectedBg] = useState(FOCUS_BACKGROUNDS[0]);

  const playNoise = (targetIdx = noiseIdx) => {
    if (!audioRef.current) return;

    const nextNoise = NOISES[targetIdx];
    if (nextNoise.id === 'none') {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      return;
    }

    if (audioRef.current.src !== nextNoise.url) {
      audioRef.current.src = nextNoise.url;
    }

    audioRef.current.loop = true;
    audioRef.current.volume = 0.45;
    audioRef.current.play().catch(() => {});
  };

  useEffect(() => {
    if (step === 'focus') {
      playNoise(noiseIdx);
    }
  }, [noiseIdx, step]);

  const startFocus = () => {
    if (!charId) return;
    setElapsed(0); // explicitly set to 0
    setStep('focus');
    setCharStatus('安静地坐在你身边...');
    setSessionActions([`00:00 安静地坐在你身边...`]);
    
    // Safety clear
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    playNoise(noiseIdx);
    
    // Initial action
    generateCharAction(charId, mode);
  };

  const endFocus = async () => {
    if (isEnding) return;
    setIsEnding(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioRef.current) audioRef.current.pause();
    setStep('summary');
    setSummaryMsg('正在总结...');
    const char = characters[charId];
    if (char) {
       const prompt = `我们在进行${mode === 'study' ? '学习' : mode === 'work' ? '工作' : '阅读'}的沉浸陪伴。现在结束了，我们完成了 ${goals.filter(g=>g.completed).length}/${goals.length} 个目标。总计时 ${Math.floor(elapsed/60)} 分钟。请以【${char.name}】的口吻和语气（${char.personality}），给我一段结束陪伴的总结和鼓励。不要出戏，风格贴合角色。`;
       try {
         const res = await generateAIResponse(prompt);
         setSummaryMsg(res);
         useAppStore.getState().addFocusRecord({
           id: Date.now().toString(),
           charId,
           mode,
           duration: elapsed,
           tasks: goals,
           chatLog: chatMsgs,
           charActions: sessionActions,
           summary: res,
           timestamp: Date.now()
         });
         sendCharacterActivityFollowup(charId, `我刚刚结束了一次${mode === 'study' ? '学习' : mode === 'work' ? '工作' : '阅读'}陪伴。我们完成了 ${goals.filter(g=>g.completed).length}/${goals.length} 个目标，总计时 ${Math.floor(elapsed/60)} 分钟。请你主动给我发一条和这次陪伴相关的微信消息。`);
       } catch {
         const fb = '辛苦了，休息一下吧！';
         setSummaryMsg(fb);
         useAppStore.getState().addFocusRecord({
           id: Date.now().toString(),
           charId,
           mode,
           duration: elapsed,
           tasks: goals,
           chatLog: chatMsgs,
           charActions: sessionActions,
           summary: fb,
           timestamp: Date.now()
         });
         sendCharacterActivityFollowup(charId, `我刚刚结束了一次${mode === 'study' ? '学习' : mode === 'work' ? '工作' : '阅读'}陪伴，请你主动来和我说一句相关的话。`);
       }
    }
    setIsEnding(false);
  };

  const generateCharAction = async (cId: string, m: FocusMode) => {
    const char = characters[cId];
    if (!char) return;
    try {
      const res = await generateAIResponse(`这是一个专注陪伴APP。用户在进行 ${m}。你作为 ${char.name} (${char.personality})，在旁边也在做你自己的事情。请用一句话（20字以内）第三人称描述你现在专注做的事，或者用第一人称对用户进行静默陪伴的简单描述。`);
      const cleanRes = res.replace(/['"]/g, '');
      setCharStatus(cleanRes);
      setSessionActions(prev => [...prev, `${formatActionTime(elapsed)} ${cleanRes}`]);
    } catch {
      setCharStatus('正陪伴着你...');
    }
  };

  const handleCompleteGoal = async (id: string) => {
    setGoals(goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
    const goal = goals.find(g => g.id === id);
    if (!goal || goal.completed) return; // only praise on newly completed
    
    const char = characters[charId];
    if (!char) return;
    try {
       const res = await generateAIResponse(`我在你的陪伴下完成了任务：“${goal.text}”。请以【${char.name}】的口吻（${char.personality}），立刻给我一句（10字以内）简短的当面表扬或鼓励。`);
       setEncouragement(res.replace(/['"]/g, ''));
       setTimeout(() => setEncouragement(''), 5000);
    } catch {}
  };

  const sendMsg = async () => {
    if (!inputMsg.trim() || !charId) return;
    const msg = inputMsg;
    setInputMsg('');
    setChatMsgs(prev => [...prev, { sender: 'user', text: msg }]);
    setIsAiThinking(true);
    
    const char = characters[charId];
    if (char) {
      if (chatMsgs.length > 5) {
        setChatMsgs(prev => [...prev, { sender: 'char', text: '别聊了，快去专心做你的事！' }]);
      } else {
        try {
          const res = await generateAIResponse(`我们在沉浸陪伴。我跟你说：“${msg}”。请以【${char.name}】的口吻（${char.personality}）回复我。字数少于30字。不要出戏！`);
          setChatMsgs(prev => [...prev, { sender: 'char', text: res }]);
        } catch {}
      }
    }
    setIsAiThinking(false);
  };

  const addGoal = () => {
    if (newGoal.trim()) {
      setGoals([...goals, { id: Date.now().toString(), text: newGoal.trim(), completed: false }]);
      setNewGoal('');
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatActionTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (step === 'history') {
    const records = useAppStore.getState().focusRecords || [];
    return (
      <div className="flex-1 flex flex-col h-full relative font-sans text-slate-800 bg-slate-50">
        <div className="pt-14 px-6 pb-2 flex items-center justify-between shrink-0 border-b border-slate-200">
            <button onClick={() => setStep('setup')} className="w-10 h-10 flex -ml-2 items-center text-slate-500 hover:text-slate-800 transition-colors"><ChevronLeft size={28} /></button>
            <span className="font-bold text-lg">陪伴记录</span>
            <div className="w-10"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {records.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
                暂无记录
             </div>
          ) : (
            records.map(r => (
              <div key={r.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative">
                 <button onClick={() => {
                   if (confirm('确认删除此记录？')) useAppStore.getState().deleteFocusRecord(r.id);
                 }} className="absolute top-4 right-4 text-rose-300 hover:text-rose-500">删除</button>
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
                     {characters[r.charId] && !characters[r.charId]?.avatar.startsWith('#') && <img src={characters[r.charId].avatar} className="w-full h-full object-cover" alt="" />}
                   </div>
                   <div>
                     <div className="font-bold">{characters[r.charId]?.name || '未知角色'}</div>
                     <div className="text-xs text-slate-400">{new Date(r.timestamp).toLocaleString()} · {Math.floor(r.duration/60)}分钟</div>
                   </div>
                 </div>
                 
                 {r.tasks && r.tasks.length > 0 && (
                   <div className="bg-slate-50 p-2 rounded-xl text-sm">
                      <div className="font-bold text-slate-500 text-xs mb-1">任务达成: {r.tasks.filter(t=>t.completed).length}/{r.tasks.length}</div>
                      <div className="space-y-1">
                        {r.tasks.map((t, idx) => (
                           <div key={idx} className={`flex items-center gap-2 ${t.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              {t.completed ? <CheckCircle size={14} className="text-emerald-400" /> : <Circle size={14} />} {t.text}
                           </div>
                        ))}
                      </div>
                   </div>
                 )}
                 <div className="text-sm text-slate-600 bg-indigo-50/50 p-3 rounded-xl leading-relaxed italic">
                    "{r.summary}"
                 </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="flex-1 flex flex-col h-full relative font-sans text-slate-800 bg-gradient-to-br from-slate-50 via-white to-stone-100">
        <div className="pt-14 px-6 pb-2 flex items-center justify-between shrink-0">
            <button onClick={closeApp} className="w-10 h-10 flex -ml-2 items-center text-slate-500 hover:text-slate-800 transition-colors"><ChevronLeft size={28} /></button>
            <span className="font-black text-xl tracking-wider text-slate-800">沉浸陪伴</span>
            <button onClick={() => setStep('history')} className="text-sm font-bold text-slate-500 hover:text-slate-700 active:scale-95 transition-all">历史记录</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 pb-32 hide-scrollbar">
          
          {/* Who to accompany */}
          <div className="space-y-4">
             <div className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">谁来陪你</div>
             <div className="grid grid-cols-4 gap-3">
               {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(char => (
                 <button 
                   key={char.id} 
                   onClick={() => setCharId(char.id)}
                   className={`flex flex-col items-center gap-2 p-3 rounded-[2rem] transition-all duration-300 relative ${charId === char.id ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] scale-105 border-2 border-slate-200' : 'bg-transparent hover:bg-white/50 border-2 border-transparent'}`}
                 >
                    {charId === char.id && (
                       <div className="absolute top-2 right-2 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white shadow-sm z-10"></div>
                    )}
                    <div className="w-14 h-14 rounded-full overflow-hidden shadow-sm">
                      {!char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <span className={`text-[10px] font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center ${charId === char.id ? 'text-slate-800' : 'text-slate-500'}`}>{char.name}</span>
                 </button>
               ))}
             </div>
          </div>
          
          {/* Mode */}
          <div className="space-y-4">
             <div className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">专注模式</div>
             <div className="grid grid-cols-3 gap-3">
               {[
                 { id: 'study', label: '📖 学习' },
                 { id: 'work', label: '💻 工作' },
                 { id: 'read', label: '📚 阅读' },
               ].map(m => (
                 <button 
                   key={m.id} 
                   onClick={() => setMode(m.id as FocusMode)}
                   className={`py-4 rounded-3xl text-sm font-bold transition-all duration-300 ${mode === m.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 scale-105' : 'bg-white text-slate-600 shadow-sm border border-slate-100 hover:bg-slate-50'}`}
                 >
                   {m.label}
                 </button>
               ))}
             </div>
          </div>

          {/* Goals */}
          <div className="space-y-4">
             <div className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">待办目标 (可选)</div>
             <div className="bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
               {goals.map(g => (
                 <div key={g.id} className="bg-white px-4 py-3.5 rounded-2xl text-sm shadow-sm flex justify-between items-center text-slate-700 font-medium">
                   {g.text}
                   <button onClick={() => setGoals(goals.filter(x => x.id !== g.id))} className="text-slate-300 hover:text-rose-400 transition-colors">
                     <Circle size={18}/>
                   </button>
                 </div>
               ))}
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={newGoal} 
                   onChange={e => setNewGoal(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && addGoal()}
                   placeholder="写下你想完成的事..." 
                   className="flex-1 px-4 py-3.5 rounded-2xl bg-white border border-slate-100 text-sm outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300 transition-all shadow-sm"
                 />
                 <button onClick={addGoal} className="w-12 h-12 bg-slate-100 text-slate-700 rounded-2xl font-black flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0">+</button>
               </div>
             </div>
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-gradient-to-t from-white via-white/90 to-transparent">
            <button 
              onClick={startFocus}
              disabled={!charId}
              className="w-full bg-slate-900 text-white py-4.5 rounded-full font-bold text-lg disabled:opacity-50 disabled:bg-slate-300 tracking-wider shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              开始专注之旅 <Play size={20} fill="currentColor"/>
            </button>
        </div>
      </div>
    );
  }

  const actChar = characters[charId];

  if (step === 'summary') {
    return (
      <div className="flex-1 bg-gradient-to-b from-stone-200 to-stone-400 flex flex-col h-full items-center p-6 text-stone-800 relative">
         <div className="w-full flex-1 max-w-sm bg-[#fcfbf9] rounded-sm shadow-2xl p-6 mt-12 mb-6 flex flex-col relative" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e5e5e5 31px, #e5e5e5 32px)', backgroundAttachment: 'local', lineHeight: '32px' }}>
           <div className="absolute top-0 left-0 w-full h-12 bg-[#fcfbf9] z-10 hidden"></div>
           <div className="flex flex-col items-center mb-6 z-20">
             <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-xl mb-4 bg-stone-200">
               {actChar && !actChar.avatar.startsWith('#') && <img src={actChar.avatar} className="w-full h-full object-cover" alt="" />}
             </div>
             <h2 className="text-xl font-serif font-black tracking-widest text-stone-800">专注总结</h2>
             <p className="text-stone-500 font-bold text-sm">总计长: {formatTime(elapsed)}</p>
           </div>
           
           <div className="flex-1 overflow-y-auto mb-6 z-20">
             <div className="text-stone-700 leading-[32px] text-base text-justify whitespace-pre-wrap">
               {summaryMsg}
             </div>
           </div>
           
           <div className="mt-auto pt-6 border-t border-stone-200 z-20 flex justify-center sticky bottom-0 bg-[#fcfbf9]">
              <button onClick={() => {setStep('setup'); setGoals(goals.map(g=>({...g, completed:false}))); setChatMsgs([]); setSessionActions([]);}} className="px-8 py-3 bg-stone-800 text-white rounded-full font-bold tracking-widest shadow-lg active:scale-95 transition-transform">
                装进信封
              </button>
           </div>
         </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full relative font-sans overflow-hidden">
      <audio ref={audioRef} />
      
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 z-0" 
        style={{ backgroundImage: `url(${selectedBg})` }}
      />
      <div className="absolute inset-0 bg-black/40 z-0" />

      {/* Main UI */}
      <div className="pt-14 px-6 pb-2 flex items-center justify-between shrink-0 z-10 text-white">
          <div className="flex gap-2">
            <button onClick={() => setShowChat(!showChat)} className="w-10 h-10 flex items-center justify-center bg-black/20 backdrop-blur rounded-full">
               <MessageCircle size={20}/>
            </button>
            <div className="relative group flex items-center gap-2 bg-black/20 backdrop-blur rounded-full overflow-hidden p-1 shadow-sm border border-white/10 pr-3">
               <button onClick={() => {
                 setNoiseIdx((noiseIdx + 1) % NOISES.length);
               }} className="w-8 h-8 flex items-center justify-center rounded-full active:scale-95 bg-white/20">
                  {NOISES[noiseIdx].id === 'none' ? <VolumeX size={16} /> : <Music size={16} />}
               </button>
               <span className="text-xs font-medium min-w-[40px]">{NOISES[noiseIdx].label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextIdx = (bgIdx + 1) % FOCUS_BACKGROUNDS.length;
                setBgIdx(nextIdx);
                setSelectedBg(FOCUS_BACKGROUNDS[nextIdx]);
              }}
              className="px-3 py-1.5 flex items-center justify-center bg-black/20 backdrop-blur border border-white/20 rounded-full text-xs font-bold shadow-sm active:bg-white/20 transition-all cursor-pointer"
            >
              切换背景
            </button>
            <ImageUploader onImageSelected={(url) => setSelectedBg(url)} className="px-3 py-1.5 flex items-center justify-center bg-black/20 backdrop-blur border border-white/20 rounded-full text-xs font-bold shadow-sm active:bg-white/20 transition-all cursor-pointer">
               导入背景
            </ImageUploader>
          </div>
      </div>

      <div className="flex-1 flex flex-col px-5 z-20 pt-3 pb-3 min-h-0 relative">
         
         <div className="w-full max-w-[280px] mx-auto mt-1 mb-3 shrink-0">
            <div className="rounded-[1.5rem] bg-black/24 backdrop-blur-md border border-white/16 shadow-xl px-3 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">陪伴动态</div>
                  <div className="text-white font-semibold mt-0.5 text-sm">{actChar?.name || '角色'} 正在做的事</div>
                </div>
                {encouragement && (
                  <div className="rounded-full bg-white/88 px-2.5 py-1 text-[10px] font-bold text-stone-800 shadow-sm">
                    {encouragement}
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-black/20 border border-white/10 px-3 py-2.5 text-white/90 text-xs leading-5 mb-2">
                {charStatus}
              </div>
              <div className="max-h-[74px] overflow-y-auto pr-1 space-y-1.5">
                {sessionActions.slice().reverse().map((item, index) => {
                  const firstSpaceIndex = item.indexOf(' ');
                  const timeText = firstSpaceIndex > -1 ? item.slice(0, firstSpaceIndex) : '--:--';
                  const contentText = firstSpaceIndex > -1 ? item.slice(firstSpaceIndex + 1) : item;
                  return (
                    <div key={`${item}_${index}`} className="rounded-xl bg-white/10 border border-white/10 px-2.5 py-2">
                      <div className="text-[9px] tracking-[0.18em] uppercase text-white/45 mb-0.5">{timeText}</div>
                      <div className="text-[11px] text-white/88 leading-5">{contentText}</div>
                    </div>
                  );
                })}
              </div>
            </div>
         </div>

         <div className="bg-black/18 backdrop-blur px-5 py-3 rounded-[1.45rem] border border-white/18 shadow-xl flex flex-col items-center mb-3 shrink-0 mx-auto">
            <div className="text-[11px] font-medium text-white/50 tracking-[0.28em] uppercase mb-1">
               {mode === 'study' ? 'STUDYING' : mode === 'work' ? 'WORKING' : 'READING'}
            </div>
            <div className="text-[2.6rem] font-black text-white tracking-tighter tabular-nums drop-shadow-lg leading-none">
               {formatTime(elapsed)}
            </div>
         </div>

         <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-start">
           {goals.length > 0 && (
             <div className="w-full max-w-[286px] bg-black/38 backdrop-blur p-3 rounded-[1.5rem] shadow-sm border border-white/18 space-y-2 flex flex-col min-h-0">
               <div className="text-[11px] font-bold text-white/50 uppercase tracking-[0.22em] px-1 shrink-0">当前目标</div>
               <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 max-h-[24vh]">
                 {goals.map(g => (
                   <div key={g.id} onClick={() => handleCompleteGoal(g.id)} className={`flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer ${g.completed ? 'bg-black/20 opacity-50' : 'bg-black/36 shadow-sm border border-white/10'}`}>
                     {g.completed ? <CheckCircle size={16} className="text-emerald-400 shrink-0"/> : <Circle size={16} className="text-white/40 shrink-0"/>}
                     <span className={`text-[13px] font-medium flex-1 ${g.completed ? 'line-through text-white/40' : 'text-white/90'}`}>{g.text}</span>
                   </div>
                 ))}
               </div>
             </div>
           )}
         </div>
      </div>

      <div className="relative z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pointer-events-auto">
         <div className="bg-gradient-to-t from-black/70 via-black/45 to-transparent rounded-t-[2rem] px-2 pt-3">
            <div className="w-full flex justify-center mb-1 shrink-0">
               <button
                 type="button"
                 onClick={() => { void endFocus(); }}
                 disabled={isEnding}
                 className="px-4 py-2 bg-white/18 backdrop-blur-md border border-white/28 text-white rounded-full text-sm font-semibold shadow-md flex items-center justify-center gap-2 hover:bg-white/24 active:scale-95 transition-all disabled:opacity-60"
               >
                  <Square size={13} fill="currentColor"/> {isEnding ? '结束中' : '结束'}
               </button>
            </div>
         </div>
      </div>

      {/* Chat Bot Overlay */}
      {showChat && (
         <div className="absolute inset-x-4 bottom-[20%] top-[20%] bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-stone-100 z-50 flex flex-col overflow-hidden animate-fade-in origin-bottom">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
              <span className="font-bold text-stone-800 text-sm">与 {actChar?.name} 悄悄说话</span>
              <button onClick={() => setShowChat(false)} className="text-stone-400">关闭</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {chatMsgs.length === 0 && <div className="text-center text-stone-400 text-xs mt-4">嘘...保持安静，有实在需要可以说。</div>}
               {chatMsgs.map((m, i) => (
                 <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm ${m.sender === 'user' ? 'bg-stone-800 text-white rounded-br-none' : 'bg-stone-100 text-stone-800 rounded-bl-none'}`}>
                     {m.text}
                   </div>
                 </div>
               ))}
               {isAiThinking && <div className="text-stone-400 text-xs animate-pulse">正在输入...</div>}
            </div>
            <div className="p-3 bg-stone-50/50 border-t border-stone-100">
               <div className="flex items-center gap-2 bg-white p-1 pr-2 rounded-full border border-stone-200">
                  <input type="text" value={inputMsg} onChange={e=>setInputMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} className="flex-1 bg-transparent px-4 py-2 outline-none text-sm" placeholder="说点什么..." />
                  <button onClick={sendMsg} className="w-8 h-8 flex items-center justify-center bg-stone-800 text-white rounded-full shrink-0">
                    <Send size={14}/>
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
