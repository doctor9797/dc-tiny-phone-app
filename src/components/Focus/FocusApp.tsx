import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Play, Square, CheckCircle, Circle, MessageCircle, Music, VolumeX, Send, Clock, Image, X, Sparkles } from 'lucide-react';
import { generateAIResponse, sendCharacterActivityFollowup } from '../../lib/ai';

type FocusMode = 'study' | 'work' | 'read';
type Goal = { id: string; text: string; completed: boolean };

const NOISES = [
  { id: 'none', label: '关闭', icon: VolumeX },
  { id: 'rain', label: '雨声', icon: Music },
  { id: 'cafe', label: '咖啡馆', icon: Music },
  { id: 'fire', label: '篝火', icon: Music },
  { id: 'waves', label: '海浪', icon: Music },
];

const MODE_LABELS: Record<FocusMode, string> = {
  study: '学习',
  work: '工作',
  read: '阅读',
};

const DEFAULT_BG = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&q=80&w=1400';

const STORAGE_BG_KEY = 'focus_custom_bg';

export default function FocusApp() {
  const { characters, closeApp } = useAppStore();

  // ─── State ───
  const [step, setStep] = useState<'setup' | 'focus' | 'summary' | 'history'>('setup');
  const [mode, setMode] = useState<FocusMode>('study');
  const [charId, setCharId] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState('');

  const [elapsed, setElapsed] = useState<number>(0);
  const [charStatus, setCharStatus] = useState('');
  const [sessionActions, setSessionActions] = useState<string[]>([]);
  const [encouragement, setEncouragement] = useState('');
  const [summaryMsg, setSummaryMsg] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  const [noiseIdx, setNoiseIdx] = useState(0);

  const [showChat, setShowChat] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<{sender: 'user'|'char', text: string}[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [bgUrl, setBgUrl] = useState(() => {
    try { return localStorage.getItem(STORAGE_BG_KEY) || DEFAULT_BG; }
    catch { return DEFAULT_BG; }
  });
  const [showBgPicker, setShowBgPicker] = useState(false);

  const timerRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Web Audio API Engine (multi-layer synthesis) ───
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const modTimersRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const getAudioCtx = (): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        masterGainRef.current = ctx.createGain();
        masterGainRef.current.gain.value = 0.2;
        masterGainRef.current.connect(ctx.destination);
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch { return null; }
  };

  const stopAllNoise = () => {
    for (const src of activeSourcesRef.current) try { src.stop(); } catch {}
    activeSourcesRef.current = [];
    for (const t of modTimersRef.current) clearInterval(t);
    modTimersRef.current = [];
  };

  const addLayer = (ctx: AudioContext, master: AudioNode, opts: {
    noiseType: 'pink' | 'brown' | 'white';
    filter?: { type: BiquadFilterType; freq: number; Q?: number };
    gain: number;
  }) => {
    const bufSize = ctx.sampleRate * 8;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (opts.noiseType === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufSize; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else if (opts.noiseType === 'brown') {
      let lastOut = 0;
      for (let i = 0; i < bufSize; i++) {
        const w = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * w) / 1.02;
        lastOut = data[i]; data[i] *= 3.5;
      }
    } else {
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    }
    // Crossfade loop point to avoid click
    const fadeLen = Math.min(2048, bufSize >> 2);
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      data[bufSize - fadeLen + i] = data[bufSize - fadeLen + i] * (1 - t) + data[i] * t;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    let lastNode: AudioNode = src;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter.type; f.frequency.value = opts.filter.freq;
      if (opts.filter.Q !== undefined) f.Q.value = opts.filter.Q;
      src.connect(f); lastNode = f;
    }
    const g = ctx.createGain();
    g.gain.value = opts.gain;
    lastNode.connect(g); g.connect(master);
    src.start();
    activeSourcesRef.current.push(src);
    return g;
  };

  const startNoise = (noiseId: string) => {
    stopAllNoise();
    if (noiseId === 'none') return;
    const ctx = getAudioCtx();
    if (!ctx || !masterGainRef.current) return;
    const master = masterGainRef.current;

    // All sounds use warm, heavily low-passed noise at very low volume
    // for a gentle background texture — no harsh highs, no static
    if (noiseId === 'rain') {
      addLayer(ctx, master, { noiseType: 'pink', filter: { type: 'lowpass', freq: 400 }, gain: 0.15 });
      addLayer(ctx, master, { noiseType: 'pink', filter: { type: 'bandpass', freq: 800, Q: 0.8 }, gain: 0.08 });
    } else if (noiseId === 'fire') {
      const rumbleGain = addLayer(ctx, master, { noiseType: 'brown', filter: { type: 'lowpass', freq: 120 }, gain: 0.12 });
      addLayer(ctx, master, { noiseType: 'pink', filter: { type: 'bandpass', freq: 400, Q: 1 }, gain: 0.06 });
      const flicker = setInterval(() => {
        rumbleGain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.1, ctx.currentTime + 0.3 + Math.random() * 0.5);
      }, 500);
      modTimersRef.current.push(flicker);
    } else if (noiseId === 'cafe') {
      addLayer(ctx, master, { noiseType: 'brown', filter: { type: 'lowpass', freq: 100 }, gain: 0.06 });
      addLayer(ctx, master, { noiseType: 'pink', filter: { type: 'bandpass', freq: 600, Q: 0.5 }, gain: 0.04 });
    } else if (noiseId === 'waves') {
      addLayer(ctx, master, { noiseType: 'pink', filter: { type: 'lowpass', freq: 300 }, gain: 0.1 });
      addLayer(ctx, master, { noiseType: 'brown', filter: { type: 'lowpass', freq: 80 }, gain: 0.06 });
      // Gentle swell
      const swellGain = ctx.createGain();
      swellGain.gain.value = 0.08;
      swellGain.connect(master);
      const swellSrc = ctx.createBufferSource();
      const swellNoise = (() => {
        const sz = ctx.sampleRate * 8;
        const b = ctx.createBuffer(1, sz, ctx.sampleRate);
        const d = b.getChannelData(0);
        let lo = 0;
        for (let i = 0; i < sz; i++) { const w = Math.random() * 2 - 1; d[i] = (lo + 0.02 * w) / 1.02; lo = d[i]; d[i] *= 3.5; }
        const fl = Math.min(2048, sz >> 2);
        for (let i = 0; i < fl; i++) { const t = i / fl; d[sz - fl + i] = d[sz - fl + i] * (1 - t) + d[i] * t; }
        return b;
      })();
      swellSrc.buffer = swellNoise;
      const swellFilter = ctx.createBiquadFilter();
      swellFilter.type = 'lowpass'; swellFilter.frequency.value = 200;
      swellSrc.connect(swellFilter); swellFilter.connect(swellGain);
      swellSrc.loop = true; swellSrc.start();
      activeSourcesRef.current.push(swellSrc);
      const sw = setInterval(() => {
        swellGain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.08, ctx.currentTime + 3 + Math.random() * 4);
        swellGain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 5 + Math.random() * 5);
      }, 8000);
      modTimersRef.current.push(sw);
    }
  };

  const playNoise = (targetIdx: number) => startNoise(NOISES[targetIdx].id);

  useEffect(() => {
    if (step === 'focus') startNoise(NOISES[noiseIdx].id);
    else stopAllNoise();
  }, [noiseIdx, step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopAllNoise(); if (audioCtxRef.current) audioCtxRef.current.close(); };
  }, []);

  // ─── Actions ───
  const startFocus = () => {
    if (!charId) return;
    setElapsed(0);
    setStep('focus');
    setCharStatus('安静地坐在你身边...');
    setSessionActions([`00:00 安静地坐在你身边...`]);
    // Default to rain sound when focus starts
    setNoiseIdx(1);
    // Play audio directly in user gesture context (bypass autoplay policy)
    playNoise(1);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    generateCharAction(charId, mode);
  };

  const endFocus = async () => {
    if (isEnding) return;
    setIsEnding(true);
    if (timerRef.current) clearInterval(timerRef.current);
    stopAllNoise();
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
    if (!goal || goal.completed) return;
    const char = characters[charId];
    if (!char) return;
    try {
      const res = await generateAIResponse(`我在你的陪伴下完成了任务："${goal.text}"。请以【${char.name}】的口吻（${char.personality}），立刻给我一句（10字以内）简短的当面表扬或鼓励。`);
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
          const res = await generateAIResponse(`我们在沉浸陪伴。我跟你说："${msg}"。请以【${char.name}】的口吻（${char.personality}）回复我。字数少于30字。不要出戏！`);
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

  const handleImportBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setBgUrl(url);
      try { localStorage.setItem(STORAGE_BG_KEY, url); } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ────── Shared styles ──────
  const glass = 'bg-white/70 dark:bg-white/10 backdrop-blur-xl border border-white/30 dark:border-white/10';
  const glassInput = 'bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10';

  // ────── RENDER ──────

  const actChar = characters[charId];

  const renderHistory = () => {
    const records = useAppStore.getState().focusRecords || [];
    return (
      <div className="h-full flex flex-col bg-[#f8f8fa] dark:bg-[#0f0f12]">
        <div className="px-5 pt-12 pb-3 flex items-center justify-between border-b border-slate-200/50 dark:border-white/5">
          <button onClick={() => setStep('setup')} className="w-10 h-10 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <ChevronLeft size={28} />
          </button>
          <span className="font-semibold text-base text-slate-700 dark:text-slate-200">陪伴记录</span>
          <div className="w-10" />
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600">
              <Clock size={48} className="mb-3 opacity-40" />
              <span className="text-sm">还没有陪伴记录</span>
            </div>
          ) : records.map(r => (
            <div key={r.id} className={`${glass} rounded-2xl p-5 shadow-sm relative group`}>
              <button onClick={() => { if (confirm('确认删除此记录？')) useAppStore.getState().deleteFocusRecord(r.id); }}
                className="absolute top-4 right-4 text-slate-300 hover:text-rose-400 opacity-40 hover:opacity-100 transition-all text-xs">
                <X size={16} />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 ring-2 ring-white shadow-sm">
                  {characters[r.charId] && !characters[r.charId]?.avatar.startsWith('#') && <img src={characters[r.charId].avatar} className="w-full h-full object-cover" alt="" />}
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-700 dark:text-slate-200">{characters[r.charId]?.name || '未知角色'}</div>
                  <div className="text-xs text-slate-400">{new Date(r.timestamp).toLocaleString()} · {Math.floor(r.duration/60)} 分钟</div>
                </div>
              </div>
              {r.tasks && r.tasks.length > 0 && (
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 mb-3">
                  <div className="text-xs font-medium text-slate-400 mb-2">
                    任务达成: {r.tasks.filter(t=>t.completed).length}/{r.tasks.length}
                  </div>
                  <div className="space-y-1">
                    {r.tasks.map((t, idx) => (
                      <div key={idx} className={`flex items-center gap-2 text-xs ${t.completed ? 'text-slate-400 line-through' : 'text-slate-600 dark:text-slate-300'}`}>
                        {t.completed ? <CheckCircle size={12} className="text-emerald-400 shrink-0" /> : <Circle size={12} className="text-slate-300 shrink-0" />}
                        {t.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-sm text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/5 p-3 rounded-xl leading-relaxed italic border-l-2 border-slate-300 dark:border-slate-600">
                "{r.summary}"
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSetup = () => {
    return (
      <div className="h-full flex flex-col bg-[#f8f8fa] dark:bg-[#0f0f12]">
        <div className="px-5 pt-12 pb-3 flex items-center justify-between">
          <button onClick={closeApp} className="w-10 h-10 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <ChevronLeft size={28} />
          </button>
          <span className="font-semibold text-base text-slate-700 dark:text-slate-200">沉浸陪伴</span>
          <button onClick={() => setStep('history')}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10">
            记录
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-8 pb-32">
          {/* Character selection */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">谁来陪你</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(char => (
                <button key={char.id} onClick={() => setCharId(char.id)}
                  className={`shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 ${
                    charId === char.id
                      ? `${glass} shadow-md scale-[1.02]`
                      : 'hover:bg-white/40 dark:hover:bg-white/5'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full overflow-hidden transition-all ${
                    charId === char.id ? 'ring-2 ring-slate-400/50 ring-offset-2 ring-offset-[#f8f8fa]' : ''
                  }`} style={{ background: char.avatar.startsWith('#') ? char.avatar : undefined }}>
                    {!char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <span className={`text-[10px] font-medium ${charId === char.id ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                    {char.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Mode selection */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">专注模式</h2>
            <div className="grid grid-cols-3 gap-3">
              {([
                { id: 'study' as FocusMode, label: '学习' },
                { id: 'work' as FocusMode, label: '工作' },
                { id: 'read' as FocusMode, label: '阅读' },
              ]).map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`py-4 rounded-2xl text-sm font-medium transition-all duration-300 ${
                    mode === m.id
                      ? `${glass} shadow-md text-slate-700 dark:text-slate-200`
                      : 'bg-transparent text-slate-400 dark:text-slate-500 hover:bg-white/40 dark:hover:bg-white/5'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Goals */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">待办目标</h2>
            <div className={`${glass} rounded-2xl p-4 space-y-3 shadow-sm`}>
              {goals.map(g => (
                <div key={g.id} className="flex items-center justify-between px-4 py-3 bg-white/60 dark:bg-white/5 rounded-xl text-sm text-slate-600 dark:text-slate-300 font-medium">
                  <span className="truncate">{g.text}</span>
                  <button onClick={() => setGoals(goals.filter(x => x.id !== g.id))}
                    className="text-slate-300 hover:text-rose-400 transition-colors shrink-0 ml-3">
                    <X size={16} />
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
                  className={`flex-1 px-4 py-3 rounded-xl ${glassInput} text-sm outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-white/20 placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all`}
                />
                <button onClick={addGoal}
                  className="w-11 h-11 rounded-xl bg-slate-200/60 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center hover:bg-slate-300/60 dark:hover:bg-white/20 transition-colors shrink-0">
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)] bg-gradient-to-t from-[#f8f8fa] dark:from-[#0f0f12] via-[#f8f8fa]/90 dark:via-[#0f0f12]/90 to-transparent">
          <button
            onClick={startFocus}
            disabled={!charId}
            className="w-full py-4 rounded-2xl bg-slate-800 dark:bg-white text-white dark:text-slate-900 font-semibold text-base disabled:opacity-30 disabled:bg-slate-300 dark:disabled:bg-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Play size={18} fill="currentColor" />
            开始专注
          </button>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    return (
      <div className="h-full flex flex-col bg-[#f8f8fa] dark:bg-[#0f0f12] items-center p-6">
        <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
          <div className={`${glass} rounded-3xl p-8 shadow-lg w-full`}>
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-4 ring-white shadow-md mb-4 bg-slate-100">
                {actChar && !actChar.avatar.startsWith('#') && <img src={actChar.avatar} className="w-full h-full object-cover" alt="" />}
              </div>
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">本次陪伴</h2>
              <p className="text-sm text-slate-400 mt-1">{formatTime(elapsed)}</p>
              {goals.filter(g=>g.completed).length > 0 && (
                <p className="text-xs text-emerald-500 mt-1">完成 {goals.filter(g=>g.completed).length}/{goals.length} 个目标</p>
              )}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-center whitespace-pre-wrap">
              {summaryMsg}
            </div>
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => { setStep('setup'); setGoals(goals.map(g=>({...g, completed:false}))); setChatMsgs([]); setSessionActions([]); }}
                className="px-8 py-3 rounded-xl bg-slate-800 dark:bg-white text-white dark:text-slate-900 font-medium text-sm shadow-md active:scale-95 transition-transform"
              >
                好的，谢谢
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFocus = () => {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{ backgroundImage: `url(${bgUrl})` }} />
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

        {/* Top bar */}
        <div className="relative z-10 px-5 pt-12 pb-2 flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setShowChat(!showChat)}
              className="w-9 h-9 flex items-center justify-center bg-white/15 backdrop-blur-md rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/25 transition-all">
              <MessageCircle size={16} />
            </button>
            <div className="flex items-center bg-white/15 backdrop-blur-md rounded-full border border-white/20 overflow-hidden">
              <button onClick={() => setNoiseIdx((noiseIdx + 1) % NOISES.length)}
                className="w-9 h-9 flex items-center justify-center hover:bg-white/10 transition-colors text-white/70">
                {NOISES[noiseIdx].id === 'none' ? <VolumeX size={15} /> : <Music size={15} />}
              </button>
              <span className="text-[10px] font-medium text-white/60 pr-3 min-w-[36px]">{NOISES[noiseIdx].label}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowBgPicker(!showBgPicker)}
              className="px-3 py-1.5 flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-medium text-white/70 hover:text-white hover:bg-white/25 transition-all">
              <Image size={13} />
              背景
            </button>
          </div>
        </div>

        {/* Background picker */}
        {showBgPicker && (
          <div className="absolute top-28 right-5 z-20 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-4 w-56">
            <div className="text-xs font-semibold text-slate-500 mb-3">选择背景</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&q=80&w=400',
                'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=400',
                'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=400',
                'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&q=80&w=400',
                'https://images.unsplash.com/photo-1518173946687-a36f968f7c9f?auto=format&fit=crop&q=80&w=400',
                'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=400',
              ].map(url => (
                <button key={url} onClick={() => { setBgUrl(url); try { localStorage.setItem(STORAGE_BG_KEY, url); } catch {} }}
                  className={`aspect-[3/2] rounded-lg overflow-hidden ring-2 transition-all ${bgUrl === url ? 'ring-slate-400 ring-offset-2' : 'ring-transparent hover:ring-slate-300'}`}>
                  <img src={url} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <div className="border-t border-slate-200 pt-3">
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs font-medium text-slate-500 py-2 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5">
                <Image size={14} />
                从相册导入
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImportBg} />
            </div>
            <button onClick={() => setShowBgPicker(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pb-4">
          {/* Timer */}
          <div className="bg-white/12 backdrop-blur-xl px-8 py-4 rounded-2xl border border-white/18 shadow-lg mb-6">
            <div className="text-[10px] font-medium text-white/50 tracking-[0.3em] uppercase text-center mb-1">
              {MODE_LABELS[mode]}
            </div>
            <div className="text-[3.2rem] font-bold text-white tracking-tight tabular-nums text-center leading-none drop-shadow-sm">
              {formatTime(elapsed)}
            </div>
          </div>

          {/* Companion Status */}
          <div className="w-full max-w-[300px] bg-white/12 backdrop-blur-xl rounded-2xl border border-white/18 p-4 shadow-lg mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/30 bg-white/20">
                {actChar && !actChar.avatar.startsWith('#') && <img src={actChar.avatar} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-medium text-white/70">{actChar?.name || '陪伴者'}</div>
                <div className="text-[10px] text-white/40">正在做的事</div>
              </div>
              {encouragement && (
                <div className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-[10px] font-medium text-white animate-fade-in">
                  <Sparkles size={12} className="inline mr-1 -mt-0.5" />
                  {encouragement}
                </div>
              )}
            </div>
            <div className="bg-white/8 rounded-xl px-3 py-2.5 text-white/80 text-xs leading-relaxed">
              {charStatus}
            </div>
          </div>

          {/* Goals */}
          {goals.length > 0 && (
            <div className="w-full max-w-[300px] bg-white/12 backdrop-blur-xl rounded-2xl border border-white/18 p-4 shadow-lg max-h-[30vh] flex flex-col">
              <div className="text-[10px] font-medium text-white/50 uppercase tracking-widest mb-2 shrink-0">目标 ({goals.filter(g=>g.completed).length}/{goals.length})</div>
              <div className="overflow-y-auto space-y-1.5 flex-1 pr-0.5">
                {goals.map(g => (
                  <div key={g.id} onClick={() => handleCompleteGoal(g.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                      g.completed ? 'bg-white/8 opacity-50' : 'bg-white/10 hover:bg-white/16'
                    }`}>
                    {g.completed
                      ? <CheckCircle size={14} className="text-emerald-400/80 shrink-0" />
                      : <Circle size={14} className="text-white/30 shrink-0" />
                    }
                    <span className={`text-[12px] flex-1 ${g.completed ? 'line-through text-white/40' : 'text-white/80'}`}>
                      {g.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar - end button */}
        <div className="relative z-20 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => { void endFocus(); }}
              disabled={isEnding}
              className="px-6 py-3 bg-white/15 backdrop-blur-xl border border-white/25 text-white/80 rounded-full text-sm font-medium shadow-lg hover:bg-white/25 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Square size={12} fill="currentColor" />
              {isEnding ? '结束中...' : '结束专注'}
            </button>
          </div>
        </div>

        {/* Chat overlay */}
        {showChat && (
          <div className="absolute inset-0 z-30 flex items-end">
            <div className="absolute inset-0 bg-black/20" onClick={() => setShowChat(false)} />
            <div className="relative w-full bg-white dark:bg-[#1a1a24] rounded-t-2xl shadow-2xl flex flex-col max-h-[70%] animate-slide-up">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center shrink-0">
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">与 {actChar?.name} 悄悄说</span>
                <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
                {chatMsgs.length === 0 && (
                  <div className="text-center text-slate-400 dark:text-slate-500 text-xs mt-8">
                    嘘...保持安静，有实在需要再说
                  </div>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 rounded-br-none'
                        : 'bg-slate-100 dark:bg-white/15 text-slate-700 dark:text-slate-200 rounded-bl-none'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {isAiThinking && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/15 text-slate-400 rounded-bl-none flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay: '0ms'}} />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay: '150ms'}} />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 shrink-0">
                <div className="flex items-center gap-2 bg-white dark:bg-white/10 rounded-full border border-slate-200 dark:border-white/20 p-1 pl-4">
                  <input
                    type="text"
                    value={inputMsg}
                    onChange={e => setInputMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMsg()}
                    className="flex-1 bg-transparent py-2 outline-none text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="说点什么..."
                  />
                  <button onClick={sendMsg}
                    className="w-9 h-9 flex items-center justify-center bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 rounded-full shrink-0 hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full absolute inset-0 z-50">
      {step === 'history' && renderHistory()}
      {step === 'setup' && renderSetup()}
      {step === 'focus' && renderFocus()}
      {step === 'summary' && renderSummary()}
    </div>
  );
}
