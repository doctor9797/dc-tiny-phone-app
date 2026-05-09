import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, User, BookOpen, X, ChevronRight, CheckCircle2, History, Trash2 } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import { sendCharacterActivityFollowup } from '../../lib/ai';
import { Difficulty, WORDS_DB } from './wordBank';
type Mode = 'menu' | 'session' | 'summary';

const generateOptions = (correctWord: {word: string, meaning: string}, allWords: {word: string, meaning: string}[]) => {
   const wrongWords = allWords.filter(w => w.word !== correctWord.word).sort(() => 0.5 - Math.random()).slice(0, 3);
   const options = [correctWord.meaning, ...wrongWords.map(w => w.meaning)].sort(() => 0.5 - Math.random());
   while(options.length < 4) options.push("干扰选项");
   return options;
};

type SessionWord = {
  word: string;
  meaning: string;
  level: number; // 0: reveal meaning, 1: quiz, 2: mastered
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
        newQueue[currentIndex].level = 2; // Mastered
        setSessionQueue(newQueue);
        advanceToNext(newQueue);
     } else {
        const newQueue = [...sessionQueue];
        newQueue[currentIndex].level = 0; // Drop back to reveal
        newQueue[currentIndex].options = generateOptions(currentCard, db);
        setSessionQueue(newQueue);
        
        // Record wrong word
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

  if (showSettings) {
    return (
      <div className="h-full flex flex-col bg-white text-slate-900 pb-safe z-10">
        <div className="px-6 pt-16 flex items-center justify-between pb-6 border-b border-slate-100 shrink-0">
           <h1 className="text-2xl font-bold tracking-tight">单词偏好</h1>
           <button onClick={() => setShowSettings(false)} className="bg-slate-100 text-slate-900 px-4 py-2 rounded-full text-sm font-semibold active:opacity-70 transition-opacity">完成</button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-10">
          <div>
            <h2 className="text-sm font-bold text-slate-400 mb-4 tracking-widest uppercase">选择词书</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'cet4', label: '四级' },
                { id: 'cet6', label: '六级' },
                { id: 'ielts', label: '雅思' }
              ].map(d => (
                <button 
                  key={d.id}
                  onClick={() => updateSettings({ vocabDifficulty: d.id as Difficulty })}
                  className={`py-4 px-4 rounded-xl text-left font-bold transition-all border-2 ${difficulty === d.id ? 'border-slate-900 text-slate-900' : 'border-slate-100 text-slate-400'}`}
                >
                  <div className="text-base">{d.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-400 mb-4 tracking-widest uppercase">陪伴角色</h2>
            <div className="space-y-3">
              <div 
                onClick={() => updateSettings({ vocabCompanionId: '' })}
                className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer border-2 ${companionId === '' ? 'border-slate-900' : 'border-slate-100'}`}
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><X size={20}/></div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900 text-lg">无伴学</div>
                  <div className="text-sm text-slate-400">安静无打扰模式</div>
                </div>
              </div>
              
              {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(char => (
                <div 
                  key={char.id}
                  onClick={() => updateSettings({ vocabCompanionId: char.id })}
                  className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer border-2 ${companionId === char.id ? 'border-slate-900' : 'border-slate-100'}`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-slate-100 bg-slate-100 flex items-center justify-center">
                    {char.avatar.startsWith('#') ? <User className="text-slate-400" /> : <img src={char.avatar} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-lg truncate">{char.name}</div>
                    <div className="text-sm text-slate-400 truncate">{char.relationship}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'session') {
    const currentCard = sessionQueue[currentIndex];
    const completedCount = sessionQueue.filter(q => q.level === 2).length;
    
    return (
      <div className="flex-1 flex flex-col bg-white text-slate-900 relative overflow-hidden pb-safe">
        
        {/* Header */}
        <div className="px-6 pt-16 pb-4 flex items-center justify-between shrink-0">
           <button onClick={() => setMode('menu')} className="w-10 h-10 flex items-center justify-center -ml-2 text-slate-400 active:opacity-70"><X size={24} /></button>
           <div className="font-mono text-sm font-semibold tracking-widest text-slate-400">
             {completedCount} <span className="opacity-50">/</span> {sessionQueue.length}
           </div>
           <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center shrink-0">
             {companionId && characters[companionId] && !characters[companionId].avatar.startsWith('#') 
               ? <img src={characters[companionId].avatar} className="w-full h-full object-cover" alt="" />
               : <User size={18} className="text-slate-300" />
             }
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-6 pt-10">
          
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto">
            <h2 className="text-4xl md:text-5xl border-slate-900 font-bold mb-8 text-center leading-tight tracking-tight break-words w-full">
              {currentCard?.word}
            </h2>

            {currentCard?.level === 0 ? (
               <div className="w-full flex justify-center animate-fade-in">
                  <div className="text-xl text-slate-500 font-medium text-center">{currentCard?.meaning}</div>
               </div>
            ) : currentCard?.level === 1 ? (
               <div className="w-full space-y-3 animate-fade-in">
                  {currentCard?.options.map((opt, i) => (
                     <button
                        key={i}
                        onClick={() => handleOptionClick(opt)}
                        className="w-full py-4 text-center px-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium active:bg-slate-100 transition-colors"
                     >
                       {opt}
                     </button>
                  ))}
               </div>
            ) : null}
          </div>

          <div className="shrink-0 pt-8 pb-4">
             {currentCard?.level === 0 ? (
                <button 
                  onClick={handleLevel0Continue}
                  className="w-full py-4 bg-slate-900 text-white rounded-full font-bold text-lg active:opacity-80 transition-opacity"
                >
                  记住了
                </button>
             ) : (
                <div className="h-[60px]" /> /* Placeholder to avoid layout jump */
             )}
          </div>
        </div>

        {/* Feedback Overlay Bottom Sheet */}
        {feedbackState && feedbackState.show && (
           <div className="absolute inset-x-0 bottom-0 top-0 bg-slate-900/40 z-40 flex flex-col justify-end animate-fade-in">
              <div className="bg-white p-6 pb-12 rounded-t-[2rem] flex flex-col animate-slide-up">
                 
                 <div className="text-red-500 text-sm font-bold tracking-widest uppercase mb-1">正确释义</div>
                 <div className="text-2xl font-bold text-slate-900 mb-6">{feedbackState.correctMeaning}</div>
                 
                 {companionId && characters[companionId] && (
                   <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-start gap-4 mb-8">
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-slate-200">
                         {!characters[companionId].avatar.startsWith('#') && <img src={characters[companionId].avatar} className="w-full h-full object-cover" alt="" />}
                      </div>
                      <div className="flex-1 mt-1">
                        <div className="font-bold text-sm text-slate-900 mb-1">{characters[companionId].name}</div>
                        <div className="text-slate-600 leading-relaxed text-sm">
                           {isAiThinking ? <span className="animate-pulse">正在输入...</span> : feedbackState.aiMessage}
                        </div>
                      </div>
                   </div>
                 )}

                 <button 
                    onClick={dismissFeedback} 
                    className="w-full py-4 bg-slate-900 text-white rounded-full font-bold text-lg active:opacity-80 transition-opacity"
                 >
                    继续
                 </button>
              </div>
           </div>
        )}
      </div>
    );
  }

  if (mode === 'summary') {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 text-slate-900 relative pb-safe">
        <div className="px-6 pt-16 flex justify-between">
           <div className="w-8"></div>
           <button onClick={() => setMode('menu')} className="w-10 h-10 flex items-center justify-center text-slate-400 active:opacity-70"><X size={24} /></button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">复习完成</h2>
          <p className="text-slate-500 font-medium mb-12">成功搞定 {sessionQueue.length} 个单词</p>
          <div className="text-sm text-slate-400 mb-6">本次词书：{formatDifficultyTitle(difficulty)} · 用时 {Math.max(1, Math.floor((Date.now() - sessionStartTime) / 1000))} 秒</div>

          {(summaryText || isAiThinking) && companionId && characters[companionId] && (
             <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-sm text-left shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100">
                     {!characters[companionId].avatar.startsWith('#') && <img src={characters[companionId].avatar} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="font-bold text-sm text-slate-900">{characters[companionId].name}</div>
                </div>
                <div className="text-slate-600 text-sm leading-relaxed">
                  {isAiThinking ? '...' : summaryText}
                </div>
             </div>
          )}
        </div>

        <div className="p-6">
           <button 
              onClick={() => setMode('menu')} 
              className="w-full py-4 bg-slate-900 text-white rounded-full font-bold text-lg active:opacity-80 transition-opacity"
           >
              完成
           </button>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="flex-1 flex flex-col bg-white text-slate-900 pb-safe relative">
         <div className="flex-none px-6 pt-16 flex items-center justify-between pb-4 border-b border-slate-100">
           <button onClick={() => setShowHistory(false)} className="w-10 h-10 flex items-center text-slate-400 active:opacity-70 -ml-2"><ChevronLeft size={28} /></button>
           <h1 className="text-xl font-bold tracking-tight">学习记录</h1>
           <div className="w-10"></div>
         </div>
         <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {wrongBook.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                <div className="font-bold mb-3">我的错词本</div>
                <div className="flex flex-wrap gap-2">
                  {wrongBook.map(record => (
                    <button
                      key={`${record.difficulty}_${record.word}`}
                      onClick={() => {
                        const nextWrongBook = wrongBook.filter(item => !(item.word === record.word && item.difficulty === record.difficulty));
                        updateSettings({ vocabWrongBook: nextWrongBook });
                      }}
                      className="px-3 py-2 rounded-full bg-white border border-amber-200 text-amber-700 text-xs font-bold"
                    >
                      {record.word} · {formatDifficultyTitle(record.difficulty)} · ×{record.wrongCount}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(!settings.vocabHistory || settings.vocabHistory.length === 0) ? (
              <div className="text-slate-400 text-center mt-20 font-medium">暂无背词记录</div>
            ) : (
              settings.vocabHistory.map((record: any) => (
                <div key={record.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 relative">
                  <button 
                    onClick={() => {
                        const newHistory = settings.vocabHistory?.filter((r: any) => r.id !== record.id);
                        updateSettings({ vocabHistory: newHistory });
                    }}
                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="text-xs font-bold text-slate-400 mb-2">{new Date(record.date).toLocaleString()}</div>
                  <div className="font-bold mb-2">学了 {record.wordCount} 个词，错了 {record.wrongWords.length} 个词</div>
                  <div className="text-xs text-slate-500 mb-3">{formatDifficultyTitle(record.difficulty || difficulty)} · 用时 {record.durationSeconds || 0} 秒</div>
                  {record.wrongWords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {record.wrongWords.map((w: any) => (
                        <span key={w.word} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold">{w.word}</span>
                      ))}
                    </div>
                  )}
                  {record.summary && (
                    <div className="text-sm text-slate-600 bg-white p-3 border border-slate-100 rounded-xl">
                      {record.summary}
                    </div>
                  )}
                </div>
              ))
            )}
         </div>
      </div>
    );
  }

  // mode === 'menu'
  return (
    <div className="flex-1 flex flex-col bg-white text-slate-900 pb-safe">
      {/* Header can stay at top, but make sure flex-1 is fully centered */}
      <div className="flex-none px-6 pt-16 pb-2">
        <div className="flex items-center justify-between">
           <h1 className="text-2xl font-bold tracking-tight">单词</h1>
           <button onClick={() => setShowHistory(true)} className="text-slate-500 active:opacity-70"><History size={24} /></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 items-center justify-center pb-24">
         <div className="text-center mb-10 w-full flex flex-col items-center">
            <h2 className="text-5xl font-bold tracking-tight mb-4">Vocab</h2>
            <button
               onClick={() => setShowSettings(true)}
               className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 rounded-full text-sm font-bold text-slate-600 active:opacity-70 transition-colors"
            >
              <BookOpen size={16} />
              {formatDifficultyTitle(difficulty)} · {companionId && characters[companionId] ? characters[companionId].name : '无伴学'} 
              <ChevronRight size={14} className="mt-0.5 opacity-50" />
            </button>
         </div>

         <div className="w-full flex flex-col gap-4 max-w-xs">
           <div className="text-center text-xs text-slate-400">当前词库：{(WORDS_DB[difficulty] || []).length} 词</div>
           <button 
             onClick={() => startGame('learn')}
             className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg active:scale-[0.98] shadow-lg shadow-slate-900/20 transition-all"
           >
             开始背词
           </button>
           <button 
             onClick={() => startGame('review')}
             className="w-full py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold text-lg active:scale-[0.98] shadow-sm transition-all hover:bg-slate-50"
           >
             复习单词
           </button>
        </div>
      </div>
    </div>
  );
}
