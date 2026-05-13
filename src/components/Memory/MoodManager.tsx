import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { getDictionaryWordList, lookupEmotion, searchEmotionByVA } from '../../lib/emotionDictionary';
import { getCharacterMoodPool, MoodPoolEntry } from '../../lib/moodPool';

type Tab = 'dictionary' | 'moodpool';

export default function MoodManager() {
  const { characters } = useAppStore();
  const [tab, setTab] = useState<Tab>('dictionary');
  const [searchWord, setSearchWord] = useState('');
  const [selectedChar, setSelectedChar] = useState<string | null>(null);

  const wordList = useMemo(() => {
    const all = getDictionaryWordList();
    if (!searchWord.trim()) return all.slice(0, 100);
    const q = searchWord.toLowerCase();
    return all.filter(w => w.includes(q));
  }, [searchWord]);

  const moodPool = useMemo(() => {
    if (!selectedChar) return [];
    return getCharacterMoodPool(selectedChar);
  }, [selectedChar]);

  return (
    <div className="space-y-3">
      {/* Tab switch */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setTab('dictionary')}
          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
            tab === 'dictionary'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
              : 'bg-white/70 dark:bg-white/10 text-gray-500'
          }`}
        >
          情绪词典 ({getDictionaryWordList().length}词)
        </button>
        <button
          onClick={() => setTab('moodpool')}
          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
            tab === 'moodpool'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
              : 'bg-white/70 dark:bg-white/10 text-gray-500'
          }`}
        >
          装饰心情池
        </button>
      </div>

      {tab === 'dictionary' && (
        <div className="space-y-2">
          <input
            value={searchWord}
            onChange={e => setSearchWord(e.target.value)}
            placeholder="搜索情绪词..."
            className="w-full bg-white/60 dark:bg-white/10 border border-purple-200/50 dark:border-white/20 rounded-lg px-3 py-2 text-xs text-gray-700 dark:text-gray-200 outline-none placeholder:text-gray-400"
          />

          <div className="h-[320px] overflow-y-auto space-y-1">
            {wordList.map(word => {
              const result = lookupEmotion(word);
              return (
                <div
                  key={word}
                  className="flex items-center justify-between bg-white/50 dark:bg-white/5 rounded-lg px-3 py-1.5 text-xs"
                >
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{word}</span>
                  <div className="flex items-center gap-3 text-gray-400">
                    <span className={result.v > 0.2 ? 'text-red-400' : result.v < -0.2 ? 'text-blue-400' : ''}>
                      V:{result.v.toFixed(2)}
                    </span>
                    <span className={result.a > 0.6 ? 'text-orange-400' : ''}>
                      A:{result.a.toFixed(2)}
                    </span>
                    <span className="text-gray-300 text-[9px]">{result.matchSource}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-400 text-center">
            共 {getDictionaryWordList().length} 个情绪词 · 坐标基于 Russell 环形模型
          </p>
        </div>
      )}

      {tab === 'moodpool' && (
        <div className="space-y-2">
          {/* Character selector */}
          <div className="flex gap-1.5 flex-wrap">
            {Object.values(characters).map(char => (
              <button
                key={char.id}
                onClick={() => setSelectedChar(char.id)}
                className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                  selectedChar === char.id
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                    : 'bg-white/70 dark:bg-white/10 text-gray-500 hover:bg-white'
                }`}
              >
                {char.name}
              </button>
            ))}
          </div>

          {selectedChar && (
            <div className="h-[320px] overflow-y-auto space-y-1">
              {moodPool.map((entry, i) => {
                const lookup = lookupEmotion(entry.feelingWord);
                return (
                  <div
                    key={i}
                    className="bg-white/50 dark:bg-white/5 rounded-lg px-3 py-2 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-300">
                        {entry.word}
                      </span>
                      <span className="text-purple-500 dark:text-purple-300 font-medium">
                        {entry.feelingWord}
                      </span>
                    </div>
                    <div className="text-gray-400 text-[10px]">
                      V:{lookup.v.toFixed(2)} A:{lookup.a.toFixed(2)} · {lookup.matchSource}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!selectedChar && (
            <div className="text-center py-10 text-gray-400 text-sm">
              选择一个角色查看装饰心情池
            </div>
          )}
        </div>
      )}
    </div>
  );
}
