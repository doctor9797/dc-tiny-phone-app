import React, { useState, useMemo } from 'react';
import { ChevronLeft, Trash2, X, Upload, Star, Camera, Mic, Brain, Heart, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store';
import { scoreMemory } from '../../lib/characterMemory';
import ImageUploader from '../ImageUploader';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = '确认', 
  cancelText = '取消',
  isDark 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDark: boolean;
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-2xl p-6 w-[280px] shadow-2xl`}>
        <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
        <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              isDark 
                ? 'bg-white/10 text-white hover:bg-white/20' 
                : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
            }`}
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-3 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CharacterSettings({
  characterId,
  onBack,
}: {
  characterId: string;
  onBack: () => void;
}) {
  const settings = useAppStore(s => s.settings);
  const character = useAppStore(s => s.characters[characterId]);
  const updateCharacter = useAppStore(s => s.updateCharacter);
  const deleteChat = useAppStore(s => s.deleteChat);
  const removeCharacter = useAppStore(s => s.removeCharacter);
  const characterMemoryBank = useAppStore(s => s.characterMemoryBank[characterId] || []);
  const addCharacterMemory = useAppStore(s => s.addCharacterMemory);
  const deleteCharacterMemory = useAppStore(s => s.deleteCharacterMemory);
  const [showMemoryManager, setShowMemoryManager] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [memoryFilter, setMemoryFilter] = useState<string>('all');

  const [localChar, setLocalChar] = useState(character);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  if (!character) return null;

  const handleSave = () => {
    updateCharacter(characterId, localChar);
    onBack();
  };

  const handleClearChat = () => {
    deleteChat(characterId);
    onBack();
  };

  const handleDeleteChat = () => {
    deleteChat(characterId);
    onBack();
  };

  const handleRemoveFriend = () => {
    removeCharacter(characterId);
    onBack();
  };

  const isDark = settings.wechatTheme === 'dark';

  const scoredMemories = useMemo(() =>
    characterMemoryBank.map(m => ({ entry: m, score: scoreMemory(m) })).sort((a, b) => b.score - a.score),
  [characterMemoryBank]);

  const filteredMemories = useMemo(() => {
    if (memoryFilter === 'all') return scoredMemories;
    return scoredMemories.filter(({ entry }) => entry.type === memoryFilter);
  }, [scoredMemories, memoryFilter]);

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-black' : 'bg-gray-100'}`}>
      {showMemoryManager && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] px-4 pt-12 pb-4 flex items-center justify-between border-b border-gray-200 dark:border-white/10 shrink-0">
            <button onClick={() => { setShowMemoryManager(false); setNewMemoryText(''); }} className="text-gray-500 p-1">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">记忆库</h1>
            <div className="w-8" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Add memory */}
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 space-y-2">
              <textarea
                value={newMemoryText}
                onChange={e => setNewMemoryText(e.target.value)}
                placeholder="添加一条新记忆...（如：用户喜欢吃辣）"
                className="w-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-200 outline-none resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!newMemoryText.trim()) return;
                    addCharacterMemory(characterId, {
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
                  className="flex-1 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium disabled:opacity-40"
                >
                  添加记忆
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 text-xs">
              {['all', 'fact', 'observation', 'conversation', 'event', 'preference'].map(t => (
                <button
                  key={t}
                  onClick={() => setMemoryFilter(t)}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    memoryFilter === t
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {t === 'all' ? '全部' : t === 'fact' ? '事实' : t === 'observation' ? '观察' : t === 'conversation' ? '对话' : t === 'event' ? '事件' : '偏好'}
                </button>
              ))}
            </div>

            {/* Memory list */}
            {filteredMemories.length === 0 ? (
              <div className="text-center py-16">
                <Brain size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400">暂无记忆</p>
                <p className="text-xs text-gray-300 mt-1">角色会自动记录与你的互动</p>
              </div>
            ) : (
              filteredMemories.map(({ entry, score }) => (
                <div key={entry.id} className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-700 dark:text-gray-200">{entry.summary}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          entry.type === 'fact' ? 'bg-blue-100 text-blue-600' :
                          entry.type === 'observation' ? 'bg-green-100 text-green-600' :
                          entry.type === 'event' ? 'bg-orange-100 text-orange-600' :
                          entry.type === 'preference' ? 'bg-pink-100 text-pink-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>{entry.type === 'fact' ? '事实' : entry.type === 'observation' ? '观察' : entry.type === 'event' ? '事件' : entry.type === 'preference' ? '偏好' : '对话'}</span>
                        <span className="text-[10px] text-gray-400">重要性 {entry.importance}</span>
                        <span className="text-[10px] text-gray-400">得分 {score.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Valence bar */}
                        <div className="flex items-center gap-1">
                          <Heart size={10} className={entry.valence > 0.6 ? 'text-red-400' : entry.valence < 0.4 ? 'text-gray-400' : 'text-gray-300'} />
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${entry.valence * 100}%`,
                              backgroundColor: entry.valence > 0.6 ? '#f87171' : entry.valence < 0.4 ? '#9ca3af' : '#d1d5db'
                            }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-gray-300">{entry.accessCount}次访问</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteCharacterMemory(characterId, entry.id)}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearChat}
        title="清空聊天记录"
        message="确定要清空聊天记录吗？这将同时清除世界书角色卡中关于微信聊天的记忆。"
        confirmText="清空"
        isDark={isDark}
      />
      
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteChat}
        title="删除该聊天"
        message="确定要删除该聊天吗？角色记忆将被保留。"
        confirmText="删除"
        isDark={isDark}
      />
      
      <ConfirmModal
        isOpen={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        onConfirm={handleRemoveFriend}
        title="删除好友"
        message="确定要删除这个好友吗？"
        confirmText="删除"
        isDark={isDark}
      />

      <div className={`${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} px-4 pt-12 pb-4 flex items-center justify-between border-b ${isDark ? 'border-white/5' : ''} shrink-0`}>
        <button onClick={onBack} className="w-8 h-8 flex items-center -ml-2 text-gray-500">
          <ChevronLeft size={24} />
        </button>
        <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>聊天设置</h1>
        <button onClick={handleSave} className="p-2 -mr-2 text-blue-500 font-bold">
          保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className={`rounded-2xl p-5 shadow-sm space-y-4 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-4`}>头像</h2>
          <div className="flex items-center gap-4">
            <div 
              className="w-20 h-20 rounded-lg flex-shrink-0"
              style={{ 
                background: character.avatar.startsWith('#') ? character.avatar : `url(${character.avatar}) center/cover` 
              }}
            />
            <div className="flex-1">
              <ImageUploader 
                onImageSelected={(url) => {
                  setLocalChar(prev => ({ ...prev, avatar: url }));
                }}
                className="flex items-center gap-2 text-sm text-blue-500"
              >
                <Upload size={16} />
                更换头像
              </ImageUploader>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl p-5 shadow-sm space-y-4 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-4`}>备注名</h2>
          <input
            type="text"
            value={localChar.remark || ''}
            onChange={(e) => setLocalChar(prev => ({ ...prev, remark: e.target.value }))}
            className={`w-full border rounded-xl p-3 text-sm outline-none focus:border-blue-500 transition-colors ${
              isDark ? 'bg-[#2a2a2a] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-slate-800'
            }`}
          />
        </div>

        <div className={`rounded-2xl p-5 shadow-sm space-y-4 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-4`}>聊天背景</h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={localChar.background || ''}
              onChange={(e) => setLocalChar(prev => ({ ...prev, background: e.target.value }))}
              className={`flex-1 border rounded-xl p-3 text-sm outline-none focus:border-blue-500 transition-colors ${
                isDark ? 'bg-[#2a2a2a] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-slate-800'
              }`}
              placeholder="#ffffff"
            />
            <ImageUploader 
              onImageSelected={(url) => {
                setLocalChar(prev => ({ ...prev, background: url }));
              }}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
              }`}
            >
              上传
            </ImageUploader>
          </div>
        </div>

        <div className={`rounded-2xl p-5 shadow-sm space-y-4 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'} mb-4`}>气泡颜色 (颜色代码)</h2>
          <input
            type="text"
            value={localChar.bubbleColor || ''}
            onChange={(e) => setLocalChar(prev => ({ ...prev, bubbleColor: e.target.value }))}
            className={`w-full border rounded-xl p-3 text-sm outline-none focus:border-blue-500 transition-colors ${
              isDark ? 'bg-[#2a2a2a] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-slate-800'
            }`}
            placeholder="#07c160"
          />
        </div>

        <div className={`rounded-2xl p-5 shadow-sm ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          <button 
            onClick={() => {
              const newValue = !localChar.isStarred;
              setLocalChar(prev => ({ ...prev, isStarred: newValue }));
              updateCharacter(characterId, { isStarred: newValue });
            }}
            className="w-full flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-3">
              <Star size={18} className={localChar.isStarred ? 'text-yellow-500 fill-yellow-500' : isDark ? 'text-gray-500' : 'text-gray-400'} />
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>设为星标朋友</span>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors ${localChar.isStarred ? 'bg-[#07c160]' : isDark ? 'bg-white/10' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${localChar.isStarred ? 'translate-x-4' : ''}`} />
            </div>
          </button>
        </div>

        <div className={`rounded-2xl p-5 shadow-sm ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          <button 
            onClick={() => {
              const newValue = !localChar.voiceReplyEnabled;
              setLocalChar(prev => ({ ...prev, voiceReplyEnabled: newValue }));
              updateCharacter(characterId, { voiceReplyEnabled: newValue });
            }}
            className="w-full flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-3">
              <Mic size={18} className={localChar.voiceReplyEnabled ? 'text-blue-500' : isDark ? 'text-gray-500' : 'text-gray-400'} />
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>发语音消息</span>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors ${localChar.voiceReplyEnabled ? 'bg-[#07c160]' : isDark ? 'bg-white/10' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${localChar.voiceReplyEnabled ? 'translate-x-4' : ''}`} />
            </div>
          </button>
        </div>

        <div className={`rounded-2xl p-4 shadow-sm space-y-3 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          <button 
            onClick={() => {
              const newValue = !localChar.momentsEnabled;
              setLocalChar(prev => ({ ...prev, momentsEnabled: newValue }));
              updateCharacter(characterId, { momentsEnabled: newValue });
            }}
            className={`w-full flex items-center justify-between py-3 px-4 rounded-xl transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3">
              <Camera size={18} className={localChar.momentsEnabled ? 'text-orange-500' : isDark ? 'text-gray-500' : 'text-gray-400'} />
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>发朋友圈</span>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors ${localChar.momentsEnabled ? 'bg-[#07c160]' : isDark ? 'bg-white/10' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${localChar.momentsEnabled ? 'translate-x-4' : ''}`} />
            </div>
          </button>
          
          {localChar.momentsEnabled && (
            <div className={`py-2.5 px-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>每天发朋友圈次数</span>
                <select
                  value={localChar.momentsFrequency || 2}
                  onChange={(e) => {
                    const num = parseInt(e.target.value);
                    setLocalChar(prev => ({ ...prev, momentsFrequency: num }));
                    updateCharacter(characterId, { momentsFrequency: num });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm outline-none ${
                    isDark 
                      ? 'bg-[#2c2c2c] text-gray-200 border-white/10' 
                      : 'bg-white text-slate-700 border-gray-200'
                  } border`}
                >
                  <option value={1}>1次/天</option>
                  <option value={2}>2次/天</option>
                  <option value={3}>3次/天</option>
                  <option value={4}>4次/天</option>
                  <option value={5}>5次/天</option>
                </select>
              </div>
            </div>
          )}
          
          <div className={`py-2.5 px-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>朋友圈背景图</span>
              <ImageUploader
                onImageSelected={(url) => {
                  setLocalChar(prev => ({ ...prev, momentsBackground: url }));
                  updateCharacter(characterId, { momentsBackground: url });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                }`}
              >
                {localChar.momentsBackground ? '更换' : '上传'}
              </ImageUploader>
            </div>
            
            {localChar.momentsBackground && (
              <div className="mt-3 relative">
                <img 
                  src={localChar.momentsBackground} 
                  alt="朋友圈背景" 
                  className="w-full h-20 object-cover rounded-lg"
                />
                <button
                  onClick={() => {
                    setLocalChar(prev => ({ ...prev, momentsBackground: undefined }));
                    updateCharacter(characterId, { momentsBackground: undefined });
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-2xl p-4 shadow-sm space-y-3 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          <button
            onClick={() => setShowMemoryManager(true)}
            className={`w-full p-4 rounded-xl flex items-center gap-3 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
          >
            <Brain size={18} className="text-purple-500" />
            <div className="text-left">
              <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>角色记忆库 ({characterMemoryBank.length})</div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>管理 {character?.name} 对你的记忆</div>
            </div>
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className={`w-full p-4 rounded-xl flex items-center gap-3 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
          >
            <Trash2 size={18} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
            <div className="text-left">
              <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>删除该聊天</div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>仅清除聊天记录，不影响角色记忆</div>
            </div>
          </button>
          
          <button
            onClick={() => setShowClearModal(true)}
            className={`w-full p-4 rounded-xl flex items-center gap-3 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
          >
            <Trash2 size={18} className="text-red-500" />
            <div className="text-left">
              <div className={`text-sm font-medium text-red-500`}>清空聊天记录</div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>清除所有聊天记录和角色记忆</div>
            </div>
          </button>
        </div>

        <button
          onClick={() => setShowRemoveModal(true)}
          className={`w-full py-4 text-red-500 text-sm font-medium ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'} transition-colors`}
        >
          删除好友
        </button>
      </div>

      <div className={`px-4 pb-8 pt-4 border-t ${isDark ? 'border-white/5' : ''}`}>
        <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          人物设定与关系请在[世界书]内对应的人设卡中配置。
        </p>
      </div>
    </div>
  );
}
