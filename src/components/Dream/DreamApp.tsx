import React, { useMemo } from 'react';
import { useAppStore } from '../../store';
import { getCharacterDreams } from '../../lib/dreamEngine';
import { DreamEntry } from '../../types';
import { ChevronLeft, Moon, BookOpen } from 'lucide-react';

const ARCHIVE_BG = 'bg-gradient-to-br from-amber-50 via-orange-50 to-stone-100 dark:from-stone-900 dark:via-amber-950 dark:to-stone-950';
const PAPER_CARD = 'bg-white/80 dark:bg-stone-800/60 backdrop-blur-sm border border-amber-200/50 dark:border-amber-700/30 shadow-sm';

export default function DreamApp() {
  const { characters, closeApp } = useAppStore();
  const [selectedCharId, setSelectedCharId] = React.useState<string | null>(null);
  const [viewingDream, setViewingDream] = React.useState<DreamEntry | null>(null);

  const sortedCharacters = useMemo(() =>
    Object.values(characters)
      .filter(c => (c as any).isDisabled !== true)
      .sort((a, b) => {
        const countA = (useAppStore.getState().dreams[a.id] || []).length;
        const countB = (useAppStore.getState().dreams[b.id] || []).length;
        return countB - countA;
      }),
    [characters]
  );

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // ── Dream detail page ──
  if (viewingDream) {
    const dream = viewingDream;
    return (
      <div className={`h-full flex flex-col ${ARCHIVE_BG}`}>
        <div className="flex items-center gap-3 px-4 pt-7 pb-3 border-b border-amber-200/30 dark:border-amber-700/20">
          <button onClick={() => setViewingDream(null)} className="p-1 hover:bg-amber-200/30 rounded-lg transition-colors">
            <ChevronLeft size={22} className="text-amber-700 dark:text-amber-400" />
          </button>
          <Moon size={18} className="text-amber-500 shrink-0" />
          <h2 className="font-bold text-sm text-amber-900 dark:text-amber-200 truncate">《{dream.dreamTitle}》</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Dream metadata */}
          <div className="px-5 pt-5 pb-2 flex items-center justify-between text-xs text-amber-500 dark:text-amber-600">
            <time>{formatDate(dream.createdAt)}</time>
            <div className="flex items-center gap-2">
              <span>{dream.valence > 0.6 ? '安宁' : dream.valence < 0.4 ? '暗涌' : '平静'}</span>
              <span className="text-amber-300 dark:text-amber-700">·</span>
              <span>{dream.arousal > 0.6 ? '激越' : dream.arousal < 0.3 ? '轻浅' : '和缓'}</span>
            </div>
          </div>

          {/* Dream narrative */}
          <div className="px-5 pb-8">
            <p className="text-base leading-8 text-amber-800 dark:text-amber-300 whitespace-pre-wrap indent-4">
              {dream.dreamNarrative}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Character list ──
  if (!selectedCharId) {
    return (
      <div className={`h-full flex flex-col ${ARCHIVE_BG}`}>
        <div className="flex items-center justify-between px-4 pt-7 pb-3 border-b border-amber-200/30 dark:border-amber-700/20">
          <div className="flex items-center gap-2">
            <Moon size={20} className="text-amber-600 dark:text-amber-400" />
            <h1 className="font-bold text-amber-900 dark:text-amber-200">梦境档案室</h1>
          </div>
          <button onClick={closeApp} className="p-1 hover:bg-amber-200/30 rounded-lg transition-colors">
            <ChevronLeft size={22} className="text-amber-700 dark:text-amber-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <p className="text-xs text-amber-600 dark:text-amber-500 text-center mb-4">
            选择一位角色，翻阅 ta 的梦境记录
          </p>
          {sortedCharacters.map(char => {
            const dreams = useAppStore.getState().dreams[char.id] || [];
            return (
              <button
                key={char.id}
                onClick={() => setSelectedCharId(char.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl ${PAPER_CARD} hover:scale-[1.01] active:scale-95 transition-all text-left`}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: char.avatar }}
                >
                  {char.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-amber-900 dark:text-amber-200">{char.name}</div>
                  <div className="text-xs text-amber-600 dark:text-amber-500">
                    {dreams.length > 0 ? `收录 ${dreams.length} 篇梦境` : '暂无记录'}
                  </div>
                </div>
                <BookOpen size={16} className="text-amber-400 dark:text-amber-600 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Dream archive for selected character ──
  const character = characters[selectedCharId];
  if (!character) {
    setSelectedCharId(null);
    return null;
  }

  const dreams = getCharacterDreams(selectedCharId);

  return (
    <div className={`h-full flex flex-col ${ARCHIVE_BG}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-7 pb-3 border-b border-amber-200/30 dark:border-amber-700/20">
        <button onClick={() => setSelectedCharId(null)} className="p-1 hover:bg-amber-200/30 rounded-lg transition-colors">
          <ChevronLeft size={22} className="text-amber-700 dark:text-amber-400" />
        </button>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: character.avatar }}>
          {character.name[0]}
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-sm text-amber-900 dark:text-amber-200 truncate">{character.name}</h2>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            {dreams.length > 0 ? `共 ${dreams.length} 篇梦境` : '暂无梦境记录'}
          </p>
        </div>
      </div>

      {/* Dream list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {dreams.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Moon size={40} className="text-amber-300 dark:text-amber-700 mb-3" />
            <p className="text-sm text-amber-600 dark:text-amber-500 font-medium">尚无梦境记录</p>
            <p className="text-xs text-amber-400 dark:text-amber-700 mt-1">角色会在某些深夜自动做梦</p>
          </div>
        )}

        {dreams.map(dream => (
          <button
            key={dream.id}
            onClick={() => setViewingDream(dream)}
            className={`w-full text-left ${PAPER_CARD} rounded-xl p-4 hover:scale-[1.01] active:scale-95 transition-all`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <time className="text-xs text-amber-500 dark:text-amber-600 font-medium tracking-wide">
                {formatDate(dream.createdAt)}
              </time>
              <div className="flex items-center gap-1 text-[10px] text-amber-400 dark:text-amber-600">
                <span>{dream.valence > 0.6 ? '安宁' : dream.valence < 0.4 ? '暗涌' : '平静'}</span>
                <span className="text-amber-300 dark:text-amber-700">·</span>
                <span>{dream.arousal > 0.6 ? '激越' : dream.arousal < 0.3 ? '轻浅' : '和缓'}</span>
              </div>
            </div>
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-200 leading-snug">
              《{dream.dreamTitle}》
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 italic line-clamp-2">
              {dream.condensedSummary}
            </p>
          </button>
        ))}

        <div className="h-4" />
      </div>
    </div>
  );
}
