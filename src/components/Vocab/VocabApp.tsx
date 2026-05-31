import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, User, BookOpen, X, ChevronRight, CheckCircle2, History, Trash2, Sparkles, Brain, ArrowRight } from 'lucide-react';
import { generateAIResponse, sendCharacterActivityFollowup } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { Difficulty, WORDS_DB } from './wordBank';
type Mode = 'menu' | 'session' | 'summary';

// ── Design tokens (Organic / Natural) ──
const MOSS = '#5D7052';
const TERRACOTTA = '#C18C5D';
const SAND = '#E6DCCD';
const STONE = '#F0EBE5';
const BG = '#FDFCF8';
const FG = '#2C2C24';
const MUTED = '#78786C';
const BORDER = '#DED8CF';
const DESTRUCTIVE = '#A85448';

// ── Noise grain SVG data URI ──
const GRAIN_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.035'/></svg>`
)}`;

// ── Blob shape variants ──
const BLOB_SHAPES = [
  '60% 40% 30% 70% / 60% 30% 70% 40%',
  '40% 60% 70% 30% / 40% 50% 50% 60%',
  '50% 50% 20% 80% / 50% 30% 70% 50%',
  '30% 70% 50% 50% / 60% 40% 60% 40%',
];

// ── Blob background decor ──
function AmbientBlobs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Large ambient blobs */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 opacity-20"
        style={{
          background: 'radial-gradient(circle, #5D7052 0%, transparent 70%)',
          borderRadius: BLOB_SHAPES[0],
          filter: 'blur(60px)',
          transform: 'rotate(-12deg)',
        }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-80 h-80 opacity-15"
        style={{
          background: 'radial-gradient(circle, #C18C5D 0%, transparent 70%)',
          borderRadius: BLOB_SHAPES[1],
          filter: 'blur(60px)',
          transform: 'rotate(8deg)',
        }}
      />
      <div
        className="absolute top-1/3 -right-10 w-48 h-48 opacity-10"
        style={{
          background: 'radial-gradient(circle, #E6DCCD 0%, transparent 70%)',
          borderRadius: BLOB_SHAPES[2],
          filter: 'blur(50px)',
        }}
      />
    </div>
  );
}

// ── Grain overlay ──
function GrainOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `url("${GRAIN_DATA_URL}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        mixBlendMode: 'multiply',
        opacity: 0.8,
      }}
      aria-hidden="true"
    />
  );
}

// ── Shared page wrapper ──
function OrganicPage({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`h-full flex flex-col relative overflow-hidden ${className}`}
      style={{ backgroundColor: BG, color: FG }}
    >
      <AmbientBlobs />
      <GrainOverlay />
      <div className="relative z-10 flex flex-col h-full">{children}</div>
    </div>
  );
}

// ── Ornamental heading ──
function OrganicTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h1
      className={`font-['Fraunces'] tracking-tight ${className}`}
      style={{ fontVariationSettings: '"SOFT" 80, "wght" 600' }}
    >
      {children}
    </h1>
  );
}

function OrganicHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={`font-['Fraunces'] tracking-tight ${className}`}
      style={{ fontVariationSettings: '"SOFT" 70, "wght" 600' }}
    >
      {children}
    </h2>
  );
}

// ── Primary pill button ──
function MossButton({ children, onClick, className = '', disabled = false }: {
  children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full font-['Nunito'] font-bold text-lg transition-all duration-300
        active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        backgroundColor: MOSS,
        color: '#F3F4F1',
        padding: '16px 24px',
        boxShadow: '0 4px 20px -2px rgba(93,112,82,0.2)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 6px 28px -4px rgba(93,112,82,0.3)';
        e.currentTarget.style.transform = 'scale(1.02)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(93,112,82,0.2)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </button>
  );
}

// ── Outline pill button ──
function ClayButton({ children, onClick, className = '' }: {
  children: React.ReactNode; onClick?: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-full font-['Nunito'] font-bold text-lg transition-all duration-300
        active:scale-95 ${className}`}
      style={{
        backgroundColor: 'transparent',
        color: TERRACOTTA,
        border: `2px solid ${TERRACOTTA}`,
        padding: '14px 24px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'rgba(193,140,93,0.08)';
        e.currentTarget.style.transform = 'scale(1.02)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </button>
  );
}

// ── Generate quiz options ──
const generateOptions = (correctWord: {word: string, meaning: string}, allWords: {word: string, meaning: string}[]) => {
   const wrongWords = allWords.filter(w => w.word !== correctWord.word).sort(() => 0.5 - Math.random()).slice(0, 3);
   const options = [correctWord.meaning, ...wrongWords.map(w => w.meaning)].sort(() => 0.5 - Math.random());
   while(options.length < 4) options.push("干扰选项");
   return options;
};

type SessionWord = {
  word: string;
  meaning: string;
  level: number;
  options: string[];
};

export default function VocabApp() {
  const { characters, settings, updateSettings, addActivityLog } = useAppStore();
  const difficulty = (settings.vocabDifficulty || 'cet4') as Difficulty;
  const companionId = settings.vocabCompanionId || '';

  const [mode, setMode] = useState<Mode>('menu');
  const [showSettings, setShowSettings] = useState(false);

  const [sessionQueue, setSessionQueue] = useState<SessionWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isAiThinking, setIsAiThinking] = useState(false);
  const [feedbackState, setFeedbackState] = useState<{show: boolean, aiMessage?: string, correctMeaning: string} | null>(null);
  const [summaryText, setSummaryText] = useState('');

  const [wrongWordsInSession, setWrongWordsInSession] = useState<{word:string, meaning:string}[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [sessionStartTime, setSessionStartTime] = useState(0);
  const wrongBook = useMemo(() => settings.vocabWrongBook || [], [settings.vocabWrongBook]);

  const startGame = (type: 'learn' | 'review') => {
    const db = WORDS_DB[difficulty] || WORDS_DB.cet4;
    const reviewPool = type === 'review'
      ? [
          ...wrongBook.filter(w => w.difficulty === difficulty).map(w => ({ word: w.word, meaning: w.meaning })),
          ...db
        ]
      : db;
    const count = Math.min(type === 'learn' ? 30 : 24, reviewPool.length);
    const shuffled = [...reviewPool].sort(() => 0.5 - Math.random()).slice(0, count);
    const newQueue = shuffled.map(item => ({
      ...item,
      level: type === 'learn' ? 0 : 1,
      options: generateOptions(item, db)
    }));

    setSessionQueue(newQueue);
    setCurrentIndex(0);
    setFeedbackState(null);
    setSummaryText('');
    setWrongWordsInSession([]);
    setSessionStartTime(Date.now());
    setMode('session');
    setShowSettings(false);
    setShowHistory(false);
  };

  const advanceToNext = (queue: SessionWord[]) => {
    let nextIdx = (currentIndex + 1) % queue.length;
    let loopCount = 0;
    while (queue[nextIdx].level === 2 && loopCount < queue.length) {
       nextIdx = (nextIdx + 1) % queue.length;
       loopCount++;
    }

    if (loopCount >= queue.length) {
       finishSession();
    } else {
       setCurrentIndex(nextIdx);
    }
  };

  const handleLevel0Continue = () => {
     const newQueue = [...sessionQueue];
     newQueue[currentIndex].level = 1;
     setSessionQueue(newQueue);
     advanceToNext(newQueue);
  };

  const handleOptionClick = async (selected: string) => {
     const currentCard = sessionQueue[currentIndex];
     const db = WORDS_DB[difficulty] || WORDS_DB.cet4;

     if (selected === currentCard.meaning) {
        const newQueue = [...sessionQueue];
        newQueue[currentIndex].level = 2;
        setSessionQueue(newQueue);
        advanceToNext(newQueue);
     } else {
        const newQueue = [...sessionQueue];
        newQueue[currentIndex].level = 0;
        newQueue[currentIndex].options = generateOptions(currentCard, db);
        setSessionQueue(newQueue);

        if (!wrongWordsInSession.find(w => w.word === currentCard.word)) {
          setWrongWordsInSession(prev => [...prev, { word: currentCard.word, meaning: currentCard.meaning }]);
        }
        const existingWrongBook = settings.vocabWrongBook || [];
        const existed = existingWrongBook.find(w => w.word === currentCard.word && w.difficulty === difficulty);
        const nextWrongBook = existed
          ? existingWrongBook.map(w => w.word === currentCard.word && w.difficulty === difficulty ? { ...w, wrongCount: w.wrongCount + 1, updatedAt: Date.now() } : w)
          : [{ word: currentCard.word, meaning: currentCard.meaning, difficulty, wrongCount: 1, updatedAt: Date.now() }, ...existingWrongBook];
        updateSettings({ vocabWrongBook: nextWrongBook });
        addActivityLog({
          id: `${Date.now()}_${currentCard.word}`,
          title: `错词 ${currentCard.word}`,
          detail: `${formatDifficultyTitle(difficulty)} 错了 ${currentCard.word}：${currentCard.meaning}`,
          timestamp: Date.now(),
          relatedCharacterIds: companionId ? [companionId] : undefined
        });

        if (companionId && characters[companionId]) {
           setFeedbackState({ show: true, correctMeaning: currentCard.meaning });
           setIsAiThinking(true);
           const char = characters[companionId];
           const prompt = `我在背单词时把英文单词 "${currentCard.word}" 认错了（正确意思是 ${currentCard.meaning}）。请以DC ${char.name} 的口吻，结合你的性格（${char.personality}），给我三十字以内的锐评、提示或鼓励。`;
           try {
             const res = await generateAIResponse(prompt);
             setFeedbackState({ show: true, correctMeaning: currentCard.meaning, aiMessage: res });
             saveInteractionMemory(companionId, `${char?.name}在我背错单词${currentCard.word}时给了我反馈`);
             useAppStore.getState().addEmotionEvent({ characterId: companionId, paDelta: -0.02, naDelta: 0.05, word: '耐心', valence: 0.1, arousal: 0.15, matchSource: 'free_form', source: 'manual' });
           } catch(e) {
             setFeedbackState({ show: true, correctMeaning: currentCard.meaning, aiMessage: `${char.name} 盯着你，什么也没说。` });
           }
           setIsAiThinking(false);
        } else {
           advanceToNext(newQueue);
        }
     }
  };

  const dismissFeedback = () => {
      setFeedbackState(null);
      advanceToNext(sessionQueue);
  };

  const finishSession = async () => {
    setMode('summary');
    let finalSummary = '做得好，继续保持。';
    const durationSeconds = Math.max(1, Math.floor((Date.now() - sessionStartTime) / 1000));
    if (companionId && characters[companionId]) {
      setIsAiThinking(true);
      const char = characters[companionId];
      const wrongsStr = wrongWordsInSession.length > 0 ? `我拼错了这几个词: ${wrongWordsInSession.map(w => w.word).join(', ')}。` : '我一个都没错！全对！';
      const prompt = `我已经完成了本组${sessionQueue.length}个单词的背诵。${wrongsStr}请以DC ${char.name} 的口吻，给我一段50字以内的总结和鼓励。`;
      try {
        const res = await generateAIResponse(prompt);
        finalSummary = res;
        setSummaryText(res);
        saveInteractionMemory(companionId, `${char?.name}为我的单词背诵做了总结`, wrongsStr);
        useAppStore.getState().addEmotionEvent({ characterId: companionId, paDelta: 0.1, naDelta: -0.03, word: '鼓励', valence: 0.3, arousal: 0.25, matchSource: 'free_form', source: 'manual' });
      } catch (e) {
        setSummaryText(finalSummary);
      }
      setIsAiThinking(false);
    } else {
      setSummaryText(finalSummary);
    }

    const currentState = useAppStore.getState();
    const record = {
      id: Date.now().toString(),
      date: Date.now(),
      wordCount: sessionQueue.length,
      wrongWords: wrongWordsInSession,
      summary: finalSummary,
      difficulty,
      durationSeconds
    };
    currentState.updateSettings({ vocabHistory: [record, ...(currentState.settings.vocabHistory || [])] });
    if (companionId) {
      sendCharacterActivityFollowup(
        companionId,
        `我刚刚结束了一次${formatDifficultyTitle(difficulty)}的背词，一共背了${sessionQueue.length}个词，错了${wrongWordsInSession.length}个。请基于这次背词结果主动来和我聊一句。`
      );
    }
  };

  const formatDifficultyTitle = (diff: string) => {
    switch(diff) {
      case 'cet4': return '四级 CET-4';
      case 'cet6': return '六级 CET-6';
      case 'ielts': return '雅思 IELTS';
      default: return diff;
    }
  };

  // ─────────────────── SETTINGS ───────────────────
  if (showSettings) {
    return (
      <OrganicPage>
        <div className="flex-none px-5 pt-14 pb-4 flex items-center justify-between">
          <OrganicTitle className="text-2xl">偏好</OrganicTitle>
          <button
            onClick={() => setShowSettings(false)}
            className="rounded-full px-5 py-2 font-['Nunito'] font-bold text-sm transition-all duration-300 active:scale-95"
            style={{ backgroundColor: MOSS, color: '#F3F4F1' }}
          >
            完成
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-10 pb-8">
          {/* ── Word book ── */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <BookOpen size={18} style={{ color: MOSS }} />
              <span className="font-['Nunito'] text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>选择词书</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'cet4', label: '四级', desc: 'CET-4' },
                { id: 'cet6', label: '六级', desc: 'CET-6' },
                { id: 'ielts', label: '雅思', desc: 'IELTS' }
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => updateSettings({ vocabDifficulty: d.id as Difficulty })}
                  className="rounded-[2rem] p-5 text-left transition-all duration-300 active:scale-95"
                  style={{
                    backgroundColor: difficulty === d.id ? MOSS : '#FEFEFA',
                    color: difficulty === d.id ? '#F3F4F1' : FG,
                    border: `1.5px solid ${difficulty === d.id ? MOSS : BORDER}40`,
                    boxShadow: difficulty === d.id ? '0 4px 16px -2px rgba(93,112,82,0.2)' : 'none',
                  }}
                >
                  <div className="font-['Fraunces'] text-lg mb-0.5" style={{ fontVariationSettings: '"SOFT" 60, "wght" 600' }}>{d.label}</div>
                  <div className="font-['Nunito'] text-xs opacity-65">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Companion ── */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Brain size={18} style={{ color: TERRACOTTA }} />
              <span className="font-['Nunito'] text-xs font-bold tracking-widest uppercase" style={{ color: MUTED }}>陪伴角色</span>
            </div>
            <div className="space-y-2.5">
              <div
                onClick={() => updateSettings({ vocabCompanionId: '' })}
                className="rounded-[2rem] p-4 flex items-center gap-4 cursor-pointer transition-all duration-300 active:scale-[0.98]"
                style={{
                  backgroundColor: companionId === '' ? '#FEFEFA' : 'transparent',
                  border: `1.5px solid ${companionId === '' ? MOSS : BORDER}40`,
                  boxShadow: companionId === '' ? '0 4px 16px -2px rgba(93,112,82,0.1)' : 'none',
                }}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: STONE }}>
                  <X size={20} style={{ color: MUTED }} />
                </div>
                <div className="flex-1">
                  <div className="font-['Nunito'] font-bold text-base" style={{ color: FG }}>无伴学</div>
                  <div className="font-['Nunito'] text-sm" style={{ color: MUTED }}>安静无打扰模式</div>
                </div>
              </div>

              {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(char => (
                <div
                  key={char.id}
                  onClick={() => updateSettings({ vocabCompanionId: char.id })}
                  className="rounded-[2rem] p-4 flex items-center gap-4 cursor-pointer transition-all duration-300 active:scale-[0.98]"
                  style={{
                    backgroundColor: companionId === char.id ? '#FEFEFA' : 'transparent',
                    border: `1.5px solid ${companionId === char.id ? MOSS : BORDER}40`,
                    boxShadow: companionId === char.id ? '0 4px 16px -2px rgba(93,112,82,0.1)' : 'none',
                  }}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: STONE, border: `1px solid ${BORDER}` }}>
                    {char.avatar.startsWith('#') ? <User style={{ color: MUTED }} size={18} /> : <img src={char.avatar} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-['Nunito'] font-bold text-base truncate" style={{ color: FG }}>{char.name}</div>
                    <div className="font-['Nunito'] text-sm truncate" style={{ color: MUTED }}>{char.relationship}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </OrganicPage>
    );
  }

  // ─────────────────── SESSION ───────────────────
  if (mode === 'session') {
    const currentCard = sessionQueue[currentIndex];
    const completedCount = sessionQueue.filter(q => q.level === 2).length;

    return (
      <OrganicPage>
        {/* Header */}
        <div className="flex-none px-5 pt-14 pb-2 flex items-center justify-between">
          <button onClick={() => setMode('menu')} className="w-10 h-10 flex items-center justify-center -ml-2 transition-opacity active:opacity-60" style={{ color: MUTED }}>
            <X size={22} />
          </button>
          {/* Progress */}
          <div
            className="rounded-full h-2 flex-1 mx-4 overflow-hidden"
            style={{ backgroundColor: STONE }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${(completedCount / Math.max(1, sessionQueue.length)) * 100}%`,
                backgroundColor: MOSS,
              }}
            />
          </div>
          {/* Companion avatar */}
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: STONE, border: `1.5px solid ${BORDER}60` }}>
            {companionId && characters[companionId] && !characters[companionId].avatar.startsWith('#')
              ? <img src={characters[companionId].avatar} className="w-full h-full object-cover" alt="" />
              : <User size={16} style={{ color: MUTED }} />
            }
          </div>
        </div>

        {/* Word card */}
        <div className="flex-1 flex flex-col px-5 pt-4 pb-2">
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto">
            {/* Word display */}
            <div
              className="w-full rounded-[2rem] p-8 mb-6 text-center transition-all duration-500"
              style={{
                backgroundColor: '#FEFEFA',
                border: `1px solid ${BORDER}50`,
                boxShadow: '0 4px 20px -2px rgba(93,112,82,0.08)',
              }}
            >
              <h2
                className="text-4xl md:text-5xl font-['Fraunces'] text-center leading-tight break-words w-full"
                style={{ fontVariationSettings: '"SOFT" 60, "wght" 600', color: FG }}
              >
                {currentCard?.word}
              </h2>
            </div>

            {/* Meaning reveal / Options */}
            {currentCard?.level === 0 ? (
              <div className="w-full flex flex-col items-center animate-fade-in">
                <div
                  className="rounded-[2rem] px-6 py-4 mb-6 w-full text-center"
                  style={{
                    backgroundColor: `${SAND}60`,
                    border: `1px solid ${BORDER}50`,
                  }}
                >
                  <span className="font-['Nunito'] text-xl font-medium" style={{ color: FG }}>{currentCard?.meaning}</span>
                </div>
                <button
                  onClick={handleLevel0Continue}
                  className="rounded-full font-['Nunito'] font-bold text-lg transition-all duration-300 active:scale-95 flex items-center gap-2 px-8"
                  style={{
                    backgroundColor: MOSS,
                    color: '#F3F4F1',
                    padding: '14px 32px',
                    boxShadow: '0 4px 20px -2px rgba(93,112,82,0.2)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 6px 28px -4px rgba(93,112,82,0.3)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(93,112,82,0.2)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  记住了 <ArrowRight size={18} />
                </button>
              </div>
            ) : currentCard?.level === 1 ? (
              <div className="w-full space-y-3 animate-fade-in">
                {(currentCard?.options || []).map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionClick(opt)}
                    className="w-full text-left rounded-full px-6 py-3.5 font-['Nunito'] font-medium transition-all duration-200 active:scale-[0.98]"
                    style={{
                      backgroundColor: STONE,
                      color: FG,
                      border: `1px solid ${BORDER}50`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#FEFEFA';
                      e.currentTarget.style.borderColor = `${MOSS}40`;
                      e.currentTarget.style.boxShadow = '0 2px 12px -2px rgba(93,112,82,0.1)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = STONE;
                      e.currentTarget.style.borderColor = `${BORDER}50`;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Counter */}
          <div className="flex-none text-center py-4 font-['Nunito'] text-sm font-semibold" style={{ color: MUTED }}>
            <span className="font-['Fraunces'] text-base" style={{ fontVariationSettings: '"SOFT" 50, "wght" 500', color: MOSS }}>{completedCount}</span>
            <span style={{ color: `${MUTED}80` }}> / {sessionQueue.length}</span>
          </div>
        </div>

        {/* Feedback Overlay */}
        {feedbackState && feedbackState.show && (
          <div className="absolute inset-x-0 bottom-0 top-0 z-40 flex flex-col justify-end animate-fade-in" style={{ backgroundColor: `${FG}66` }}>
            <div
              className="rounded-t-[2.5rem] p-6 pb-10 flex flex-col animate-slide-up"
              style={{ backgroundColor: BG }}
            >
              <div className="font-['Nunito'] text-xs font-bold tracking-widest uppercase mb-1" style={{ color: DESTRUCTIVE }}>正确释义</div>
              <div
                className="text-2xl mb-5 font-['Fraunces']"
                style={{ fontVariationSettings: '"SOFT" 60, "wght" 600', color: FG }}
              >
                {feedbackState.correctMeaning}
              </div>

              {companionId && characters[companionId] && (
                <div
                  className="rounded-[2rem] p-4 flex items-start gap-4 mb-6"
                  style={{ backgroundColor: STONE, border: `1px solid ${BORDER}50` }}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: SAND }}>
                    {!characters[companionId].avatar.startsWith('#') && <img src={characters[companionId].avatar} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="flex-1 mt-1">
                    <div className="font-['Nunito'] font-bold text-sm mb-1" style={{ color: FG }}>{characters[companionId].name}</div>
                    <div className="font-['Nunito'] text-sm leading-relaxed" style={{ color: MUTED }}>
                      {isAiThinking ? <span className="animate-pulse">正在输入...</span> : feedbackState.aiMessage}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={dismissFeedback}
                className="w-full rounded-full font-['Nunito'] font-bold text-lg transition-all duration-300 active:scale-95"
                style={{
                  backgroundColor: MOSS,
                  color: '#F3F4F1',
                  padding: '14px 24px',
                  boxShadow: '0 4px 20px -2px rgba(93,112,82,0.2)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 6px 28px -4px rgba(93,112,82,0.3)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(93,112,82,0.2)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                继续
              </button>
            </div>
          </div>
        )}
      </OrganicPage>
    );
  }

  // ─────────────────── SUMMARY ───────────────────
  if (mode === 'summary') {
    return (
      <OrganicPage>
        <div className="flex-none px-5 pt-14 flex justify-end">
          <button onClick={() => setMode('menu')} className="w-10 h-10 flex items-center justify-center transition-opacity active:opacity-60" style={{ color: MUTED }}>
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: `${MOSS}20` }}
          >
            <CheckCircle2 size={40} style={{ color: MOSS }} />
          </div>
          <OrganicTitle className="text-3xl mb-2">复习完成</OrganicTitle>
          <p className="font-['Nunito'] font-medium mb-3" style={{ color: MUTED }}>
            成功搞定 {sessionQueue.length} 个单词
          </p>
          <div className="font-['Nunito'] text-sm mb-8" style={{ color: `${MUTED}99` }}>
            {formatDifficultyTitle(difficulty)} · 用时 {Math.max(1, Math.floor((Date.now() - sessionStartTime) / 1000))} 秒
          </div>

          {(summaryText || isAiThinking) && companionId && characters[companionId] && (
            <div
              className="rounded-[2rem] p-6 w-full max-w-sm text-left"
              style={{
                backgroundColor: '#FEFEFA',
                border: `1px solid ${BORDER}50`,
                boxShadow: '0 4px 20px -2px rgba(93,112,82,0.08)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden" style={{ backgroundColor: STONE }}>
                  {!characters[companionId].avatar.startsWith('#') && <img src={characters[companionId].avatar} className="w-full h-full object-cover" alt="" />}
                </div>
                <div className="font-['Nunito'] font-bold text-sm" style={{ color: FG }}>{characters[companionId].name}</div>
              </div>
              <div className="font-['Nunito'] text-sm leading-relaxed" style={{ color: MUTED }}>
                {isAiThinking ? '...' : summaryText}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-8 pt-4">
          <MossButton onClick={() => setMode('menu')}>完成</MossButton>
        </div>
      </OrganicPage>
    );
  }

  // ─────────────────── HISTORY ───────────────────
  if (showHistory) {
    return (
      <OrganicPage>
        <div className="flex-none px-5 pt-14 flex items-center justify-between pb-4">
          <button onClick={() => setShowHistory(false)} className="w-10 h-10 flex items-center transition-opacity active:opacity-60 -ml-2" style={{ color: MUTED }}>
            <ChevronLeft size={26} />
          </button>
          <OrganicTitle className="text-xl">学习记录</OrganicTitle>
          <div className="w-10" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
          {wrongBook.length > 0 && (
            <div
              className="rounded-[2rem] p-5"
              style={{
                backgroundColor: `${TERRACOTTA}10`,
                border: `1px solid ${TERRACOTTA}30`,
              }}
            >
              <div className="font-['Fraunces'] text-base mb-3" style={{ fontVariationSettings: '"SOFT" 60, "wght" 600', color: TERRACOTTA }}>我的错词本</div>
              <div className="flex flex-wrap gap-2">
                {wrongBook.map(record => (
                  <button
                    key={`${record.difficulty}_${record.word}`}
                    onClick={() => {
                      const nextWrongBook = wrongBook.filter(item => !(item.word === record.word && item.difficulty === record.difficulty));
                      updateSettings({ vocabWrongBook: nextWrongBook });
                    }}
                    className="rounded-full px-3.5 py-1.5 font-['Nunito'] text-xs font-bold transition-all active:scale-95"
                    style={{
                      backgroundColor: '#FEFEFA',
                      border: `1px solid ${TERRACOTTA}40`,
                      color: TERRACOTTA,
                    }}
                  >
                    {record.word} · {formatDifficultyTitle(record.difficulty)} · ×{record.wrongCount}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(!settings.vocabHistory || settings.vocabHistory.length === 0) ? (
            <div className="text-center mt-20 font-['Nunito'] font-medium" style={{ color: MUTED }}>暂无背词记录</div>
          ) : (
            settings.vocabHistory.map((record: any) => (
              <div
                key={record.id}
                className="rounded-[2rem] p-5 relative transition-all duration-300"
                style={{
                  backgroundColor: '#FEFEFA',
                  border: `1px solid ${BORDER}50`,
                  boxShadow: '0 2px 12px -2px rgba(93,112,82,0.06)',
                }}
              >
                <button
                  onClick={() => {
                    const newHistory = settings.vocabHistory?.filter((r: any) => r.id !== record.id);
                    updateSettings({ vocabHistory: newHistory });
                  }}
                  className="absolute top-4 right-4 transition-colors"
                  style={{ color: `${MUTED}80` }}
                  onMouseEnter={e => { e.currentTarget.style.color = DESTRUCTIVE; }}
                  onMouseLeave={e => { e.currentTarget.style.color = `${MUTED}80`; }}
                >
                  <Trash2 size={16} />
                </button>
                <div className="font-['Nunito'] text-xs font-bold mb-2" style={{ color: `${MUTED}99` }}>{new Date(record.date).toLocaleString()}</div>
                <div className="font-['Nunito'] font-bold mb-1" style={{ color: FG }}>学了 {record.wordCount} 个词，错了 {record.wrongWords.length} 个词</div>
                <div className="font-['Nunito'] text-xs mb-3" style={{ color: MUTED }}>{formatDifficultyTitle(record.difficulty || difficulty)} · 用时 {record.durationSeconds || 0} 秒</div>
                {record.wrongWords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {record.wrongWords.map((w: any) => (
                      <span
                        key={w.word}
                        className="rounded-full px-2.5 py-0.5 font-['Nunito'] text-xs font-bold"
                        style={{ backgroundColor: `${DESTRUCTIVE}15`, color: DESTRUCTIVE }}
                      >
                        {w.word}
                      </span>
                    ))}
                  </div>
                )}
                {record.summary && (
                  <div
                    className="font-['Nunito'] text-sm leading-relaxed rounded-xl p-3"
                    style={{
                      backgroundColor: BG,
                      border: `1px solid ${BORDER}40`,
                      color: MUTED,
                    }}
                  >
                    {record.summary}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </OrganicPage>
    );
  }

  // ─────────────────── MENU ───────────────────
  return (
    <OrganicPage>
      {/* Top bar */}
      <div className="flex-none px-5 pt-14 pb-2">
        <div className="flex items-center justify-between">
          <OrganicTitle className="text-3xl">单词</OrganicTitle>
          <button
            onClick={() => setShowHistory(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90"
            style={{ backgroundColor: STONE, color: MUTED }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = SAND; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = STONE; }}
          >
            <History size={18} />
          </button>
        </div>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        {/* Logo / Brand */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ backgroundColor: `${MOSS}15` }}
        >
          <BookOpen size={32} style={{ color: MOSS }} />
        </div>

        <OrganicTitle className="text-5xl mb-2">Vocab</OrganicTitle>

        {/* Word count */}
        <div
          className="rounded-full px-4 py-1.5 font-['Nunito'] text-xs font-semibold mb-6"
          style={{ backgroundColor: STONE, color: MUTED }}
        >
          {(WORDS_DB[difficulty] || []).length} 词 · {formatDifficultyTitle(difficulty)}
        </div>

        {/* Difficulty + Companion pill */}
        <button
          onClick={() => setShowSettings(true)}
          className="rounded-full inline-flex items-center gap-2 px-5 py-2.5 font-['Nunito'] text-sm font-bold transition-all duration-300 active:scale-95 mb-12"
          style={{
            backgroundColor: '#FEFEFA',
            border: `1px solid ${BORDER}50`,
            color: MUTED,
            boxShadow: '0 2px 8px -2px rgba(93,112,82,0.06)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = `${MOSS}30`;
            e.currentTarget.style.boxShadow = '0 4px 16px -2px rgba(93,112,82,0.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = `${BORDER}50`;
            e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(93,112,82,0.06)';
          }}
        >
          {formatDifficultyTitle(difficulty)}
          <span style={{ color: `${MUTED}40` }}>·</span>
          {companionId && characters[companionId] ? (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full overflow-hidden inline-block align-middle" style={{ backgroundColor: STONE }}>
                {!characters[companionId].avatar.startsWith('#') && <img src={characters[companionId].avatar} className="w-full h-full object-cover" alt="" />}
              </span>
              {characters[companionId].name}
            </span>
          ) : '无伴学'}
          <ChevronRight size={14} style={{ color: `${MUTED}60` }} />
        </button>

        {/* Action buttons */}
        <div className="w-full flex flex-col gap-3 max-w-xs">
          <MossButton onClick={() => startGame('learn')}>
            <span className="flex items-center justify-center gap-2">
              <Sparkles size={18} />
              开始背词
            </span>
          </MossButton>
          <ClayButton onClick={() => startGame('review')}>
            <span className="flex items-center justify-center gap-2">
              <Brain size={18} />
              复习单词
            </span>
          </ClayButton>
        </div>
      </div>
    </OrganicPage>
  );
}
