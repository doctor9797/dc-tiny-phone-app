import React, { useState, useMemo, useRef } from 'react';
import { useAppStore } from '../store';
import { scoreMemory, mergeSimilarMemories } from '../lib/characterMemory';
import { getCurrentMood, getFeelMemories } from '../lib/moodLoop';
import {
  ChevronLeft, Brain, Heart, X, Plus, Search,
  BarChart3, Star, Activity, BookOpen, Smile, Frown, Pin, PinOff,
} from 'lucide-react';
import EmotionStarChart from './Memory/EmotionStarChart';
import DecayCurve from './Memory/DecayCurve';
import MoodManager from './Memory/MoodManager';

const INS_BG = 'bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-950 dark:via-gray-950 dark:to-pink-950';
const INS_CARD = 'bg-white/70 dark:bg-white/10 backdrop-blur-xl border border-white/40 dark:border-white/20';
const INS_INPUT = 'bg-white/60 dark:bg-white/10 border border-purple-200/50 dark:border-white/20';

const STORAGE_KEY = 'memoryapp-bg';
const DEFAULT_BG = '';

const TYPE_LABELS: Record<string, string> = {
  fact: '事实',
  observation: '观察',
  conversation: '对话',
  event: '事件',
  preference: '偏好',
  feel: '感受',
};

const TYPE_COLORS: Record<string, string> = {
  fact: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
  observation: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300',
  conversation: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300',
  event: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300',
  preference: 'bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300',
  feel: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300',
};

export default function MemoryApp() {
  const { characters, characterMemoryBank, addCharacterMemory, deleteCharacterMemory, updateCharacterMemory, clearCharacterMemories, closeApp } = useAppStore();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [memoryFilter, setMemoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bgUrl, setBgUrl] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_BG; }
    catch { return DEFAULT_BG; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [detailTab, setDetailTab] = useState<'list' | 'starchart'>('list');
  const [decayMemoryId, setDecayMemoryId] = useState<string | null>(null);
  const [showMoodManager, setShowMoodManager] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedFeelIds, setExpandedFeelIds] = useState<Set<string>>(new Set());

  const toggleFeelExpand = (id: string) => {
    setExpandedFeelIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sortedCharacters = useMemo(() =>
    Object.values(characters)
      .filter(c => (c as any).isDisabled !== true)
      .sort((a, b) => {
        const countA = (characterMemoryBank[a.id] || []).length;
        const countB = (characterMemoryBank[b.id] || []).length;
        return countB - countA;
      }),
    [characters, characterMemoryBank]
  );

  const filteredCharacters = useMemo(() => {
    if (!searchQuery.trim()) return sortedCharacters;
    const q = searchQuery.toLowerCase();
    return sortedCharacters.filter(c =>
      c.name.toLowerCase().includes(q) || c.remark.toLowerCase().includes(q)
    );
  }, [sortedCharacters, searchQuery]);

  const handleImportBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setBgUrl(url);
        localStorage.setItem(STORAGE_KEY, url);
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Memory Detail View ──

  if (selectedCharId) {
    const character = characters[selectedCharId];
    if (!character) {
      setSelectedCharId(null);
      return null;
    }

    const bank = characterMemoryBank[selectedCharId] || [];
    const scoredMemories = bank.map(m => ({ entry: m, score: scoreMemory(m) }))
      .sort((a, b) => b.score - a.score);
    const filteredMemories = memoryFilter === 'all'
      ? scoredMemories
      : scoredMemories.filter(({ entry }) => entry.type === memoryFilter);

    return (
      <div className={`h-full flex flex-col ${INS_BG}`}>
        {/* Background image overlay */}
        {bgUrl && (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgUrl})` }} />
        )}
        <div className="absolute inset-0 bg-white/80 dark:bg-black/60 backdrop-blur-sm" />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImportBg} />

        {/* Header */}
        <div className="relative z-10 px-4 pt-7 pb-4 flex items-center justify-between border-b border-purple-200/30 dark:border-white/10 shrink-0">
          <button onClick={() => { setSelectedCharId(null); setNewMemoryText(''); setDecayMemoryId(null); setDetailTab('list'); }} className="text-purple-600 dark:text-purple-300 p-1 hover:bg-purple-100/50 dark:hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
              style={{ background: character.avatar }}
            >
              {character.name[0]}
            </div>
            <h1 className="text-lg font-bold text-purple-900 dark:text-white">{character.name}的记忆</h1>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="text-purple-400 dark:text-purple-300 p-1 hover:bg-purple-100/50 dark:hover:bg-white/10 rounded-lg transition-colors text-xs">
            背景
          </button>
        </div>

        {/* Detail tab bar */}
        <div className="relative z-10 px-4 py-2 flex gap-1 border-b border-purple-200/30 dark:border-white/10">
          <button
            onClick={() => setDetailTab('list')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-full transition-all ${
              detailTab === 'list'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:bg-purple-100/50 dark:hover:bg-white/10'
            }`}
          >
            <BarChart3 size={12} />列表
          </button>
          <button
            onClick={() => setDetailTab('starchart')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-full transition-all ${
              detailTab === 'starchart'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:bg-purple-100/50 dark:hover:bg-white/10'
            }`}
          >
            <Star size={12} />星图
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-3">

          {detailTab === 'starchart' && (<>
            <div className="space-y-3">
              {/* Mood panel */}
              <div className={`${INS_CARD} rounded-xl p-4`}>
                <CurrentMoodPanel characterId={selectedCharId} />
              </div>
              <div className={`${INS_CARD} rounded-xl p-4`}>
              <EmotionStarChart
                memories={bank}
              />
              {/* Decay curve for selected memory */}
              <div className="mt-3 pt-3 border-t border-purple-200/30 dark:border-white/10">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium flex items-center gap-1">
                  <Activity size={12} />衰减曲线
                </div>
                <DecayCurve memory={decayMemoryId ? bank.find(m => m.id === decayMemoryId) || null : null} />
              </div>
            </div>
            </div>

              {/* ── Feel (内心感受) ── */}
              <div className={`${INS_CARD} rounded-xl p-4`}>
                <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                  <Heart size={12} className="text-pink-400" />
                  内心感受
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">({getFeelMemories(selectedCharId).length})</span>
                </div>
                {(() => {
                  const feels = getFeelMemories(selectedCharId);
                  if (!feels.length) return (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-pink-50 dark:bg-pink-500/10 flex items-center justify-center">
                        <Heart size={18} className="text-pink-300 dark:text-pink-400" />
                      </div>
                      <p className="text-[11px] text-gray-400">还没有内心感受</p>
                      <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-1">每天凌晨角色会自动消化记忆</p>
                    </div>
                  );
                  // Group by date
                  const groups: Record<string, typeof feels> = {};
                  for (const f of feels) {
                    const date = new Date(f.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
                    if (!groups[date]) groups[date] = [];
                    groups[date].push(f);
                  }
                  return Object.entries(groups).map(([date, items]) => (
                    <div key={date} className="mb-3 last:mb-0">
                      <div className="text-[10px] text-gray-400 mb-1.5 font-medium">{date}</div>
                      <div className="space-y-1.5">
                        {items.map(f => {
                          const expanded = expandedFeelIds.has(f.id);
                          const isLong = f.content.length > 30;
                          const displayText = expanded || !isLong ? f.content : f.content.slice(0, 28) + '…';
                          return (
                            <div key={f.id} className="bg-pink-50/50 dark:bg-white/5 rounded-xl p-2.5">
                              <div className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                                {displayText}
                                {isLong && (
                                  <button
                                    onClick={() => toggleFeelExpand(f.id)}
                                    className="ml-1 text-[9px] text-pink-400 hover:text-pink-500"
                                  >
                                    {expanded ? '收起' : '展开'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
          </>)}

          {detailTab === 'list' && <>
          <div className={`${INS_CARD} rounded-xl p-3 space-y-2`}>
            <textarea
              value={newMemoryText}
              onChange={e => setNewMemoryText(e.target.value)}
              placeholder="添加一条新记忆...（如：用户喜欢吃辣）"
              className={`w-full ${INS_INPUT} rounded-lg p-3 text-sm text-gray-700 dark:text-gray-200 outline-none resize-none`}
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!newMemoryText.trim()) return;
                  addCharacterMemory(selectedCharId, {
                    type: 'fact',
                    content: newMemoryText.trim(),
                    summary: newMemoryText.trim().slice(0, 80),
                    tags: [],
                    valence: 0.5,
                    arousal: 0.5,
                    importance: 5,
                  });
                  setNewMemoryText('');
                }}
                disabled={!newMemoryText.trim()}
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium disabled:opacity-40 hover:shadow-lg transition-shadow"
              >
                <Plus size={14} className="inline mr-1" />添加记忆
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 text-xs flex-wrap">
            {['all', 'fact', 'observation', 'conversation', 'event', 'preference'].map(t => (
              <button
                key={t}
                onClick={() => setMemoryFilter(t)}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  memoryFilter === t
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                    : `${INS_CARD} text-gray-500 dark:text-gray-400 hover:bg-white/50`
                }`}
              >
                {TYPE_LABELS[t] || t}
              </button>
            ))}
          </div>

          {/* Memory list */}
          {filteredMemories.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-500/20 dark:to-pink-500/20 flex items-center justify-center">
                <Brain size={28} className="text-purple-300 dark:text-purple-400" />
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500">暂无记忆</p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">角色会自动记录与你的互动</p>
            </div>
          ) : (
            filteredMemories.map(({ entry, score }) => (
              <div key={entry.id}>
                <div
                  className={`${INS_CARD} rounded-xl p-3.5 hover:shadow-md transition-shadow cursor-pointer ${
                    decayMemoryId === entry.id ? 'ring-2 ring-purple-400' : ''
                  }`}
                  onClick={() => setDecayMemoryId(decayMemoryId === entry.id ? null : entry.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                        {entry.summary}
                        <div className="inline-flex items-center gap-1 ml-1.5 align-middle">
                          {entry.pinned && <span className="text-[9px] bg-amber-100 dark:bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full">已固定</span>}
                          {entry.digested && !entry.pinned && <span className="text-[9px] bg-gray-100 dark:bg-white/5 text-gray-400 px-1.5 py-0.5 rounded-full">已消化</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TYPE_COLORS[entry.type] || 'bg-gray-100 text-gray-500'}`}>
                          {TYPE_LABELS[entry.type] || entry.type}
                        </span>
                        <span className="text-[10px] text-gray-400">重要性 {entry.importance}</span>
                        <span className="text-[10px] text-gray-400">得分 {score.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center gap-1">
                          <Heart size={10} className={entry.valence > 0.6 ? 'text-red-400' : entry.valence < 0.4 ? 'text-gray-400' : 'text-gray-300'} />
                          <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${entry.valence * 100}%`,
                              backgroundColor: entry.valence > 0.6 ? '#f87171' : entry.valence < 0.4 ? '#9ca3af' : '#d1d5db'
                            }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {new Date(entry.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] text-gray-300 dark:text-gray-500">{entry.accessCount}次访问</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); updateCharacterMemory(selectedCharId, entry.id, { pinned: !entry.pinned }); }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          entry.pinned
                            ? 'text-amber-400 hover:text-amber-500 bg-amber-50 dark:bg-amber-500/10'
                            : 'text-gray-300 dark:text-gray-600 hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-500/5'
                        }`}
                      >
                        {entry.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPendingDeleteId(entry.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                {/* Decay curve shown inline when selected */}
                {decayMemoryId === entry.id && (
                  <div className="ml-4 pl-4 border-l-2 border-purple-200 dark:border-purple-700 mt-1 mb-1">
                    <DecayCurve memory={entry} />
                  </div>
                )}
              </div>))
          )}
          </>}
        </div>

        {/* Bottom total bar */}
        <div className="relative z-10 px-4 py-3 border-t border-purple-200/30 dark:border-white/10">
          <div className={`${INS_CARD} rounded-xl px-4 py-2.5 flex items-center justify-between text-xs`}>
            <span className="text-gray-500 dark:text-gray-400">共计 {bank.length} 条记忆</span>
            <span className="text-gray-400 dark:text-gray-500">
              活跃记忆 {bank.filter(m => scoreMemory(m) > 1).length} 条
            </span>
          </div>
        </div>

        {/* Memory delete confirmation modal */}
        {pendingDeleteId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setPendingDeleteId(null)} />
            <div className={`relative bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-[280px] shadow-2xl`}>
              <h3 className={`text-lg font-bold mb-2 text-slate-800 dark:text-white`}>删除记忆</h3>
              <p className={`text-sm mb-6 text-gray-500 dark:text-gray-400`}>
                确定要永久删除这条记忆吗？角色将不再记得这条内容，此操作不可恢复。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20`}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (pendingDeleteId) {
                      deleteCharacterMemory(selectedCharId, pendingDeleteId);
                      setPendingDeleteId(null);
                    }
                  }}
                  className="flex-1 py-3 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── Character List View ──

  return (
    <div className={`h-full flex flex-col ${INS_BG}`}>
      {/* Background image overlay */}
      {bgUrl && (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgUrl})` }} />
      )}
      <div className="absolute inset-0 bg-white/80 dark:bg-black/60 backdrop-blur-sm" />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImportBg} />

      {/* Header */}
      <div className="relative z-10 px-4 pt-7 pb-4 flex items-center justify-between shrink-0">
        <button onClick={closeApp} className="text-purple-600 dark:text-purple-300 p-1 hover:bg-purple-100/50 dark:hover:bg-white/10 rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-purple-500" />
          <h1 className="text-lg font-bold text-purple-900 dark:text-white">记忆库</h1>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="text-purple-400 dark:text-purple-300 p-1 hover:bg-purple-100/50 dark:hover:bg-white/10 rounded-lg transition-colors text-xs">
          背景
        </button>
        <button
          onClick={() => setShowMoodManager(!showMoodManager)}
          className={`p-1 rounded-lg transition-colors text-xs ${
            showMoodManager ? 'text-purple-600 bg-purple-100 dark:bg-purple-500/20' : 'text-purple-400 hover:bg-purple-100/50 dark:hover:bg-white/10'
          }`}
        >
          <BookOpen size={16} />
        </button>
      </div>

      {/* Mood Manager Panel */}
      {showMoodManager && (
        <div className="relative z-10 px-4 pb-3">
          <div className={`${INS_CARD} rounded-xl p-3`}>
            <MoodManager />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative z-10 px-4 pb-3">
        <div className={`${INS_CARD} rounded-xl flex items-center gap-2 px-3 py-2`}>
          <Search size={16} className="text-purple-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索角色..."
            className="bg-transparent text-sm text-gray-700 dark:text-gray-200 outline-none flex-1 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Character list */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filteredCharacters.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-500/20 dark:to-pink-500/20 flex items-center justify-center">
              <Brain size={28} className="text-purple-300 dark:text-purple-400" />
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {searchQuery ? '未找到匹配的角色' : '暂无角色'}
            </p>
          </div>
        ) : (
          filteredCharacters.map(char => {
            const bank = characterMemoryBank[char.id] || [];
            const activeCount = bank.filter(m => scoreMemory(m) > 1).length;
            const hasMemories = bank.length > 0;

            return (
              <button
                key={char.id}
                onClick={() => { setSelectedCharId(char.id); setDecayMemoryId(null); setDetailTab('list'); }}
                className={`w-full ${INS_CARD} rounded-xl p-3.5 flex items-center gap-3 hover:shadow-md transition-all text-left`}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0 shadow-sm"
                  style={{ background: char.avatar }}
                >
                  {char.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800 dark:text-white">{char.name}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{char.remark || char.relationship}</div>
                </div>
                {hasMemories ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-purple-500 dark:text-purple-300">{bank.length}</div>
                      <div className="text-[10px] text-gray-400">条记忆</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
                      activeCount > 0 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-300 dark:bg-white/10'
                    }`}>
                      {activeCount}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 dark:text-gray-600 shrink-0">暂无记忆</div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Bottom summary */}
      <div className="relative z-10 px-4 py-3 border-t border-purple-200/30 dark:border-white/10">
        <div className={`${INS_CARD} rounded-xl px-4 py-2.5 flex items-center justify-between text-xs`}>
          <span className="text-gray-500 dark:text-gray-400">
            共 {sortedCharacters.length} 个角色
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            总计 {Object.values(characterMemoryBank).reduce((sum, arr) => sum + arr.length, 0)} 条记忆
          </span>
        </div>
      </div>
    </div>
  );
}


// ── Current Mood Panel ──

const MOOD_ICONS: Record<string, string> = {
  elated: '🤩', happy: '😊', content: '😌', neutral: '😐',
  melancholy: '😔', sad: '😢', irritable: '😤', anxious: '😰', tired: '😴',
};
const MOOD_LABELS: Record<string, string> = {
  elated: '兴高采烈', happy: '开心', content: '心情不错', neutral: '平静',
  melancholy: '忧郁', sad: '悲伤', irritable: '烦躁', anxious: '焦虑', tired: '疲惫',
};

function CurrentMoodPanel({ characterId }: { characterId: string }) {
  const mood = getCurrentMood(characterId);
  const char = useAppStore(s => s.characters[characterId]);

  return (
    <div>
      <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
        <Heart size={12} className="text-pink-400" />
        当前心情
      </div>
      <div className="flex items-center gap-3">
        <div className="text-3xl">{MOOD_ICONS[mood.overall] || '😐'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
            {MOOD_LABELS[mood.overall] || '平静'}
            <span className="text-xs font-normal text-gray-400">
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {mood.summary}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
            <span>唤醒: {mood.arousalLevel === 'high' ? '高' : mood.arousalLevel === 'low' ? '低' : '中'}</span>
            <span>PA {mood.paScore.toFixed(1)}</span>
            <span>NA {mood.naScore.toFixed(1)}</span>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-400/70 mt-2 leading-relaxed">
        心情会随对话内容变化，并影响角色的回复语气
      </p>
    </div>
  );
}
