import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Play, Pause, Users, Film, MessageCircle, Settings, Sparkles, VolumeX, PenLine, X, Volume2, Heart, Send, List, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { CompanionMode, CompanionDensity, CompanionTrigger, MovieSession, WatchCompanionPlan, MovieChatMessage } from '../../types';
import { saveVideoFile, loadVideoFile, deleteVideoFile } from '../../lib/db';
import { getCharacterReply } from '../../lib/ai';

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
  const [showBubble, setShowBubble] = useState<CompanionTrigger | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showNotesList, setShowNotesList] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; text: string; isCompanion: boolean; time: number }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const seekedRef = useRef(false);
  
  useEffect(() => {
    const checkLandscape = () => setIsLandscape(window.innerWidth > window.innerHeight);
    checkLandscape();
    window.addEventListener('resize', checkLandscape);
    return () => window.removeEventListener('resize', checkLandscape);
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
    if (!isPlaying || !currentSession) return;
    const interval = setInterval(() => saveProgress(), 5000);
    return () => clearInterval(interval);
  }, [isPlaying, currentSession?.id]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleFileRef = useRef<HTMLInputElement>(null);

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

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (currentSession) {
        updateMovieSession(currentSession.id, { subtitleContent: content });
        setCurrentSession(prev => prev ? { ...prev, subtitleContent: content } : null);
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

  const addChatMessage = (text: string, isCompanion: boolean, time: number) => {
    const newMsg: MovieChatMessage = {
      id: Date.now().toString(),
      text,
      isCompanion,
      time,
    };
    setChatMessages(prev => [...prev, newMsg]);
    // persist to store (best effort — never block the UI)
    if (currentSession) {
      try {
        const store = useAppStore.getState();
        const live = store.movieSessions.find(s => s.id === currentSession.id);
        updateMovieSession(currentSession.id, {
          chatMessages: [...(live?.chatMessages || []), newMsg],
        });
      } catch {}
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedCharacterId) return;
    const text = inputMessage;
    setInputMessage('');
    addChatMessage(text, false, currentTime);

    setIsAiTyping(true);
    try {
      const reply = await getCharacterReply(selectedCharacterId, text, {
        extraContext: `用户正在和你一起看电影，当前播放到了 ${formatTime(currentTime)} 的位置。请结合这部电影的场景和你的角色设定来回复，简短自然，像一起看电影时闲聊一样。`,
      });
      addChatMessage(reply, true, currentTime);
    } catch {
      addChatMessage('嗯~', true, currentTime);
    } finally {
      setIsAiTyping(false);
    }
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

  const deleteConfirmModal = showDeleteConfirm ? (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-6">
      <div className="bg-white rounded-3xl w-full max-w-xs p-6 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={28} className="text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">删除观影记录</h3>
          <p className="text-sm text-gray-500">确定要删除这条观影记录吗？<br/>聊天记录和陪看计划也会一并删除。</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteConfirm(null)}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
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
            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (showSelectCharacter) {
    return (
      <>
      <div className="h-full flex flex-col bg-gray-50">
        <div className="px-4 pt-14 pb-4 flex items-center justify-between bg-white border-b border-gray-200">
          <button onClick={() => setShowSelectCharacter(false)} className="text-gray-600"><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-medium text-gray-800">选择陪看角色</h1>
          <div className="w-7"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.values(characters).filter(c => !c.isDisabled).map(char => (
              <button
                key={char.id}
                onClick={() => { setSelectedCharacterId(char.id); setShowSelectCharacter(false); }}
                className="flex flex-col items-center p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
              >
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3"
                  style={{ background: char.avatar.startsWith('#') ? char.avatar : '#6b7280' }}
                >
                  {!char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full rounded-full object-cover" alt="" />}
                  {char.avatar.startsWith('#') && char.name[0]}
                </div>
                <div className="font-medium text-gray-800">{char.name}</div>
                <div className="text-xs text-gray-500">{char.relationship}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      {deleteConfirmModal}
    </>
    );
  }

  if (!currentSession && !selectedCharacterId && !isSoloMode) {
    const allSessions = Array.isArray(movieSessions) ? movieSessions : [];
    return (
      <>
      <div className="h-full flex flex-col bg-gradient-to-b from-violet-50 via-white to-violet-50">
        <div className="px-4 pt-14 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-violet-100">
          <button onClick={onBack} className="text-violet-300"><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-medium text-gray-800">观影室</h1>
          <div className="w-7"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="w-28 h-28 rounded-full bg-violet-100 flex items-center justify-center mb-8 shadow-sm">
              <Film size={40} className="text-violet-300" />
            </div>
            <h2 className="text-2xl font-light text-gray-700 mb-2">观影室</h2>
            <p className="text-gray-400 text-center mb-8">选择一个角色陪你看电影<br/>或独自享受这段时光</p>

            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => setShowSelectCharacter(true)}
                className="w-full py-4 px-6 bg-violet-300 text-white rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-violet-400 transition-colors shadow-md"
              >
                <Users size={20} />
                选择陪看角色
              </button>

              <button
                onClick={() => setIsSoloMode(true)}
                className="w-full py-4 px-6 bg-white text-gray-600 rounded-xl font-medium border border-violet-100 flex items-center justify-center gap-3 hover:bg-violet-50 transition-colors"
              >
                <Film size={20} />
                独自观影
              </button>
            </div>
          </div>

          {allSessions.length > 0 && (
            <div className="border-t border-violet-100 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3 px-2">观影记录</h3>
              <div className="space-y-2">
                {allSessions.map(session => (
                  <div
                    key={session.id}
                    className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-violet-100 hover:border-violet-200 hover:shadow-md transition-all group"
                  >
                    <button
                      onClick={() => setCurrentSession(session)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="w-16 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Film size={18} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{session.title}</div>
                        <div className="text-xs text-gray-400">
                          {session.currentTime && session.duration
                            ? `${formatTime(session.currentTime)} / ${formatTime(session.duration)}`
                            : '未播放'}
                          <span className="mx-1">·</span>
                          {formatDateTime(session.updatedAt || session.createdAt)}
                        </div>
                      </div>
                      <div className="text-xs text-violet-300">继续观看</div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(session.id); }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
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

  if (!currentSession) {
    const sessions = Array.isArray(movieSessions) ? movieSessions : [];

    return (
      <>
      <div className="h-full flex flex-col bg-gradient-to-br from-violet-50 via-white to-violet-50">
        <div className="px-4 pt-14 pb-3 flex items-center justify-between bg-white/90 backdrop-blur-sm border-b border-violet-100">
          <button onClick={() => { setIsSoloMode(false); setSelectedCharacterId(null); }} className="text-violet-300"><ChevronLeft size={28} /></button>
          <div className="text-center">
            <h1 className="text-lg font-medium text-gray-800">观影室</h1>
            {selectedCharacter && <p className="text-xs text-violet-300">{selectedCharacter.name} 陪你一起看</p>}
          </div>
          <button onClick={() => setShowSelectCharacter(true)} className="text-gray-400 p-2"><Users size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-white border border-violet-100 flex items-center justify-center mb-4 shadow-sm mx-auto">
              <Play size={32} className="text-violet-300" />
            </div>
            <h2 className="text-xl font-medium text-gray-700 mb-1">开始观影</h2>
            <p className="text-gray-400 text-sm">上传视频文件开启观影之旅</p>
          </div>

          <div className="w-full max-w-sm mx-auto space-y-3 mb-8">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 px-6 bg-violet-300 text-white rounded-xl font-medium flex items-center justify-center gap-3 shadow-md hover:bg-violet-400 transition-colors"
            >
              <Film size={20} />
              上传视频
            </button>

            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />

            <button
              onClick={() => subtitleFileRef.current?.click()}
              className="w-full py-4 px-6 bg-white text-gray-700 rounded-xl font-medium border border-violet-100 flex items-center justify-center gap-3 shadow-sm hover:bg-violet-50 transition-colors"
            >
              导入台词
            </button>

            <input ref={subtitleFileRef} type="file" accept=".srt,.vtt,.ssa,.ass" onChange={handleSubtitleUpload} className="hidden" />
          </div>

          {sessions.length > 0 && (
            <div className="border-t border-violet-100 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3 px-2">观影记录</h3>
              <div className="space-y-2">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-violet-100 hover:border-violet-200 hover:shadow-md transition-all group"
                  >
                    <button
                      onClick={() => setCurrentSession(session)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="w-16 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Film size={18} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{session.title}</div>
                        <div className="text-xs text-gray-400">
                          {session.currentTime && session.duration
                            ? `${formatTime(session.currentTime)} / ${formatTime(session.duration)}`
                            : '未播放'}
                          <span className="mx-1">·</span>
                          {formatDateTime(session.updatedAt || session.createdAt)}
                        </div>
                      </div>
                      <div className="text-xs text-violet-300">继续观看</div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(session.id); }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
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

  const ActionButtons = () => (
    <div className="flex items-center justify-center gap-2 py-3 bg-white/80 backdrop-blur-sm border-b border-violet-100 flex-shrink-0">
      <button onClick={() => setShowNotesList(true)} className="flex flex-col items-center gap-1 p-2">
        <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-300 hover:bg-violet-100 transition-colors">
          <PenLine size={18} />
        </div>
        <span className="text-xs text-gray-500">笔记</span>
      </button>
      <button onClick={() => setShowCompanionSettings(true)} className="flex flex-col items-center gap-1 p-2">
        <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-300 hover:bg-violet-100 transition-colors">
          <Settings size={18} />
        </div>
        <span className="text-xs text-gray-500">设置</span>
      </button>
      <button onClick={() => {
        if (!currentSession?.companionPlanId) {
          generateMockCompanionPlan();
        } else {
          setShowPlanModal(true);
        }
      }} className="flex flex-col items-center gap-1 p-2">
        <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-300 hover:bg-violet-100 transition-colors">
          <Sparkles size={18} />
        </div>
        <span className="text-xs text-gray-500">计划</span>
      </button>
      <button onClick={() => {
        if (!currentSession?.companionPlanId) {
          generateMockCompanionPlan();
        } else {
          setShowTriggerList(true);
        }
      }} className="flex flex-col items-center gap-1 p-2">
        <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-300 hover:bg-violet-100 transition-colors">
          <List size={18} />
        </div>
        <span className="text-xs text-gray-500">星图</span>
      </button>
      <button onClick={() => setIsFavorite(!isFavorite)} className="flex flex-col items-center gap-1 p-2">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isFavorite ? 'bg-violet-300 text-white' : 'bg-violet-50 text-violet-300 hover:bg-violet-100'
        }`}>
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </div>
        <span className="text-xs text-gray-500">收藏</span>
      </button>
    </div>
  );

  const ChatArea = () => (
    <div className="flex-1 min-h-0 bg-white/80 backdrop-blur-sm rounded-t-3xl p-4 overflow-hidden flex flex-col shadow-[0_-4px_20px_rgba(207,190,254,0.05)]">
      <div className="flex items-center gap-2 mb-4">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-violet-100"
          style={{ background: selectedCharacter?.avatar.startsWith('#') ? selectedCharacter.avatar : '#c5b4fc' }}
        >
          {selectedCharacter?.avatar.startsWith('#') && selectedCharacter.name[0]}
        </div>
        <span className="text-gray-800 font-medium">{selectedCharacter?.name || '观影伴侣'}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {chatMessages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">开始聊天吧</p>
          </div>
        ) : (
          chatMessages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isCompanion ? 'justify-start' : 'justify-end'}`}>
              {selectedCharacter && msg.isCompanion && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: selectedCharacter.avatar.startsWith('#') ? selectedCharacter.avatar : '#c5b4fc' }}
                >
                  {selectedCharacter.avatar.startsWith('#') && selectedCharacter.name[0]}
                </div>
              )}
              <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                msg.isCompanion
                  ? 'bg-violet-50 text-gray-700 border border-violet-100'
                  : 'bg-violet-300 text-white'
              }`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        {isAiTyping && (
          <div className="flex justify-start">
            <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 text-sm text-gray-400">
              正在输入...
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-3 border-t border-violet-100 flex-shrink-0 pb-6">
        <input
          type="text"
          value={inputMessage}
          onChange={e => setInputMessage(e.target.value)}
          placeholder="这一刻想聊点什么..."
          className="flex-1 bg-white/80 border border-violet-100 rounded-full px-4 py-2.5 text-sm outline-none focus:border-violet-200 focus:ring-1 focus:ring-violet-50"
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <button 
          onClick={handleSendMessage}
          disabled={!inputMessage.trim()}
          className="w-10 h-10 rounded-full bg-violet-300 flex items-center justify-center text-white disabled:opacity-50 hover:bg-violet-400 transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-gradient-to-br from-violet-50 via-white to-violet-50 overflow-hidden">
      {isLandscape ? (
        <div className="fixed inset-0 flex">
          <div className="w-[55%] h-full bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              src={videoSrc}
              className="max-w-full max-h-full"
              style={{ objectFit: 'contain' }}
              controls
              playsInline
              onTimeUpdate={(e) => {
                const time = e.target.currentTime;
                setCurrentTime(time);
                checkTriggers(time);
              }}
              onDurationChange={(e) => setDuration(e.target.duration)}
              onLoadedMetadata={() => {
                if (currentSession?.currentTime && videoRef.current && !seekedRef.current) {
                  videoRef.current.currentTime = currentSession.currentTime;
                  seekedRef.current = true;
                }
              }}
              onError={async () => {
                if (currentSession?.videoDbKey && videoRef.current && !videoSrc) {
                  try {
                    const blob = await loadVideoFile(currentSession.videoDbKey);
                    if (blob && videoRef.current) {
                      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                      objectUrlRef.current = URL.createObjectURL(blob);
                      videoRef.current.src = objectUrlRef.current;
                      videoRef.current.load();
                    }
                  } catch {}
                }
              }}
            />
          </div>

          <div className="w-[45%] h-full fixed right-0 top-0 flex flex-col">
            <div className="flex items-center justify-center gap-2 py-2 bg-white/80 backdrop-blur-sm border-b border-violet-100">
              <button onClick={() => setShowNotesList(true)} className="flex flex-col items-center gap-0.5 p-1.5">
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-300 hover:bg-violet-150 transition-colors">
                  <PenLine size={16} />
                </div>
                <span className="text-xs text-gray-500">笔记</span>
              </button>
              <button onClick={() => setShowCompanionSettings(true)} className="flex flex-col items-center gap-0.5 p-1.5">
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-300 hover:bg-violet-150 transition-colors">
                  <Settings size={16} />
                </div>
                <span className="text-xs text-gray-500">设置</span>
              </button>
              <button onClick={() => {
                if (!currentSession?.companionPlanId) {
                  generateMockCompanionPlan();
                } else {
                  setShowPlanModal(true);
                }
              }} className="flex flex-col items-center gap-0.5 p-1.5">
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-300 hover:bg-violet-150 transition-colors">
                  <Sparkles size={16} />
                </div>
                <span className="text-xs text-gray-500">计划</span>
              </button>
              <button onClick={() => {
                if (!currentSession?.companionPlanId) {
                  generateMockCompanionPlan();
                } else {
                  setShowTriggerList(true);
                }
              }} className="flex flex-col items-center gap-1 p-2">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-300 hover:bg-violet-150 transition-colors">
                  <List size={18} />
                </div>
                <span className="text-xs text-gray-500">星图</span>
              </button>
              <button onClick={() => setIsFavorite(!isFavorite)} className="flex flex-col items-center gap-1 p-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isFavorite ? 'bg-violet-300 text-white' : 'bg-violet-100 text-violet-300 hover:bg-violet-150'
                }`}>
                  <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                </div>
                <span className="text-xs text-gray-500">收藏</span>
              </button>
            </div>
            <div className="flex-1 bg-white/80 backdrop-blur-sm p-4 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-violet-100"
                  style={{ background: selectedCharacter?.avatar.startsWith('#') ? selectedCharacter.avatar : '#c5b4fc' }}
                >
                  {selectedCharacter?.avatar.startsWith('#') && selectedCharacter.name[0]}
                </div>
                <span className="text-gray-800 font-medium">{selectedCharacter?.name || '观影伴侣'}</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">开始聊天吧</p>
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.isCompanion ? 'justify-start' : 'justify-end'}`}>
                      {selectedCharacter && msg.isCompanion && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: selectedCharacter.avatar.startsWith('#') ? selectedCharacter.avatar : '#c5b4fc' }}
                        >
                          {selectedCharacter.avatar.startsWith('#') && selectedCharacter.name[0]}
                        </div>
                      )}
                      <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                        msg.isCompanion
                          ? 'bg-violet-50 text-gray-700 border border-violet-100'
                          : 'bg-violet-300 text-white'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                {isAiTyping && (
                  <div className="flex justify-start">
                    <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 text-sm text-gray-400">
                      正在输入...
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-3 border-t border-violet-100">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder="这一刻想聊点什么..."
                  className="flex-1 bg-white/80 border border-violet-100 rounded-full px-4 py-2.5 text-sm outline-none focus:border-violet-200 focus:ring-1 focus:ring-violet-50"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="w-10 h-10 rounded-full bg-violet-300 flex items-center justify-center text-white disabled:opacity-50 hover:bg-violet-400 transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col bg-black">
          <div className="px-4 pt-14 pb-3 flex items-center justify-between bg-white/90 backdrop-blur-sm border-b border-violet-100">
            <button onClick={() => { setIsSoloMode(false); setSelectedCharacterId(null); setCurrentSession(null); }} className="text-violet-300"><ChevronLeft size={28} /></button>
            <div className="text-center">
              <h1 className="text-lg font-medium text-gray-800">观影室</h1>
              {selectedCharacter && <p className="text-xs text-violet-300">{selectedCharacter.name} 陪你一起看</p>}
            </div>
            <button onClick={() => setShowSelectCharacter(true)} className="text-gray-400 p-2"><Users size={22} /></button>
          </div>

          <div className="flex-1 min-h-0">
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full"
              style={{ objectFit: 'contain' }}
              controls
              playsInline
              onTimeUpdate={(e) => {
                const time = e.target.currentTime;
                setCurrentTime(time);
                checkTriggers(time);
              }}
              onDurationChange={(e) => setDuration(e.target.duration)}
              onLoadedMetadata={() => {
                if (currentSession?.currentTime && videoRef.current && !seekedRef.current) {
                  videoRef.current.currentTime = currentSession.currentTime;
                  seekedRef.current = true;
                }
              }}
              onError={async () => {
                if (currentSession?.videoDbKey && videoRef.current && !videoSrc) {
                  try {
                    const blob = await loadVideoFile(currentSession.videoDbKey);
                    if (blob && videoRef.current) {
                      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                      objectUrlRef.current = URL.createObjectURL(blob);
                      videoRef.current.src = objectUrlRef.current;
                      videoRef.current.load();
                    }
                  } catch {}
                }
              }}
            />
          </div>

          <div className="bg-white/90 backdrop-blur-sm border-t border-violet-100 flex-shrink-0">
            <div className="flex items-center justify-center gap-2 py-3">
              <button onClick={() => setShowNotesList(true)} className="flex flex-col items-center gap-1 p-2">
                <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-300 hover:bg-violet-100 transition-colors">
                  <PenLine size={18} />
                </div>
                <span className="text-xs text-gray-500">笔记</span>
              </button>
              <button onClick={() => setShowCompanionSettings(true)} className="flex flex-col items-center gap-1 p-2">
                <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-300 hover:bg-violet-100 transition-colors">
                  <Settings size={18} />
                </div>
                <span className="text-xs text-gray-500">设置</span>
              </button>
              <button onClick={() => {
                if (!currentSession?.companionPlanId) {
                  generateMockCompanionPlan();
                } else {
                  setShowPlanModal(true);
                }
              }} className="flex flex-col items-center gap-1 p-2">
                <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-300 hover:bg-violet-100 transition-colors">
                  <Sparkles size={18} />
                </div>
                <span className="text-xs text-gray-500">计划</span>
              </button>
              <button onClick={() => {
                if (!currentSession?.companionPlanId) {
                  generateMockCompanionPlan();
                } else {
                  setShowTriggerList(true);
                }
              }} className="flex flex-col items-center gap-1 p-2">
                <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-300 hover:bg-violet-100 transition-colors">
                  <List size={18} />
                </div>
                <span className="text-xs text-gray-500">星图</span>
              </button>
              <button onClick={() => setIsFavorite(!isFavorite)} className="flex flex-col items-center gap-1 p-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isFavorite ? 'bg-violet-300 text-white' : 'bg-violet-50 text-violet-300 hover:bg-violet-100'
                }`}>
                  <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                </div>
                <span className="text-xs text-gray-500">收藏</span>
              </button>
            </div>

            <div className="p-4 bg-white/80 rounded-t-3xl">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-violet-100"
                  style={{ background: selectedCharacter?.avatar.startsWith('#') ? selectedCharacter.avatar : '#c5b4fc' }}
                >
                  {selectedCharacter?.avatar.startsWith('#') && selectedCharacter.name[0]}
                </div>
                <span className="text-gray-800 font-medium">{selectedCharacter?.name || '观影伴侣'}</span>
              </div>

              <div className="max-h-28 min-h-[4rem] overflow-y-auto space-y-2 mb-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-4 text-gray-400">
                    <MessageCircle size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">开始聊天吧</p>
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.isCompanion ? 'justify-start' : 'justify-end'}`}>
                      {selectedCharacter && msg.isCompanion && (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: selectedCharacter.avatar.startsWith('#') ? selectedCharacter.avatar : '#c5b4fc' }}
                        >
                          {selectedCharacter.avatar.startsWith('#') && selectedCharacter.name[0]}
                        </div>
                      )}
                      <div className={`max-w-[75%] p-2 rounded-xl text-xs ${
                        msg.isCompanion
                          ? 'bg-violet-50 text-gray-700 border border-violet-100'
                          : 'bg-violet-300 text-white'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                {isAiTyping && (
                  <div className="flex justify-start">
                    <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-xs text-gray-400">
                      正在输入...
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder="这一刻想聊点什么..."
                  className="flex-1 bg-white/80 border border-violet-100 rounded-full px-4 py-2 text-xs outline-none focus:border-violet-200 focus:ring-1 focus:ring-violet-50"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="w-9 h-9 rounded-full bg-violet-300 flex items-center justify-center text-white disabled:opacity-50 hover:bg-violet-400 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompanionSettings && (
        <div className="fixed inset-0 z-[100] bg-black/20 flex items-end">
          <div className="bg-white rounded-t-3xl w-full p-6 max-h-[80vh] overflow-y-auto shadow-[0_-4px_30px_rgba(207,190,254,0.1)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-800">陪看设置</h3>
              <button onClick={() => setShowCompanionSettings(false)} className="text-violet-300 hover:text-violet-400 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm text-gray-500 mb-3 block">互动模式</label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(MODE_LABELS) as CompanionMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setCompanionMode(mode)}
                      className={`py-3 px-4 rounded-full text-center text-sm font-medium transition-all ${
                        companionMode === mode
                          ? 'bg-violet-300 text-white shadow-md'
                          : 'bg-violet-50 text-gray-700 hover:bg-violet-100'
                      }`}
                    >
                      {MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-3 block">触发密度</label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(DENSITY_LABELS) as CompanionDensity[]).map(density => (
                    <button
                      key={density}
                      onClick={() => setCompanionDensity(density)}
                      className={`py-3 px-4 rounded-full text-center text-sm font-medium transition-all ${
                        companionDensity === density
                          ? 'bg-violet-300 text-white shadow-md'
                          : 'bg-violet-50 text-gray-700 hover:bg-violet-100'
                      }`}
                    >
                      {DENSITY_LABELS[density]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { generateMockCompanionPlan(); setShowCompanionSettings(false); }}
                className="w-full py-4 bg-violet-300 text-white rounded-full font-medium shadow-md hover:bg-violet-400 transition-colors"
              >
                生成陪看计划
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div className="fixed inset-0 z-[100] bg-black/20 flex items-end">
          <div className="bg-white rounded-t-3xl w-full p-6 shadow-[0_-4px_30px_rgba(207,190,254,0.1)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-800">陪看计划</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-violet-300 hover:text-violet-400 transition-colors">
                <X size={24} />
              </button>
            </div>

            {(() => {
              const plans = Array.isArray(watchCompanionPlans) ? watchCompanionPlans : [];
              const plan = plans.find(p => p.id === currentSession?.companionPlanId);
              if (!plan) {
                return (
                  <div className="text-center py-8 text-gray-400">
                    <Sparkles size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">还没有生成计划</p>
                    <p className="text-xs mt-1">点击设置按钮生成</p>
                  </div>
                );
              }
              return (
                <div className="space-y-4">
                  <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-violet-300 flex items-center justify-center">
                        <Sparkles size={18} className="text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{plan.movieTitle}</div>
                        <div className="text-xs text-gray-400">计划已生成</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl p-3">
                        <div className="text-xs text-gray-400 mb-1">互动模式</div>
                        <div className="text-sm font-medium text-violet-400">{MODE_LABELS[plan.mode]}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3">
                        <div className="text-xs text-gray-400 mb-1">触发密度</div>
                        <div className="text-sm font-medium text-violet-400">{DENSITY_LABELS[plan.density]}</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-violet-100">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>生成时间</span>
                        <span>{new Date(plan.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => { setShowPlanModal(false); setShowTriggerList(true); }}
                    className="w-full py-3 bg-violet-50 text-violet-400 rounded-full font-medium hover:bg-violet-100 transition-colors"
                  >
                    查看陪看点星图
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {showTriggerList && (
        <div className="fixed inset-0 z-[100] bg-black/20 flex items-end">
          <div className="bg-white rounded-t-3xl w-full p-6 max-h-[70vh] overflow-y-auto shadow-[0_-4px_30px_rgba(207,190,254,0.1)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-800">陪看点星图</h3>
              <button onClick={() => setShowTriggerList(false)} className="text-violet-300 hover:text-violet-400 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3">
              {(() => {
                const plans = Array.isArray(watchCompanionPlans) ? watchCompanionPlans : [];
                const plan = plans.find(p => p.id === currentSession?.companionPlanId);
                if (!plan || !plan.triggers.length) {
                  return (
                    <div className="text-center py-8 text-gray-400">
                      <List size={32} className="mx-auto mb-3 opacity-50" />
                      <p className="text-sm">还没有陪看点</p>
                      <p className="text-xs mt-1">点击计划按钮生成</p>
                    </div>
                  );
                }
                return plan.triggers.map((trigger, index) => (
                  <div key={trigger.id} className="bg-violet-50 rounded-2xl p-4 border border-violet-100">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-violet-400 text-sm">
                        <span>{index + 1}.</span>
                        <span className="tabular-nums">{formatTime(trigger.time)}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        trigger.consumed ? 'bg-green-100 text-green-600' : 'bg-violet-100 text-violet-400'
                      }`}>
                        {trigger.consumed ? '已触发' : '未触发'}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm">{trigger.bubble}</p>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {showNotesList && (
        <div className="fixed inset-0 z-[100] bg-black/20 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[70vh] overflow-y-auto shadow-[0_-4px_30px_rgba(207,190,254,0.1)]">
            <div className="sticky top-0 p-6 pb-4 flex items-center justify-between border-b border-violet-100 bg-white">
              <h3 className="text-lg font-medium text-gray-800">观影笔记</h3>
              <button onClick={() => setShowNotesList(false)} className="text-violet-300 hover:text-violet-400 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!currentSession.notes || currentSession.notes.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <PenLine size={40} className="mx-auto mb-3 opacity-50" />
                  <p>还没有笔记</p>
                  <p className="text-sm mt-1">点击下方按钮记录</p>
                </div>
              ) : (
                currentSession.notes.map((note, i) => (
                  <div key={i} className="bg-violet-50 rounded-xl p-4 border border-violet-100 relative">
                    <button
                      onClick={() => {
                        if (currentSession) {
                          const newNotes = currentSession.notes.filter((_, idx) => idx !== i);
                          updateMovieSession(currentSession.id, { notes: newNotes });
                          setCurrentSession(prev => prev ? { ...prev, notes: newNotes } : null);
                        }
                      }}
                      className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                    <div className="flex items-center gap-4 text-gray-400 text-xs mb-2">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-300"></span>
                        {formatTime(note.time)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        {note.createdAt ? new Date(note.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="text-gray-700">{note.text}</div>
                  </div>
                ))
              )}
              
              <button
                onClick={() => setShowNoteInput(true)}
                className="w-full py-3 bg-violet-50 text-violet-400 rounded-xl border border-violet-100 hover:bg-violet-100 transition-colors"
              >
                + 记录笔记
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoteInput && (
        <div className="fixed inset-0 z-[100] bg-black/20 flex items-end">
          <div className="bg-white rounded-t-3xl w-full p-6 shadow-[0_-4px_30px_rgba(207,190,254,0.1)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800">记录笔记</h3>
              <button onClick={() => setShowNoteInput(false)} className="text-violet-300 hover:text-violet-400 transition-colors">
                <X size={24} />
              </button>
            </div>

            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="记录此刻的想法..."
              className="w-full h-32 bg-violet-50 rounded-xl p-4 text-sm outline-none resize-none border border-violet-100 focus:border-violet-300"
              onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && handleAddNote()}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowNoteInput(false)}
                className="flex-1 py-3 bg-violet-50 text-violet-400 rounded-xl font-medium hover:bg-violet-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="flex-1 py-3 bg-violet-300 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-violet-400 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmModal}
    </div>
  );
}
