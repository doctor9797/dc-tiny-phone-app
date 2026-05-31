import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Play, Pause, Users, Film, MessageCircle, Settings, Sparkles, VolumeX, FileText, PenLine, X, Volume2, Heart, Send, List, Maximize2, Minimize2, Trash2, Star } from 'lucide-react';
import { CompanionMode, CompanionDensity, CompanionTrigger, CompanionTriggerType, MovieSession, WatchCompanionPlan, MovieChatMessage } from '../../types';
import { saveVideoFile, loadVideoFile, deleteVideoFile } from '../../lib/db';
import { getCharacterReply } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { parseSubtitle, SubtitleEntry } from '../../lib/subtitleParser';

const MODE_LABELS: Record<CompanionMode, string> = {
  active: '主动',
  natural: '自然',
  silent: '静默',
};

const DENSITY_LABELS: Record<CompanionDensity, string> = {
  quiet: '安静',
  normal: '正常',
  talkative: '话痨',
};

// ── Cinematic design tokens ──
const FONT_HEADING = { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' as const };
const FONT_BODY = { fontFamily: "'Barlow', sans-serif" };

function parseBilibiliUrl(url: string): { bvid: string; title: string } | null {
  const cleaned = url.trim();
  if (/^BV\w{10,12}$/.test(cleaned)) return { bvid: cleaned, title: cleaned };
  const m = cleaned.match(/bilibili\.com\/video\/(BV\w+)/i);
  if (m) return { bvid: m[1], title: m[1] };
  return null;
}

function isPotentialBilibiliUrl(url: string): boolean {
  return !!url.trim() && (!!parseBilibiliUrl(url) || url.includes('b23.tv'));
}

function extractUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : text.trim();
}

async function resolveBilibiliUrl(url: string): Promise<{ bvid: string; title: string } | null> {
  const parsed = parseBilibiliUrl(url);
  if (parsed) return parsed;
  if (!url.includes('b23.tv')) return null;
  // Strip any non-URL text (e.g. Chinese title prefix from shared links)
  const cleanUrl = extractUrl(url);
  try {
    const resp = await fetch(apiUrl(`/api/resolve?url=${encodeURIComponent(cleanUrl)}`));
    const data = await resp.json();
    if (data.type === 'bilibili' && data.id) return { bvid: data.id, title: data.id };
  } catch {}
  return null;
}

// ── Chat input extracted to module level (manages its own state, no parent re-render on keystroke) ──
const MovieChatInput = React.memo(function MovieChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      onSend(value);
      setValue('');
      inputRef.current?.focus();
    }
  }, [value, disabled, onSend]);

  return (
    <div className="flex gap-2 pt-2 flex-shrink-0">
      <div className="flex-1 liquid-glass flex items-center" style={{ borderRadius: '2rem' }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="这一刻想聊点什么..."
          className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white/80 outline-none placeholder-white/30"
          style={FONT_BODY}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 disabled:opacity-30 hover:text-white transition-all mr-1 active:scale-90"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
});

// ── Chat panel (memoized, receives data as props, never triggers parent re-render) ──
const MovieChatPanel = React.memo(function MovieChatPanel({
  chatMessages,
  isAiTyping,
  selectedCharacter,
  onSend,
}: {
  chatMessages: MovieChatMessage[];
  isAiTyping: boolean;
  selectedCharacter: { name: string; avatar: string } | null;
  onSend: (text: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col px-2 pb-2">
      <div className="flex-1 min-h-0 overflow-y-auto liquid-glass p-4" style={{ borderRadius: '1.5rem' }}>
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: selectedCharacter?.avatar.startsWith('#') ? selectedCharacter.avatar : 'rgba(255,255,255,0.1)' }}
          >
            {selectedCharacter?.avatar.startsWith('#') && selectedCharacter.name[0]}
            {!selectedCharacter?.avatar.startsWith('#') && selectedCharacter && <img src={selectedCharacter.avatar} className="w-full h-full rounded-full object-cover" alt="" />}
          </div>
          <span className="text-white/80 font-medium text-sm" style={FONT_BODY}>{selectedCharacter?.name || '观影伴侣'}</span>
        </div>

        <div className="space-y-3">
          {chatMessages.length === 0 ? (
            <div className="text-center py-8 text-white/30">
              <MessageCircle size={28} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm" style={FONT_BODY}>开始聊天吧</p>
            </div>
          ) : (
            chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.isCompanion ? 'justify-start' : 'justify-end'}`}>
                {selectedCharacter && msg.isCompanion && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1 mr-1"
                    style={{ background: selectedCharacter.avatar.startsWith('#') ? selectedCharacter.avatar : 'rgba(255,255,255,0.1)' }}
                  >
                    {selectedCharacter.avatar.startsWith('#') && selectedCharacter.name[0]}
                  </div>
                )}
                <div
                  className={`max-w-[78%] p-3 text-sm ${
                    msg.isCompanion
                      ? 'text-white/80'
                      : 'text-white'
                  }`}
                  style={{
                    ...FONT_BODY,
                    borderRadius: msg.isCompanion ? '0 1rem 1rem 1rem' : '1rem 0 1rem 1rem',
                    background: msg.isCompanion
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
          {isAiTyping && (
            <div className="flex justify-start">
              <div
                className="px-4 py-2.5 text-sm text-white/50"
                style={{
                  ...FONT_BODY,
                  borderRadius: '0 1rem 1rem 1rem',
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                正在输入...
              </div>
            </div>
          )}
        </div>
      </div>

      <MovieChatInput onSend={onSend} disabled={isAiTyping} />
    </div>
  );
});

export default function MovieApp({ onBack }: { onBack: () => void }) {
  const { characters, movieSessions, setMovieSessions, updateMovieSession, deleteMovieSession, watchCompanionPlans, setWatchCompanionPlans } = useAppStore();

  const [showSelectCharacter, setShowSelectCharacter] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isSoloMode, setIsSoloMode] = useState(false);
  const [currentSession, setCurrentSession] = useState<MovieSession | null>(null);
  const [showCompanionSettings, setShowCompanionSettings] = useState(false);
  const [showTriggerList, setShowTriggerList] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [companionMode, setCompanionMode] = useState<CompanionMode>('natural');
  const [companionDensity, setCompanionDensity] = useState<CompanionDensity>('normal');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bilibiliUrlInput, setBilibiliUrlInput] = useState('');
  const [bilibiliLoading, setBilibiliLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const bilibiliSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [showBubble, setShowBubble] = useState<CompanionTrigger | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showNotesList, setShowNotesList] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; text: string; isCompanion: boolean; time: number }[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const seekedRef = useRef(false);
  const latestTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const currentSessionRef = useRef<MovieSession | null>(null);
  const selectedCharacterIdRef = useRef<string | null>(null);

  // Reset seek guard on layout switch so the new video seeks to saved time
  useEffect(() => {
    seekedRef.current = false;
  }, [isLandscape]);

  useEffect(() => {
    // Use screen.orientation API to detect actual device rotation.
    // Unlike viewport-based detection, this is NOT affected by the keyboard
    // opening on mobile (which shrinks viewport height but doesn't rotate the device).
    const checkOrientation = () => {
      if (screen.orientation) {
        setIsLandscape(screen.orientation.type.startsWith('landscape'));
      } else if ((window as any).orientation !== undefined) {
        // iOS fallback (< 16.4)
        setIsLandscape(Math.abs((window as any).orientation) === 90);
      } else {
        // Desktop fallback: use viewport dimensions
        setIsLandscape(window.innerWidth > window.innerHeight);
      }
    };
    checkOrientation();
    screen.orientation?.addEventListener('change', checkOrientation);
    window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 150));
    return () => {
      screen.orientation?.removeEventListener('change', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  useEffect(() => {
    if (!currentSession) { setVideoSrc(null); seekedRef.current = false; return; }
    if (currentSession.videoDbKey) {
      let cancelled = false;
      loadVideoFile(currentSession.videoDbKey).then(blob => {
        if (cancelled || !blob) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setVideoSrc(url);
      });
      return () => { cancelled = true; };
    } else if (currentSession.videoUrl) {
      setVideoSrc(currentSession.videoUrl);
    }
  }, [currentSession?.id]);

  useEffect(() => {
    if (!currentSession) return;
    setChatMessages(currentSession.chatMessages || []);
  }, [currentSession?.id]);

  useEffect(() => {
    if (!currentSession) return;
    const interval = setInterval(() => {
      const cs = currentSessionRef.current;
      if (!cs) return;
      if (cs.isBilibili) {
        updateMovieSession(cs.id, { currentTime: 1, updatedAt: Date.now() });
      } else if (videoRef.current) {
        updateMovieSession(cs.id, {
          currentTime: videoRef.current.currentTime,
          duration: videoRef.current.duration,
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentSession?.id]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Sync refs so stable callbacks always read latest values ──
  currentTimeRef.current = currentTime;
  currentSessionRef.current = currentSession;
  selectedCharacterIdRef.current = selectedCharacterId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleFileRef = useRef<HTMLInputElement>(null);
  const subtitlePlayerFileRef = useRef<HTMLInputElement>(null);
  const pendingSubtitleActionRef = useRef<'plan' | 'star' | null>(null);

  const selectedCharacter = selectedCharacterId ? characters[selectedCharacterId] : null;

  const generateMockCompanionPlan = useCallback(() => {
    if (currentSession?.companionPlanId) {
      setShowTriggerList(true);
      return;
    }

    const triggers: CompanionTrigger[] = [
      { id: '1', time: 48, type: 'observe', priority: 'high', bubble: '洋克镇外的远方，有着另一个世界', delivery: 'auto' },
      { id: '2', time: 522, type: 'emotion', priority: 'high', bubble: '只消片刻', delivery: 'auto' },
      { id: '3', time: 822, type: 'question', priority: 'medium', bubble: '你是谁？', delivery: 'hint' },
      { id: '4', time: 920, type: 'question', priority: 'medium', bubble: '你是谁？', delivery: 'hint' },
      { id: '5', time: 1200, type: 'memory', priority: 'high', bubble: '这一幕让我想起了很多...', delivery: 'auto' },
      { id: '6', time: 1800, type: 'observe', priority: 'medium', bubble: '注意看这个构图', delivery: 'hint' },
    ];

    const plan: WatchCompanionPlan = {
      id: Date.now().toString(),
      movieTitle: currentSession?.title || '未知影片',
      mode: companionMode,
      density: companionDensity,
      triggers,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setWatchCompanionPlans([...watchCompanionPlans, plan]);
    if (currentSession) {
      updateMovieSession(currentSession.id, { companionPlanId: plan.id, companionMode, companionDensity });
      setCurrentSession(prev => prev ? { ...prev, companionPlanId: plan.id } : null);
    }
    setShowTriggerList(true);
    return plan;
  }, [companionMode, companionDensity, currentSession, watchCompanionPlans, setWatchCompanionPlans, updateMovieSession]);

  const generatePlanFromSubtitles = useCallback(() => {
    if (!currentSession?.subtitleContent || currentSession?.companionPlanId) return null;
    const entries = parseSubtitle(currentSession.subtitleContent);
    if (entries.length === 0) return null;
    const triggers: CompanionTrigger[] = [];
    let lastT = -300;
    const types: CompanionTriggerType[] = ['observe', 'emotion', 'question', 'memory'];
    for (const entry of entries) {
      if (entry.start >= lastT + 300) {
        lastT = entry.start;
        triggers.push({
          id: `sub_${triggers.length}_${Date.now()}`,
          time: entry.start,
          type: types[triggers.length % types.length],
          priority: triggers.length % 3 === 0 ? 'high' : triggers.length % 3 === 1 ? 'medium' : 'low',
          bubble: entry.text.replace(/\n/g, ' ').slice(0, 80),
          delivery: triggers.length % 2 === 0 ? 'auto' : 'hint',
        });
        if (triggers.length >= 15) break;
      }
    }
    if (triggers.length === 0 && entries.length > 0) {
      triggers.push({
        id: `sub_0_${Date.now()}`, time: entries[0].start,
        type: 'observe', priority: 'medium',
        bubble: entries[0].text.replace(/\n/g, ' ').slice(0, 80),
        delivery: 'auto',
      });
    }
    const plan: WatchCompanionPlan = {
      id: Date.now().toString(),
      movieTitle: currentSession?.title || '未知影片',
      mode: companionMode,
      density: companionDensity,
      triggers,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setWatchCompanionPlans([...watchCompanionPlans, plan]);
    if (currentSession) {
      updateMovieSession(currentSession.id, { companionPlanId: plan.id, companionMode, companionDensity });
      setCurrentSession(prev => prev ? { ...prev, companionPlanId: plan.id } : null);
    }
    return plan;
  }, [companionMode, companionDensity, currentSession, watchCompanionPlans, setWatchCompanionPlans, updateMovieSession]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const sessionId = Date.now().toString();
    const videoDbKey = `movie_${sessionId}`;

    await saveVideoFile(videoDbKey, file);

    const videoUrl = URL.createObjectURL(file);

    const session: MovieSession = {
      id: sessionId,
      title: file.name.replace(/\.[^/.]+$/, ''),
      videoUrl,
      videoDbKey,
      currentTime: 0,
      duration: 0,
      companionMode: 'natural',
      companionDensity: 'normal',
      isPlaying: false,
      characterId: selectedCharacterId || undefined,
      notes: [],
      chatMessages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setMovieSessions([...movieSessions, session]);
    setCurrentSession(session);
  };

  const handleBilibiliSubmit = async (inputUrl?: string) => {
    const url = inputUrl ?? bilibiliUrlInput;
    if (!url.trim() || bilibiliLoading) return;
    setBilibiliLoading(true);
    try {
      const result = await resolveBilibiliUrl(url);
      if (!result) { setBilibiliLoading(false); setErrorMsg('无法解析此链接'); return; }
      setBilibiliUrlInput('');
      const embedUrl = `https://player.bilibili.com/player.html?bvid=${result.bvid}&autoplay=0&high_quality=1`;
      const session: MovieSession = {
        id: Date.now().toString(),
        title: result.title,
        videoUrl: embedUrl,
        isBilibili: true,
        bilibiliBvid: result.bvid,
        currentTime: 0,
        duration: 0,
        companionMode: 'natural',
        companionDensity: 'normal',
        isPlaying: false,
        characterId: selectedCharacterId || undefined,
        notes: [],
        chatMessages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setMovieSessions([...movieSessions, session]);
      setCurrentSession(session);
    } catch {}
    setBilibiliLoading(false);
  };

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const session = currentSessionRef.current;
      if (session) {
        updateMovieSession(session.id, { subtitleContent: content });
        setCurrentSession(prev => prev ? { ...prev, subtitleContent: content } : null);
      }
      // After import, auto-generate plan if there was a pending action
      const pendingAction = pendingSubtitleActionRef.current;
      pendingSubtitleActionRef.current = null;
      if (pendingAction) {
        setTimeout(() => {
          generatePlanFromSubtitles();
          if (pendingAction === 'plan') setShowPlanModal(true);
          else setShowTriggerList(true);
        }, 300);
      }
    };
    reader.readAsText(file);
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        saveProgress();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = (e: React.TimeEvent<HTMLVideoElement>) => {
    const time = e.target.currentTime;
    setCurrentTime(time);
    checkTriggers(time);
  };

  const handleDurationChange = (e: React.TimeEvent<HTMLVideoElement>) => {
    setDuration(e.target.duration);
  };

  const saveProgress = () => {
    if (currentSession && videoRef.current) {
      updateMovieSession(currentSession.id, {
        currentTime: videoRef.current.currentTime,
        duration: videoRef.current.duration,
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const checkTriggers = useCallback((time: number) => {
    if (!currentSession?.companionPlanId) return;

    const plans = Array.isArray(watchCompanionPlans) ? watchCompanionPlans : [];
    const plan = plans.find(p => p.id === currentSession.companionPlanId);
    if (!plan) return;

    const newActiveTriggers = plan.triggers.filter(t => {
      if (t.consumed) return false;
      const withinWindow = time >= t.time - 2 && time <= t.time + 3;
      if (!withinWindow) return false;

      let shouldShow = false;
      if (companionMode === 'active') {
        shouldShow = t.delivery === 'auto' || t.priority === 'high';
      } else if (companionMode === 'natural') {
        shouldShow = t.delivery === 'auto' || (t.delivery === 'hint' && t.priority !== 'low');
      }
      return shouldShow;
    });

    if (newActiveTriggers.length > 0) {
      const highestPriority = newActiveTriggers.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })[0];

      if (!showBubble || showBubble.id !== highestPriority.id) {
        setShowBubble(highestPriority);
        addChatMessage(highestPriority.bubble, true, time);

        const plansCopy = Array.isArray(watchCompanionPlans) ? [...watchCompanionPlans] : [];
        const planIndex = plansCopy.findIndex(p => p.id === currentSession?.companionPlanId);
        if (planIndex !== -1) {
          const triggerIndex = plansCopy[planIndex].triggers.findIndex(t => t.id === highestPriority.id);
          if (triggerIndex !== -1) {
            plansCopy[planIndex].triggers[triggerIndex].consumed = true;
            setWatchCompanionPlans(plansCopy);
          }
        }
      }
    }
  }, [currentSession?.companionPlanId, watchCompanionPlans, companionMode, showBubble]);

  const addChatMessage = useCallback((text: string, isCompanion: boolean, time: number) => {
    const newMsg: MovieChatMessage = {
      id: Date.now().toString(),
      text,
      isCompanion,
      time,
    };
    setChatMessages(prev => [...prev, newMsg]);
    if (currentSessionRef.current) {
      try {
        const store = useAppStore.getState();
        const live = store.movieSessions.find(s => s.id === currentSessionRef.current!.id);
        updateMovieSession(currentSessionRef.current.id, {
          chatMessages: [...(live?.chatMessages || []), newMsg],
        });
      } catch {}
    }
  }, [setChatMessages, updateMovieSession]);

  // Stable handler for chat sends from the extracted component
  // Uses refs so it never changes and never triggers re-renders of child components
  const handleChatSend = useCallback(async (text: string) => {
    const charId = selectedCharacterIdRef.current;
    if (!charId) return;
    const time = currentTimeRef.current;

    addChatMessage(text, false, time);
    setIsAiTyping(true);
    try {
      const reply = await getCharacterReply(charId, text, {
        extraContext: `用户正在和你一起看电影，当前播放到了 ${formatTime(time)} 的位置。请结合这部电影的场景和你的角色设定来回复，简短自然，像一起看电影时闲聊一样。`,
      });
      addChatMessage(reply, true, currentTimeRef.current);
      // 观影聊天记忆+情绪
      const session = currentSessionRef.current;
      saveInteractionMemory(charId, `一起看电影时聊了${text}`, `影片:${session?.title}，对方说:${reply.slice(0, 30)}`, 'event', 3);
      useAppStore.getState().addEmotionEvent({ characterId: charId, paDelta: 0.12, naDelta: -0.03, word: '愉快', valence: 0.4, arousal: 0.4, matchSource: 'free_form', source: 'manual' });
    } catch {
      addChatMessage('嗯~', true, currentTimeRef.current);
    } finally {
      setIsAiTyping(false);
    }
  }, [addChatMessage, setIsAiTyping]);

  const handleSaveTitle = () => {
    if (!currentSession || !editTitleValue.trim()) return;
    updateMovieSession(currentSession.id, { title: editTitleValue.trim() });
    setCurrentSession(prev => prev ? { ...prev, title: editTitleValue.trim() } : null);
    setEditingTitle(false);
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !currentSession) return;
    const newNote = { time: currentTime, text: noteText, createdAt: Date.now() };
    const updatedNotes = [...(currentSession.notes || []), newNote];
    updateMovieSession(currentSession.id, { notes: updatedNotes });
    setCurrentSession(prev => prev ? { ...prev, notes: updatedNotes } : null);
    setNoteText('');
    setShowNoteInput(false);
  };

  const formatDateTime = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeFull = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Shared liquid-glass class helper ──
  const lg = 'liquid-glass';
  const lgs = 'liquid-glass-strong';

  // ── Delete confirm modal ──
  const deleteConfirmModal = showDeleteConfirm ? (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
      <div className={`${lg} w-full max-w-xs p-8`} style={{ borderRadius: '2rem' }}>
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
            <Trash2 size={24} className="text-white/70" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2" style={FONT_HEADING}>删除观影记录</h3>
          <p className="text-sm text-white/50" style={FONT_BODY}>确定要删除这条观影记录吗？<br/>聊天记录和陪看计划也会一并删除。</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteConfirm(null)}
            className={`flex-1 py-3 ${lg} text-white/80 rounded-full text-sm font-medium transition-all duration-300 active:scale-95`}
            style={FONT_BODY}
          >
            取消
          </button>
          <button
            onClick={async () => {
              if (showDeleteConfirm) {
                const session = movieSessions.find(s => s.id === showDeleteConfirm);
                if (session?.videoDbKey) {
                  await deleteVideoFile(session.videoDbKey);
                }
                if (session?.companionPlanId) {
                  const plans = Array.isArray(watchCompanionPlans) ? watchCompanionPlans : [];
                  setWatchCompanionPlans(plans.filter(p => p.id !== session.companionPlanId));
                }
                deleteMovieSession(showDeleteConfirm);
                if (currentSession?.id === showDeleteConfirm) {
                  setCurrentSession(null);
                  setChatMessages([]);
                }
              }
              setShowDeleteConfirm(null);
            }}
            className="flex-1 py-3 rounded-full text-sm font-medium text-white/90 transition-all duration-300 active:scale-95"
            style={{ ...FONT_BODY, backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Bottom sheet wrapper ──
  const BottomSheet = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-h-[80vh] overflow-y-auto"
        style={{
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: '2.5rem 2.5rem 0 0',
          border: 'none',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════
  //  SCREEN: Character Selection
  // ═══════════════════════════════════════════════
  if (showSelectCharacter) {
    return (
      <>
      <div className="h-full flex flex-col bg-black">
        <div className="flex-none px-5 pt-14 pb-4 flex items-center justify-between">
          <button onClick={() => setShowSelectCharacter(false)} className="text-white/60 hover:text-white/90 transition-colors">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-lg text-white" style={FONT_HEADING}>选择陪看角色</h1>
          <div className="w-7" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <div className="grid grid-cols-2 gap-4">
            {Object.values(characters).filter(c => !c.isDisabled).map(char => (
              <button
                key={char.id}
                onClick={() => { setSelectedCharacterId(char.id); setShowSelectCharacter(false); }}
                className={`${lg} flex flex-col items-center p-6 transition-all duration-300 active:scale-95`}
                style={{ borderRadius: '2rem' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3 border border-white/10"
                  style={{ background: char.avatar.startsWith('#') ? char.avatar : 'rgba(255,255,255,0.08)' }}
                >
                  {!char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full rounded-full object-cover" alt="" />}
                  {char.avatar.startsWith('#') && char.name[0]}
                </div>
                <div className="font-semibold text-white" style={FONT_BODY}>{char.name}</div>
                <div className="text-xs text-white/50 mt-1" style={FONT_BODY}>{char.relationship}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      {deleteConfirmModal}
    </>
    );
  }

  // ═══════════════════════════════════════════════
  //  SCREEN: Main Menu (no character, no session)
  // ═══════════════════════════════════════════════
  if (!currentSession && !selectedCharacterId && !isSoloMode) {
    const allSessions = Array.isArray(movieSessions) ? movieSessions : [];
    return (
      <>
      <div className="h-full flex flex-col bg-black">
        <div className="flex-none px-5 pt-14 pb-3 flex items-center justify-between">
          <button onClick={onBack} className="text-white/50 hover:text-white/80 transition-colors">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-lg text-white" style={FONT_HEADING}>观影室</h1>
          <div className="w-7" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="flex flex-col items-center justify-center mb-8 pt-8">
            <div className={`${lg} w-28 h-28 rounded-full flex items-center justify-center mb-6`}>
              <Film size={40} className="text-white/70" />
            </div>
            <h2 className="text-3xl text-white mb-3 text-center" style={FONT_HEADING}>Cinema</h2>
            <p className="text-white/50 text-center text-sm mb-8 max-w-[240px]" style={FONT_BODY}>
              选择一个角色陪你看电影<br/>或独自享受这段时光
            </p>

            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => setShowSelectCharacter(true)}
                className={`w-full py-4 px-6 ${lgs} text-white rounded-full font-medium flex items-center justify-center gap-3 transition-all duration-300 active:scale-95`}
                style={FONT_BODY}
              >
                <Users size={20} />
                选择陪看角色
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
                <div className="relative flex justify-center text-xs"><span className="px-3 bg-black text-white/30" style={FONT_BODY}>或者</span></div>
              </div>

              <button
                onClick={() => setIsSoloMode(true)}
                className={`w-full py-4 px-6 ${lg} text-white/80 rounded-full font-medium flex items-center justify-center gap-3 transition-all duration-300 active:scale-95`}
                style={FONT_BODY}
              >
                <Film size={20} />
                独自观影
              </button>
            </div>
          </div>

          {allSessions.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <span className="text-xs font-medium text-white/40 tracking-wider" style={FONT_BODY}>观影记录</span>
              </div>
              <div className="space-y-2.5">
                {allSessions.map(session => (
                  <div
                    key={session.id}
                    className={`${lg} flex items-center gap-3 p-3 transition-all duration-300 group`}
                    style={{ borderRadius: '2rem' }}
                  >
                    <button
                      onClick={() => setCurrentSession(session)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className={`${lg} w-14 h-10 flex items-center justify-center`} style={{ borderRadius: '1rem' }}>
                        <Film size={16} className="text-white/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {session.isBilibili ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 flex-shrink-0 font-medium" style={FONT_BODY}>B站</span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 flex-shrink-0 font-medium" style={FONT_BODY}>本地</span>
                          )}
                          <div className="text-sm font-medium text-white/90 truncate" style={FONT_BODY}>{session.title}</div>
                        </div>
                        <div className="text-xs text-white/40 flex items-center gap-1" style={FONT_BODY}>
                          {session.isBilibili && session.currentTime
                            ? '已观看'
                            : session.currentTime && session.duration
                            ? `${formatTime(session.currentTime)} / ${formatTime(session.duration)}`
                            : '未播放'}
                          <span>·</span>
                          {formatDateTime(session.updatedAt || session.createdAt)}
                          {session.characterId && characters[session.characterId] && (
                            <><span>·</span><span>{characters[session.characterId].name}</span></>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-white/40 group-hover:text-white/70 transition-colors" style={FONT_BODY}>继续</div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(session.id); }}
                      className="p-2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {deleteConfirmModal}
    </>
    );
  }

  // ═══════════════════════════════════════════════
  //  SCREEN: Session selection (has character, no session yet)
  // ═══════════════════════════════════════════════
  if (!currentSession) {
    const sessions = Array.isArray(movieSessions) ? movieSessions : [];

    return (
      <>
      <div className="h-full flex flex-col bg-black">
        <div className="flex-none px-5 pt-14 pb-3 flex items-center justify-between">
          <button onClick={() => { setIsSoloMode(false); setSelectedCharacterId(null); }} className="text-white/50 hover:text-white/80 transition-colors">
            <ChevronLeft size={28} />
          </button>
          <div className="text-center">
            <h1 className="text-lg text-white" style={FONT_HEADING}>观影室</h1>
            {selectedCharacter && <p className="text-xs text-white/50 mt-0.5" style={FONT_BODY}>{selectedCharacter.name} 陪你一起看</p>}
          </div>
          <button onClick={() => setShowSelectCharacter(true)} className="text-white/50 p-2 hover:text-white/80 transition-colors">
            <Users size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <div className="text-center mb-8 pt-8">
            <div className={`${lg} w-20 h-20 rounded-full flex items-center justify-center mb-5 mx-auto`}>
              <Play size={28} className="text-white/70 ml-0.5" />
            </div>
            <h2 className="text-2xl text-white mb-2" style={FONT_HEADING}>开始观影</h2>
            <p className="text-white/50 text-sm" style={FONT_BODY}>上传视频文件开启观影之旅</p>
          </div>

          <div className="w-full max-w-sm mx-auto space-y-3 mb-8">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-4 px-6 ${lgs} text-white rounded-full font-medium flex items-center justify-center gap-3 transition-all duration-300 active:scale-95`}
              style={FONT_BODY}
            >
              <Film size={20} />
              上传视频
            </button>

            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />

            <button
              onClick={() => subtitleFileRef.current?.click()}
              className={`w-full py-4 px-6 ${lg} text-white/70 rounded-full font-medium flex items-center justify-center gap-3 transition-all duration-300 active:scale-95`}
              style={FONT_BODY}
            >
              导入台词
            </button>

            <input ref={subtitleFileRef} type="file" accept=".srt,.vtt,.ssa,.ass" onChange={handleSubtitleUpload} className="hidden" />

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
              <div className="relative flex justify-center text-xs"><span className="px-3 bg-black text-white/30" style={FONT_BODY}>或者</span></div>
            </div>

            <div className={`${lg} p-3`} style={{ borderRadius: '2rem' }}>
              <div className="flex gap-2">
                <input
                  value={bilibiliUrlInput}
                  onChange={e => {
                    const val = e.target.value;
                    setBilibiliUrlInput(val);
                    if (bilibiliSubmitTimerRef.current) clearTimeout(bilibiliSubmitTimerRef.current);
                    if (val.trim() && isPotentialBilibiliUrl(val) && !currentSession) {
                      bilibiliSubmitTimerRef.current = setTimeout(() => handleBilibiliSubmit(val), 100);
                    }
                  }}
                  placeholder="粘贴 B站链接 / BV号..."
                  className="flex-1 bg-transparent px-4 py-3 text-sm text-white/70 outline-none placeholder-white/30"
                  style={FONT_BODY}
                  onKeyDown={e => e.key === 'Enter' && handleBilibiliSubmit(bilibiliUrlInput)}
                />
                <button
                  onClick={handleBilibiliSubmit}
                  disabled={bilibiliLoading || !isPotentialBilibiliUrl(bilibiliUrlInput)}
                  className={`px-5 py-3 rounded-full text-sm font-medium transition-all duration-300 active:scale-95 disabled:opacity-30 ${isPotentialBilibiliUrl(bilibiliUrlInput) && !bilibiliLoading ? lgs : lg}`}
                  style={FONT_BODY}
                >
                  {bilibiliLoading ? '解析中...' : '播放'}
                </button>
              </div>
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <span className="text-xs font-medium text-white/40 tracking-wider" style={FONT_BODY}>观影记录</span>
              </div>
              <div className="space-y-2.5">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className={`${lg} flex items-center gap-3 p-3 transition-all duration-300 group`}
                    style={{ borderRadius: '2rem' }}
                  >
                    <button
                      onClick={() => setCurrentSession(session)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className={`${lg} w-14 h-10 flex items-center justify-center`} style={{ borderRadius: '1rem' }}>
                        <Film size={16} className="text-white/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {session.isBilibili ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 flex-shrink-0 font-medium" style={FONT_BODY}>B站</span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 flex-shrink-0 font-medium" style={FONT_BODY}>本地</span>
                          )}
                          <div className="text-sm font-medium text-white/90 truncate" style={FONT_BODY}>{session.title}</div>
                        </div>
                        <div className="text-xs text-white/40 flex items-center gap-1" style={FONT_BODY}>
                          {session.isBilibili && session.currentTime
                            ? '已观看'
                            : session.currentTime && session.duration
                            ? `${formatTime(session.currentTime)} / ${formatTime(session.duration)}`
                            : '未播放'}
                          <span>·</span>
                          {formatDateTime(session.updatedAt || session.createdAt)}
                          {session.characterId && characters[session.characterId] && (
                            <><span>·</span><span>{characters[session.characterId].name}</span></>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-white/40 group-hover:text-white/70 transition-colors" style={FONT_BODY}>继续</div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(session.id); }}
                      className="p-2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {deleteConfirmModal}
    </>
    );
  }

  // ═══════════════════════════════════════════════
  //  PLAYER SCREEN (active session)
  // ═══════════════════════════════════════════════

  // ── Action buttons row ──
  const ActionButtons = ({ compact = false }: { compact?: boolean }) => {
    const iconSize = compact ? 16 : 18;
    const btnSize = compact ? 'w-9 h-9' : 'w-10 h-10';
    const lblSize = compact ? 'text-[10px]' : 'text-xs';
    return (
      <div className={`flex items-center justify-center gap-1 ${lg} py-1.5 px-2`} style={{ borderRadius: '2rem', margin: '0 4px' }}>
        <button onClick={() => setShowNotesList(true)} className={`flex flex-col items-center gap-0.5 p-1.5 transition-all duration-200 active:scale-90`}>
          <div className={`${btnSize} rounded-full flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all`}>
            <PenLine size={iconSize} />
          </div>
          <span className={`${lblSize} text-white/40`} style={FONT_BODY}>笔记</span>
        </button>
        <button onClick={() => setShowCompanionSettings(true)} className={`flex flex-col items-center gap-0.5 p-1.5 transition-all duration-200 active:scale-90`}>
          <div className={`${btnSize} rounded-full flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all`}>
            <Settings size={iconSize} />
          </div>
          <span className={`${lblSize} text-white/40`} style={FONT_BODY}>设置</span>
        </button>
        <button onClick={() => {
          if (!currentSession?.companionPlanId) {
            if (currentSession?.subtitleContent) {
              generatePlanFromSubtitles();
              setShowPlanModal(true);
            } else {
              pendingSubtitleActionRef.current = 'plan';
              subtitlePlayerFileRef.current?.click();
            }
          } else {
            setShowPlanModal(true);
          }
        }} className={`flex flex-col items-center gap-0.5 p-1.5 transition-all duration-200 active:scale-90`}>
          <div className={`${btnSize} rounded-full flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all`}>
            <Sparkles size={iconSize} />
          </div>
          <span className={`${lblSize} text-white/40`} style={FONT_BODY}>计划</span>
        </button>
        <button onClick={() => {
          if (!currentSession?.companionPlanId) {
            if (currentSession?.subtitleContent) {
              generatePlanFromSubtitles();
              setShowTriggerList(true);
            } else {
              pendingSubtitleActionRef.current = 'star';
              subtitlePlayerFileRef.current?.click();
            }
          } else {
            setShowTriggerList(true);
          }
        }} className={`flex flex-col items-center gap-0.5 p-1.5 transition-all duration-200 active:scale-90`}>
          <div className={`${btnSize} rounded-full flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all`}>
            <List size={iconSize} />
          </div>
          <span className={`${lblSize} text-white/40`} style={FONT_BODY}>星图</span>
        </button>
        <button onClick={() => subtitlePlayerFileRef.current?.click()} className={`flex flex-col items-center gap-0.5 p-1.5 transition-all duration-200 active:scale-90`}>
          <div className={`${btnSize} rounded-full flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-all`}>
            <FileText size={iconSize} />
          </div>
          <span className={`${lblSize} text-white/40`} style={FONT_BODY}>台词</span>
        </button>
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  //  RENDER: Video Player
  // ═══════════════════════════════════════════════
  const videoProps = {
    ref: videoRef,
    src: videoSrc,
    playsInline: true as const,
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onTimeUpdate: (e: React.TimeEvent<HTMLVideoElement>) => {
      const t = e.target.currentTime;
      latestTimeRef.current = t;
      setCurrentTime(t);
      checkTriggers(t);
    },
    onDurationChange: (e: React.TimeEvent<HTMLVideoElement>) => setDuration(e.target.duration),
    onLoadedMetadata: () => {
      const seekTarget = currentSession?.currentTime || latestTimeRef.current || 0;
      if (videoRef.current && !seekedRef.current && seekTarget > 0) {
        videoRef.current.currentTime = seekTarget;
        seekedRef.current = true;
      }
    },
    onError: async () => {
      if (currentSession?.videoDbKey && videoRef.current && !videoSrc) {
        try { const blob = await loadVideoFile(currentSession.videoDbKey); if (blob && videoRef.current) { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = URL.createObjectURL(blob); videoRef.current.src = objectUrlRef.current; videoRef.current.load(); } } catch {}
      }
    },
  };

  return (
    <div className="h-full bg-black flex flex-col overflow-hidden">
      {/* ── Error toast ── */}
      {errorMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] px-5 py-2.5 rounded-full text-sm text-white/90"
          style={{ background: 'rgba(220,50,50,0.8)', backdropFilter: 'blur(12px)' }}>
          {errorMsg}
        </div>
      )}
      {/* ── Portrait header (only in portrait) ── */}
      {!isLandscape && (
        <div className="flex-none px-4 pt-14 pb-2 flex items-center justify-between" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
          <button onClick={() => { setIsSoloMode(false); setSelectedCharacterId(null); setCurrentSession(null); }} className="text-white/60 hover:text-white/90 transition-colors">
            <ChevronLeft size={26} />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              {currentSession?.isBilibili ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-medium" style={FONT_BODY}>B站</span>
              ) : currentSession && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-medium" style={FONT_BODY}>本地</span>
              )}
              {editingTitle ? (
                <input
                  value={editTitleValue}
                  onChange={e => setEditTitleValue(e.target.value)}
                  className="text-base bg-white/10 text-white rounded-lg px-2 py-0.5 outline-none text-center w-40"
                  style={FONT_BODY}
                  autoFocus
                  onBlur={handleSaveTitle}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                />
              ) : (
                <h1
                  className="text-base text-white cursor-pointer hover:text-white/80 transition-colors"
                  style={FONT_HEADING}
                  onClick={() => { setEditTitleValue(currentSession?.title || ''); setEditingTitle(true); }}
                  title="点击修改名称"
                >
                  {currentSession?.title || '观影室'}
                </h1>
              )}
            </div>
            {selectedCharacter && <p className="text-[10px] text-white/40 mt-0.5" style={FONT_BODY}>{selectedCharacter.name} 陪你一起看</p>}
          </div>
          <div className="w-7" />
        </div>
      )}

      {/* ── Video + landscape right panel ── */}
      <div className={`flex-1 min-h-0 flex ${isLandscape ? 'flex-row' : 'flex-col'}`}>
        {/* Shared video — always mounted at the same tree position */}
        <div className="flex-1 min-h-0 bg-black flex items-center justify-center">
          {currentSession?.isBilibili ? (
            <iframe
              src={currentSession.videoUrl}
              className="w-full h-full"
              allow="autoplay; fullscreen"
              style={{ border: 'none' }}
            />
          ) : (
            <video {...videoProps} className="w-full h-full" style={{ objectFit: 'contain' }} controls />
          )}
        </div>

        {/* Landscape side panel */}
        {isLandscape && (
          <div className="w-[45%] flex-shrink-0 h-full flex flex-col bg-black">
            <ActionButtons compact />
            <MovieChatPanel
              chatMessages={chatMessages}
              isAiTyping={isAiTyping}
              selectedCharacter={selectedCharacter}
              onSend={handleChatSend}
            />
          </div>
        )}
      </div>

      {/* ── Portrait bottom panel ── */}
      {!isLandscape && (
        <div className="flex-shrink-0 flex flex-col gap-1 pb-2">
          <ActionButtons />
          <MovieChatPanel
              chatMessages={chatMessages}
              isAiTyping={isAiTyping}
              selectedCharacter={selectedCharacter}
              onSend={handleChatSend}
            />
        </div>
      )}

      {/* ── Modals ── */}

      {showCompanionSettings && (
        <BottomSheet onClose={() => setShowCompanionSettings(false)}>
          <div className="p-6 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg text-white font-semibold" style={FONT_HEADING}>陪看设置</h3>
              <button onClick={() => setShowCompanionSettings(false)} className="text-white/50 hover:text-white/80 transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs text-white/50 mb-3 block tracking-wider" style={FONT_BODY}>互动模式</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(MODE_LABELS) as CompanionMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setCompanionMode(mode)}
                      className={`py-3 px-4 rounded-full text-center text-sm font-medium transition-all duration-300 active:scale-95 ${
                        companionMode === mode ? lgs : lg
                      }`}
                      style={{
                        ...FONT_BODY,
                        color: companionMode === mode ? '#fff' : 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-3 block tracking-wider" style={FONT_BODY}>触发密度</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(DENSITY_LABELS) as CompanionDensity[]).map(density => (
                    <button
                      key={density}
                      onClick={() => setCompanionDensity(density)}
                      className={`py-3 px-4 rounded-full text-center text-sm font-medium transition-all duration-300 active:scale-95 ${
                        companionDensity === density ? lgs : lg
                      }`}
                      style={{
                        ...FONT_BODY,
                        color: companionDensity === density ? '#fff' : 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {DENSITY_LABELS[density]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { generateMockCompanionPlan(); setShowCompanionSettings(false); }}
                className={`w-full py-4 ${lgs} text-white rounded-full font-medium transition-all duration-300 active:scale-95`}
                style={FONT_BODY}
              >
                生成陪看计划
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {showPlanModal && (
        <BottomSheet onClose={() => setShowPlanModal(false)}>
          <div className="p-6 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg text-white font-semibold" style={FONT_HEADING}>陪看计划</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-white/50 hover:text-white/80 transition-colors">
                <X size={22} />
              </button>
            </div>

            {(() => {
              const plans = Array.isArray(watchCompanionPlans) ? watchCompanionPlans : [];
              const plan = plans.find(p => p.id === currentSession?.companionPlanId);
              if (!currentSession?.subtitleContent) {
                return (
                  <div className="text-center py-8">
                    <FileText size={40} className="mx-auto mb-4 text-white/40" />
                    <p className="text-white/70 text-sm font-medium" style={FONT_BODY}>需要导入台词才能生成陪看计划</p>
                    <p className="text-white/40 text-xs mt-1 mb-6" style={FONT_BODY}>选择 SRT / VTT 台词文件</p>
                    <button
                      onClick={() => { pendingSubtitleActionRef.current = 'plan'; subtitlePlayerFileRef.current?.click(); }}
                      className={`w-full py-4 ${lgs} text-white rounded-full font-medium transition-all duration-300 active:scale-95`}
                      style={FONT_BODY}
                    >
                      选择台词文件
                    </button>
                  </div>
                );
              }
              if (!plan) {
                return (
                  <div className="text-center py-8 text-white/40">
                    <Sparkles size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm" style={FONT_BODY}>还没有生成计划</p>
                    <p className="text-xs mt-1 text-white/30" style={FONT_BODY}>点击设置按钮生成</p>
                  </div>
                );
              }
              return (
                <div className="space-y-4">
                  <div className={`${lg} p-5`} style={{ borderRadius: '2rem' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`${lg} w-10 h-10 rounded-full flex items-center justify-center`}>
                        <Sparkles size={18} className="text-white/70" />
                      </div>
                      <div>
                        <div className="font-medium text-white/90 text-sm" style={FONT_BODY}>{plan.movieTitle}</div>
                        <div className="text-xs text-white/40" style={FONT_BODY}>计划已生成</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className={`${lg} p-3`} style={{ borderRadius: '1rem' }}>
                        <div className="text-[10px] text-white/40 mb-1 tracking-wider" style={FONT_BODY}>互动模式</div>
                        <div className="text-sm font-medium text-white/80" style={FONT_BODY}>{MODE_LABELS[plan.mode]}</div>
                      </div>
                      <div className={`${lg} p-3`} style={{ borderRadius: '1rem' }}>
                        <div className="text-[10px] text-white/40 mb-1 tracking-wider" style={FONT_BODY}>触发密度</div>
                        <div className="text-sm font-medium text-white/80" style={FONT_BODY}>{DENSITY_LABELS[plan.density]}</div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs text-white/30">
                        <span style={FONT_BODY}>生成时间</span>
                        <span style={FONT_BODY}>{new Date(plan.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => { setShowPlanModal(false); setShowTriggerList(true); }}
                    className={`w-full py-3 ${lg} text-white/60 rounded-full font-medium transition-all duration-300 active:scale-95`}
                    style={FONT_BODY}
                  >
                    查看陪看点星图
                  </button>
                </div>
              );
            })()}
          </div>
        </BottomSheet>
      )}

      {showTriggerList && (
        <BottomSheet onClose={() => setShowTriggerList(false)}>
          <div className="p-6 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg text-white font-semibold" style={FONT_HEADING}>陪看点星图</h3>
              <button onClick={() => setShowTriggerList(false)} className="text-white/50 hover:text-white/80 transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-3">
              {(() => {
                const plans = Array.isArray(watchCompanionPlans) ? watchCompanionPlans : [];
                const plan = plans.find(p => p.id === currentSession?.companionPlanId);
                if (!currentSession?.subtitleContent) {
                  return (
                    <div className="text-center py-8">
                      <FileText size={40} className="mx-auto mb-4 text-white/40" />
                      <p className="text-white/70 text-sm font-medium" style={FONT_BODY}>需要导入台词才能生成星图</p>
                      <p className="text-white/40 text-xs mt-1 mb-6" style={FONT_BODY}>选择 SRT / VTT 台词文件</p>
                      <button
                        onClick={() => { pendingSubtitleActionRef.current = 'star'; subtitlePlayerFileRef.current?.click(); }}
                        className={`w-full py-4 ${lgs} text-white rounded-full font-medium transition-all duration-300 active:scale-95`}
                        style={FONT_BODY}
                      >
                        选择台词文件
                      </button>
                    </div>
                  );
                }
                if (!plan || !plan.triggers.length) {
                  return (
                    <div className="text-center py-8 text-white/40">
                      <List size={32} className="mx-auto mb-3 opacity-50" />
                      <p className="text-sm" style={FONT_BODY}>还没有陪看点</p>
                      <p className="text-xs mt-1 text-white/30" style={FONT_BODY}>点击计划按钮生成</p>
                    </div>
                  );
                }
                return plan.triggers.map((trigger, index) => (
                  <div key={trigger.id} className={`${lg} p-4`} style={{ borderRadius: '1.5rem' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-white/60 text-sm">
                        <span className="text-white/30" style={FONT_BODY}>{index + 1}.</span>
                        <span className="tabular-nums text-white/70 font-medium" style={FONT_BODY}>{formatTime(trigger.time)}</span>
                      </div>
                      <div
                        className={`text-[10px] px-3 py-0.5 rounded-full ${
                          trigger.consumed ? 'text-white/50' : 'text-white/80'
                        }`}
                        style={{
                          ...FONT_BODY,
                          background: trigger.consumed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        {trigger.consumed ? '已触发' : '待触发'}
                      </div>
                    </div>
                    <p className="text-sm text-white/70" style={FONT_BODY}>{trigger.bubble}</p>
                  </div>
                ));
              })()}
            </div>
          </div>
        </BottomSheet>
      )}

      {showNotesList && (
        <BottomSheet onClose={() => setShowNotesList(false)}>
          <div className="p-6 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg text-white font-semibold" style={FONT_HEADING}>观影笔记</h3>
              <button onClick={() => setShowNotesList(false)} className="text-white/50 hover:text-white/80 transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-3">
              {!currentSession.notes || currentSession.notes.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <PenLine size={36} className="mx-auto mb-3 opacity-50" />
                  <p style={FONT_BODY}>还没有笔记</p>
                  <p className="text-sm mt-1 text-white/30" style={FONT_BODY}>点击下方按钮记录</p>
                </div>
              ) : (
                currentSession.notes.map((note, i) => (
                  <div key={i} className={`${lg} p-4`} style={{ borderRadius: '1.5rem' }}>
                    <button
                      onClick={() => {
                        if (currentSession) {
                          const newNotes = currentSession.notes.filter((_, idx) => idx !== i);
                          updateMovieSession(currentSession.id, { notes: newNotes });
                          setCurrentSession(prev => prev ? { ...prev, notes: newNotes } : null);
                        }
                      }}
                      className="absolute top-3 right-3 p-1 text-white/30 hover:text-white/60 transition-colors"
                    >
                      <X size={14} />
                    </button>
                    <div className="flex items-center gap-3 text-white/40 text-xs mb-2">
                      <span className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-white/50" />
                        <span style={FONT_BODY}>{formatTime(note.time)}</span>
                      </span>
                      {note.createdAt ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          <span style={FONT_BODY}>{new Date(note.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-white/80 leading-relaxed" style={FONT_BODY}>{note.text}</div>
                  </div>
                ))
              )}

              <button
                onClick={() => setShowNoteInput(true)}
                className={`w-full py-3.5 ${lg} text-white/60 rounded-full font-medium transition-all duration-300 active:scale-95`}
                style={FONT_BODY}
              >
                + 记录笔记
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {showNoteInput && (
        <BottomSheet onClose={() => setShowNoteInput(false)}>
          <div className="p-6 pb-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-white font-semibold" style={FONT_HEADING}>记录笔记</h3>
              <button onClick={() => setShowNoteInput(false)} className="text-white/50 hover:text-white/80 transition-colors">
                <X size={22} />
              </button>
            </div>

            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="记录此刻的想法..."
              className="w-full h-32 rounded-[2rem] p-5 text-sm text-white/80 outline-none resize-none placeholder-white/30"
              style={{
                ...FONT_BODY,
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(8px)',
                border: 'none',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08)',
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && handleAddNote()}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowNoteInput(false)}
                className={`flex-1 py-3.5 ${lg} text-white/60 rounded-full font-medium transition-all duration-300 active:scale-95`}
                style={FONT_BODY}
              >
                取消
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className={`flex-1 py-3.5 ${lgs} text-white rounded-full font-medium disabled:opacity-40 transition-all duration-300 active:scale-95`}
                style={FONT_BODY}
              >
                保存
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      <input ref={subtitlePlayerFileRef} type="file" accept=".srt,.vtt,.ssa,.ass" onChange={handleSubtitleUpload} className="hidden" />
      {deleteConfirmModal}
    </div>
  );
}
