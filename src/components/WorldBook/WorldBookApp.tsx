import React, { useState, useEffect } from 'react';
import { useAppStore, defaultWorldCharacters } from '../../store';
import { ChevronLeft, Plus, Save, Edit, Trash2, Book, Globe, Sparkles } from 'lucide-react';
import { CharacterCard, WorldSetting } from '../../types';
import ImageUploader from '../ImageUploader';
import { generateAIResponse } from '../../lib/ai';


const getT = (theme: string) => {
  const t: Record<string, any> = {
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950', text: 'text-cyan-900 dark:text-cyan-50', header: 'bg-cyan-100/50 dark:bg-cyan-900/50', border: 'border-cyan-200 dark:border-cyan-800', prim: 'text-cyan-700 dark:text-cyan-400', inputBorder: 'border-cyan-300 dark:border-cyan-700', panel: 'bg-cyan-100 dark:bg-cyan-900', active: 'active:bg-cyan-200 dark:active:bg-cyan-800' },
    pink: { bg: 'bg-pink-50 dark:bg-pink-950', text: 'text-pink-900 dark:text-pink-50', header: 'bg-pink-100/50 dark:bg-pink-900/50', border: 'border-pink-200 dark:border-pink-800', prim: 'text-pink-700 dark:text-pink-400', inputBorder: 'border-pink-300 dark:border-pink-700', panel: 'bg-pink-100 dark:bg-pink-900', active: 'active:bg-pink-200 dark:active:bg-pink-800' },
    white: { bg: 'bg-slate-50 dark:bg-[#121212]', text: 'text-slate-900 dark:text-slate-50', header: 'bg-white dark:bg-[#191919]', border: 'border-slate-200 dark:border-white/10', prim: 'text-slate-700 dark:text-slate-300', inputBorder: 'border-slate-300 dark:border-white/10', panel: 'bg-white dark:bg-[#2c2c2c]', active: 'active:bg-slate-200 dark:active:bg-[#2c2c2c]' },
    green: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-900 dark:text-emerald-50', header: 'bg-emerald-100/50 dark:bg-emerald-900/50', border: 'border-emerald-200 dark:border-emerald-800', prim: 'text-emerald-700 dark:text-emerald-400', inputBorder: 'border-emerald-300 dark:border-emerald-700', panel: 'bg-emerald-100 dark:bg-emerald-900', active: 'active:bg-emerald-200 dark:active:bg-emerald-800' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-900 dark:text-purple-50', header: 'bg-purple-100/50 dark:bg-purple-900/50', border: 'border-purple-200 dark:border-purple-800', prim: 'text-purple-700 dark:text-purple-400', inputBorder: 'border-purple-300 dark:border-purple-700', panel: 'bg-purple-100 dark:bg-purple-900', active: 'active:bg-purple-200 dark:active:bg-purple-800' },
    black: { bg: 'bg-zinc-100 dark:bg-black', text: 'text-zinc-900 dark:text-zinc-50', header: 'bg-zinc-200/50 dark:bg-zinc-900/50', border: 'border-zinc-300 dark:border-white/10', prim: 'text-zinc-700 dark:text-zinc-300', inputBorder: 'border-zinc-400 dark:border-white/20', panel: 'bg-zinc-200 dark:bg-[#191919]', active: 'active:bg-zinc-300 dark:active:bg-[#2c2c2c]' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-900 dark:text-gray-50', header: 'bg-gray-200/50 dark:bg-gray-800/50', border: 'border-gray-200 dark:border-gray-700', prim: 'text-gray-700 dark:text-gray-300', inputBorder: 'border-gray-300 dark:border-gray-600', panel: 'bg-gray-200 dark:bg-gray-800', active: 'active:bg-gray-300 dark:active:bg-gray-700' },
    yellow: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-900 dark:text-amber-50', header: 'bg-amber-100/50 dark:bg-amber-900/50', border: 'border-amber-200 dark:border-amber-800', prim: 'text-amber-700 dark:text-amber-400', inputBorder: 'border-amber-300 dark:border-amber-700', panel: 'bg-amber-100 dark:bg-amber-900', active: 'active:bg-amber-200 dark:active:bg-amber-800' },
  }
  return t[theme] || t.gray;
}

const getThemeAvatar = (theme: string) => {
  const colors: Record<string, string> = {
    cyan: '#06b6d4',
    pink: '#ec4899',
    white: '#64748b',
    green: '#10b981',
    purple: '#8b5cf6',
    black: '#71717a',
    gray: '#6b7280',
    yellow: '#f59e0b',
  }
  return colors[theme] || colors.gray;
}

export default function WorldBookApp() {
  const t = getT(useAppStore.getState().settings.osTheme || "gray");
  const { closeApp, worldSettings, activeWorldSettingId, addWorldSetting, updateWorldSetting, setActiveWorldSetting, addFriendRequest, characters, settings } = useAppStore();
  const [selectedSetting, setSelectedSetting] = useState<string | null>(null);
  const [isAddingSetting, setIsAddingSetting] = useState(false);
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [newSettingName, setNewSettingName] = useState('');
  const [newSettingDesc, setNewSettingDesc] = useState('');
  const [newSettingCode, setNewSettingCode] = useState('');
  const [editingChar, setEditingChar] = useState<Partial<CharacterCard> | null>(null);
  const [charToDelete, setCharToDelete] = useState<string | null>(null);
  const [settingToDelete, setSettingToDelete] = useState<string | null>(null);
  
  const [isEditingBaseCode, setIsEditingBaseCode] = useState(false);
  const [baseCodeInput, setBaseCodeInput] = useState(useAppStore.getState().settings.customCode || '');
  const [searchLoading, setSearchLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  
  const { updateSettings } = useAppStore.getState();

  // Sync default characters if empty or using old default data (for existing local storage)
  useEffect(() => {
    if (worldSettings.length > 0) {
      const chars = worldSettings[0].characters;
      if (!chars || chars.length === 0 || (chars.length > 0 && chars[0].experience === 'DC宇宙角色')) {
        updateWorldSetting(worldSettings[0].id, { characters: defaultWorldCharacters });
      }
    }
  }, []);

  const handleSaveSetting = () => {
    if (!newSettingName.trim()) return;
    
    if (editingSetting) {
       updateWorldSetting(editingSetting, {
         title: newSettingName,
         content: newSettingDesc,
         baseCode: newSettingCode
       });
       setEditingSetting(null);
    } else {
       const newSetting: Omit<WorldSetting, 'id'> = {
         title: newSettingName,
         content: newSettingDesc,
         baseCode: newSettingCode,
         characters: []
       };
       addWorldSetting(newSetting);
       setIsAddingSetting(false);
    }
    setNewSettingName('');
    setNewSettingDesc('');
    setNewSettingCode('');
  };

  const handleSaveChar = () => {
    if (!editingChar || !editingChar.name || !selectedSetting) return;
    
    const setting = worldSettings.find(s => s.id === selectedSetting);
    if (!setting) return;

    const isNew = !editingChar.id;
    const charToSave = {
      ...editingChar,
      id: editingChar.id || Date.now().toString()
    } as CharacterCard;

    const updatedChars = isNew 
      ? [...(setting.characters || []), charToSave]
      : (setting.characters || []).map(c => c.id === charToSave.id ? charToSave : c);

    updateWorldSetting(selectedSetting, { characters: updatedChars });
    
    if (isNew) {
      if (charToSave.isEnabled !== false) {
        const store = useAppStore.getState();
        store.addFriendRequest(charToSave);
        store.setNotification({
          id: Date.now(),
          title: charToSave.name,
          text: `${charToSave.name}请求添加你为朋友`,
          sourceApp: 'wechat',
          openApp: 'wechat',
          characterId: charToSave.id,
        });
      }
    } else {
      useAppStore.getState().updateCharacter(charToSave.id, {
        name: charToSave.name,
        avatar: charToSave.avatar || '#333',
        relationship: charToSave.relationship || '朋友',
        interactionMode: charToSave.interactionMode || '友好',
        personality: charToSave.personality || '',
        userNickname: charToSave.userNickname || '你',
        affection: charToSave.affection || 50,
      });
    }
    
    setEditingChar(null);
  };

  const handleDeleteChar = (charId: string) => {
    if (!selectedSetting) return;
    const setting = worldSettings.find(s => s.id === selectedSetting);
    if (!setting) return;
    
    const updatedChars = (setting.characters || []).filter(c => c.id !== charId);
    updateWorldSetting(selectedSetting, { characters: updatedChars });
    useAppStore.getState().removeCharacter(charId);
    setCharToDelete(null);
  };

  const handleDeleteSetting = () => {
    if (!settingToDelete) return;
    if (activeWorldSettingId === settingToDelete) {
      setActiveWorldSetting(null);
    }
    useAppStore.getState().deleteWorldSetting(settingToDelete);
    setSettingToDelete(null);
  };

  const handleActivateSetting = (settingId: string) => {
    if (activeWorldSettingId === settingId) {
      setActiveWorldSetting(null);
    } else {
      setActiveWorldSetting(settingId);
    }
  };

  const handleWebSearch = async () => {
    const name = editingChar?.name?.trim();
    if (!name) return;
    setSearchLoading(true);
    try {
      const prompt = `你是一个角色设定助手。请根据「${name}」这个已有角色（可以是动漫、电影、小说、游戏等作品中的角色）的公开信息，用中文生成以下内容，按格式输出，不要有多余内容：

性格：${name}的核心性格特质（简短一句话）
经历：${name}的主要经历概括（2-3句话）
与我的关系：${name}与"我"可能的关系设定（如：情侣、师徒、宿敌、战友等）
对我的看法：${name}如何看待"我"（1-2句话）
对我的称呼：${name}对"我"的称呼
相处模式：${name}与"我"的相处模式（如：轻松幽默、互相依赖、针锋相对等）`;

      const result = await generateAIResponse(prompt, '你是一个角色设定助手，只输出格式化的角色信息，不要添加额外说明。');
      const lines = result.split('\n').filter(l => l.trim());
      const updates: Partial<CharacterCard> = {};
      for (const line of lines) {
        const clean = line.replace(/^[#*\-、\s]+/, '');
        if (clean.startsWith('性格：') || clean.startsWith('性格:')) updates.personality = clean.replace(/^性格[：:]/, '').trim();
        else if (clean.startsWith('经历：') || clean.startsWith('经历:')) updates.experience = clean.replace(/^经历[：:]/, '').trim();
        else if (clean.startsWith('与我的关系：') || clean.startsWith('与我的关系:')) updates.relationship = clean.replace(/^与我的关系[：:]/, '').trim();
        else if (clean.startsWith('对我的看法：') || clean.startsWith('对我的看法:')) updates.viewOnMe = clean.replace(/^对我的看法[：:]/, '').trim();
        else if (clean.startsWith('对我的称呼：') || clean.startsWith('对我的称呼:')) updates.userNickname = clean.replace(/^对我的称呼[：:]/, '').trim();
        else if (clean.startsWith('相处模式：') || clean.startsWith('相处模式:')) updates.interactionMode = clean.replace(/^相处模式[：:]/, '').trim();
      }
      setEditingChar(prev => ({ ...prev, ...updates }));
    } catch {
      alert('联网搜索失败，请检查 AI 配置后重试');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    const name = editingChar?.name?.trim();
    if (!name) return;
    setGenerateLoading(true);
    try {
      const prompt = `你是一个角色创作助手。请为角色「${name}」随机生成一套完整的角色设定，要富有创意和故事性，按格式输出：

性格：${name}的性格（简短一句话，要独特有趣）
经历：${name}的背景经历（2-3句话，可以奇幻、科幻、日常等任意风格）
与我的关系：${name}与"我"的关系（要具体有故事感）
对我的看法：${name}如何看待"我"（1-2句话，符合设定的口吻）
对我的称呼：${name}对"我"的称呼（要符合关系和设定）
相处模式：${name}与"我"的相处模式
好感度：0-100之间的数字`;

      const result = await generateAIResponse(prompt, '你是一个角色创作助手，只输出格式化的角色信息，不要添加额外说明。');
      const lines = result.split('\n').filter(l => l.trim());
      const updates: Partial<CharacterCard> = {};
      for (const line of lines) {
        const clean = line.replace(/^[#*\-、\s]+/, '');
        if (clean.startsWith('性格：') || clean.startsWith('性格:')) updates.personality = clean.replace(/^性格[：:]/, '').trim();
        else if (clean.startsWith('经历：') || clean.startsWith('经历:')) updates.experience = clean.replace(/^经历[：:]/, '').trim();
        else if (clean.startsWith('与我的关系：') || clean.startsWith('与我的关系:')) updates.relationship = clean.replace(/^与我的关系[：:]/, '').trim();
        else if (clean.startsWith('对我的看法：') || clean.startsWith('对我的看法:')) updates.viewOnMe = clean.replace(/^对我的看法[：:]/, '').trim();
        else if (clean.startsWith('对我的称呼：') || clean.startsWith('对我的称呼:')) updates.userNickname = clean.replace(/^对我的称呼[：:]/, '').trim();
        else if (clean.startsWith('相处模式：') || clean.startsWith('相处模式:')) updates.interactionMode = clean.replace(/^相处模式[：:]/, '').trim();
        else if (clean.startsWith('好感度：') || clean.startsWith('好感度:')) {
          const match = clean.replace(/^好感度[：:]/, '').trim().match(/\d+/);
          if (match) updates.affection = Math.max(0, Math.min(100, parseInt(match[0])));
        }
      }
      setEditingChar(prev => ({ ...prev, ...updates }));
    } catch {
      alert('自动生成失败，请检查 AI 配置后重试');
    } finally {
      setGenerateLoading(false);
    }
  };

  if (isEditingBaseCode) {
    return (
      <div className={`h-full flex flex-col ${t.bg} ${t.text} font-serif`}>
        <div className={`px-4 pt-7 pb-3 flex items-center justify-between border-b ${t.border} ${t.header}`}>
          <button onClick={() => setIsEditingBaseCode(false)} className={`${t.prim}`}>取消</button>
          <h1 className="text-lg font-bold">基础代码</h1>
          <button onClick={() => {
            updateSettings({ customCode: baseCodeInput });
            setIsEditingBaseCode(false);
          }} className={`${t.prim} font-bold`}>保存执行</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
           <p className="text-xs text-emerald-600 dark:text-emerald-500 mb-2 font-sans font-bold">⚠️警告: 该选项中的代码会被强制执行！可实现强制美化或执行隐藏操作。请确认代码正确。</p>
           <textarea 
             className="w-full flex-1 bg-black/80 text-green-400 font-mono p-4 rounded-xl resize-none outline-none text-xs leading-relaxed shadow-inner"
             placeholder="输入JS代码..."
             value={baseCodeInput}
             onChange={e => setBaseCodeInput(e.target.value)}
           />
        </div>
      </div>
    );
  }

  if (isAddingSetting || editingSetting) {
    return (
      <div className={`h-full flex flex-col ${t.bg} ${t.text} font-serif`}>
        <div className={`px-4 pt-7 pb-3 flex items-center justify-between border-b ${t.border} ${t.header}`}>
          <button onClick={() => { setIsAddingSetting(false); setEditingSetting(null); }} className={`${t.prim}`}>取消</button>
          <h1 className="text-lg font-bold">{editingSetting ? '编辑世界设定' : '新建世界设定'}</h1>
          <button onClick={handleSaveSetting} className={`${t.prim} font-bold`}>保存</button>
        </div>
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-bold mb-1">世界名称</label>
            <input
              type="text"
              value={newSettingName}
              onChange={e => setNewSettingName(e.target.value)}
              className={`w-full border ${t.inputBorder} rounded p-2 bg-white/50 outline-none focus:border-amber-500`}
              placeholder="例如：哥谭市"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={async () => {
                  const name = newSettingName.trim();
                  if (!name) return;
                  setSearchLoading(true);
                  try {
                    const prompt = `你是一个世界设定助手。请根据「${name}」这个关键词的公开信息，用中文生成一个完整的世界观描述，按格式输出：

世界描述：描述这个世界的特点（2-4句话，涵盖背景设定、氛围、关键特征等）

只输出"世界描述："之后的内容，不要有多余内容。`;
                    const result = await generateAIResponse(prompt, '你是一个世界设定助手，只输出格式化的世界描述，不要添加额外说明。');
                    const match = result.replace(/^世界描述[：:]\s*/, '').trim();
                    if (match) setNewSettingDesc(match);
                  } catch {
                    alert('联网搜索失败，请检查 AI 配置后重试');
                  } finally {
                    setSearchLoading(false);
                  }
                }}
                disabled={!newSettingName.trim() || searchLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold border transition-all active:scale-95 ${
                  !newSettingName.trim()
                    ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-zinc-700'
                    : `${t.panel} ${t.prim} ${t.inputBorder}`
                }`}
              >
                <Globe size={14} />
                {searchLoading ? '搜索中...' : '联网搜索'}
              </button>
              <button
                onClick={async () => {
                  const name = newSettingName.trim();
                  if (!name) return;
                  setGenerateLoading(true);
                  try {
                    const prompt = `你是一个世界创作助手。请根据「${name}」这个主题，随机生成一套独特的虚构世界观设定，要富有创意和故事性，只输出以下格式：

世界描述：详细描述这个世界的背景、历史、氛围、规则等（3-5句话）

保持内容连贯、有沉浸感，可以奇幻、科幻、历史架空或现代等任意风格。只输出"世界描述："之后的内容，不要有多余内容。`;
                    const result = await generateAIResponse(prompt, '你是一个世界创作助手，只输出格式化的世界描述，不要添加额外说明。');
                    const match = result.replace(/^世界描述[：:]\s*/, '').trim();
                    if (match) setNewSettingDesc(match);
                  } catch {
                    alert('随机生成失败，请检查 AI 配置后重试');
                  } finally {
                    setGenerateLoading(false);
                  }
                }}
                disabled={!newSettingName.trim() || generateLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold border transition-all active:scale-95 ${
                  !newSettingName.trim()
                    ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-zinc-700'
                    : `${t.panel} ${t.prim} ${t.inputBorder}`
                }`}
              >
                <Sparkles size={14} />
                {generateLoading ? '生成中...' : '随机生成'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">世界描述</label>
            <textarea
              value={newSettingDesc}
              onChange={e => setNewSettingDesc(e.target.value)}
              className={`w-full h-32 border ${t.inputBorder} rounded p-2 bg-white/50 resize-none outline-none focus:border-amber-500`}
              placeholder="描述这个世界的背景、规则等..."
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">基础代码 (强制执行规则)</label>
            <textarea 
              value={newSettingCode}
              onChange={e => setNewSettingCode(e.target.value)}
              className={`w-full h-32 border ${t.inputBorder} rounded p-2 bg-slate-800 text-green-400 font-mono text-xs resize-none outline-none focus:border-amber-500`}
              placeholder="在这里可以填写系统Prompt指令或设定，保存后，这个世界观下的角色对话将强行受到此设定约束..."
            />
          </div>
        </div>
      </div>
    );
  }

  if (editingChar) {
    return (
      <div className={`h-full flex flex-col ${t.bg} ${t.text} font-serif`}>
        <div className={`px-4 pt-7 pb-3 flex items-center justify-between border-b ${t.border} ${t.header}`}>
          <button onClick={() => setEditingChar(null)} className={`${t.prim}`}>取消</button>
          <h1 className="text-lg font-bold">{editingChar.id ? '编辑角色' : '新建角色'}</h1>
          <button onClick={handleSaveChar} className={`${t.prim} font-bold`}>保存</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">姓名</label>
            <input
              type="text"
              value={editingChar.name || ''}
              onChange={e => setEditingChar({...editingChar, name: e.target.value})}
              className={`w-full border ${t.inputBorder} rounded p-2 bg-white/50 outline-none focus:border-amber-500`}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleWebSearch}
                disabled={!editingChar?.name?.trim() || searchLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold border transition-all active:scale-95 ${
                  !editingChar?.name?.trim()
                    ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-zinc-700'
                    : `${t.panel} ${t.prim} ${t.inputBorder}`
                }`}
              >
                <Globe size={14} />
                {searchLoading ? '搜索中...' : '联网搜索'}
              </button>
              <button
                onClick={handleAutoGenerate}
                disabled={!editingChar?.name?.trim() || generateLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold border transition-all active:scale-95 ${
                  !editingChar?.name?.trim()
                    ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-zinc-700'
                    : `${t.panel} ${t.prim} ${t.inputBorder}`
                }`}
              >
                <Sparkles size={14} />
                {generateLoading ? '生成中...' : '自动生成'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">角色头像</label>
            <div className="flex items-center gap-4">
              <div 
                className={`w-16 h-16 rounded overflow-hidden border-2 ${t.inputBorder} flex items-center justify-center bg-white/50 bg-cover bg-center`}
                style={{ backgroundImage: (editingChar.avatar || '').startsWith('#') ? 'none' : `url(${editingChar.avatar})`, backgroundColor: (editingChar.avatar || '').startsWith('#') ? editingChar.avatar : 'transparent' }}
              >
                {!editingChar.avatar && <span className="text-emerald-500/50 text-xs">无头像</span>}
              </div>
              <ImageUploader onImageSelected={(url) => setEditingChar({...editingChar, avatar: url})} className={`px-4 py-2 rounded text-sm flex items-center justify-center cursor-pointer border ${t.inputBorder} ${t.panel} ${t.prim} transition-colors`}>
                上传本地图片
              </ImageUploader>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">性格</label>
            <input 
              type="text" 
              value={editingChar.personality || ''}
              onChange={e => setEditingChar({...editingChar, personality: e.target.value})}
              className={`w-full border ${t.inputBorder} rounded p-2 bg-white/50 outline-none focus:border-amber-500`}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">经历</label>
            <textarea 
              value={editingChar.experience || ''}
              onChange={e => setEditingChar({...editingChar, experience: e.target.value})}
              className={`w-full h-24 border ${t.inputBorder} rounded p-2 bg-white/50 resize-none outline-none focus:border-amber-500`}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">与我的关系</label>
            <input 
              type="text" 
              value={editingChar.relationship || ''}
              onChange={e => setEditingChar({...editingChar, relationship: e.target.value})}
              className={`w-full border ${t.inputBorder} rounded p-2 bg-white/50 outline-none focus:border-amber-500`}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">对我的看法</label>
            <textarea 
              value={editingChar.viewOnMe || ''}
              onChange={e => setEditingChar({...editingChar, viewOnMe: e.target.value})}
              className={`w-full h-24 border ${t.inputBorder} rounded p-2 bg-white/50 resize-none outline-none focus:border-amber-500`}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">强制要求</label>
            <textarea
              value={editingChar.forceRequirements || ''}
              onChange={e => setEditingChar({...editingChar, forceRequirements: e.target.value})}
              className={`w-full h-24 border ${t.inputBorder} rounded p-2 bg-white/50 resize-none outline-none focus:border-amber-500`}
              placeholder="这里填写的要求会在 AI 回复前被强制检查，例如：必须叫我某个称呼、绝不能提某件事、必须维持某种语气。默认留空。"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">好感度 (0-100)</label>
              <input
                type="text"
                inputMode="numeric"
                value={editingChar.affection || ''}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setEditingChar({...editingChar, affection: 0});
                    return;
                  }
                  if (/^\d{1,3}$/.test(raw)) {
                    setEditingChar({...editingChar, affection: Math.min(100, parseInt(raw))});
                  }
                }}
                className={`w-full border ${t.inputBorder} rounded p-2 bg-white/50 outline-none focus:border-amber-500`}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">对我的称呼</label>
              <input 
                type="text" 
                value={editingChar.userNickname || ''}
                onChange={e => setEditingChar({...editingChar, userNickname: e.target.value})}
                className={`w-full border ${t.inputBorder} rounded p-2 bg-white/50 outline-none focus:border-amber-500`}
                placeholder="例如: 老大"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">相处模式</label>
            <input 
              type="text" 
              value={editingChar.interactionMode || ''}
              onChange={e => setEditingChar({...editingChar, interactionMode: e.target.value})}
              className={`w-full border ${t.inputBorder} rounded p-2 bg-white/50 outline-none focus:border-amber-500`}
              placeholder="例如: 轻松、幽默、互相调侃"
            />
          </div>



        </div>
      </div>
    );
  }

  if (selectedSetting) {
    const setting = worldSettings.find(s => s.id === selectedSetting);
    if (!setting) return null;

    return (
      <div className={`h-full flex flex-col ${t.bg} ${t.text} font-serif`}>
        <div className={`px-4 pt-7 pb-3 flex items-center justify-between border-b ${t.border} ${t.header}`}>
          <button onClick={() => setSelectedSetting(null)} className={`${t.prim}`}><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-bold truncate max-w-[200px]">{setting.title}</h1>
          <button onClick={() => {
             setEditingSetting(setting.id);
             setNewSettingName(setting.title);
             setNewSettingDesc(setting.content);
             setNewSettingCode(setting.baseCode || '');
          }} className={`${t.prim}`}><Edit size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className={`bg-white/60 p-4 rounded-xl border ${t.border} mb-6`}>
            <h3 className="font-bold text-lg mb-2">世界描述</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{setting.content}</p>
            {setting.baseCode && (
              <div className={`mt-4 pt-4 border-t ${t.border}/50`}>
                <h4 className={`font-bold text-xs ${t.prim} mb-1`}>基础代码 (已激活)</h4>
                <div className="text-xs font-mono bg-emerald-900/10 dark:bg-emerald-400/10 p-2 rounded text-emerald-800 dark:text-emerald-200 break-words whitespace-pre-wrap">
                  {setting.baseCode}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">角色卡片</h3>
            <button 
              onClick={() => setEditingChar({ avatar: getThemeAvatar(settings.osTheme || 'green') })}
              className={`${t.prim} text-sm flex items-center gap-1`}
            >
              <Plus size={16} /> 添加角色
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {[...(setting.characters || [])].sort((a, b) => (a.isEnabled === false ? 1 : 0) - (b.isEnabled === false ? 1 : 0)).map(char => (
              <div
                key={char.id}
                className={`bg-white/60 p-3 rounded-lg border ${t.border} relative cursor-pointer ${t.active} transition-all touch-manipulation ${char.isEnabled === false ? 'opacity-50 grayscale' : ''}`}
                onClick={() => setEditingChar(char)}
                role="button"
                tabIndex={0}
              >
                <div className="font-bold mb-1 pr-12 text-left">{char.name}</div>
                <div className={`text-xs ${t.prim} line-clamp-2 text-left`}>{char.personality}</div>
                {char.forceRequirements && (
                  <div className="text-[11px] text-amber-700 mt-1 line-clamp-2">强制要求：{char.forceRequirements}</div>
                )}

                <div className="absolute top-2 right-2 flex gap-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const charToSave = { ...char, isEnabled: char.isEnabled === false ? true : false };
                      const updatedChars = (setting.characters || []).map(c => c.id === char.id ? charToSave : c);
                      useAppStore.getState().updateWorldSetting(selectedSetting, { characters: updatedChars });
                      const store = useAppStore.getState();
                      if (charToSave.isEnabled) {
                        if (!store.characters[char.id]) {
                          store.addFriendRequest(charToSave);
                        } else {
                          store.updateCharacter(char.id, { isDisabled: false } as any);
                        }
                      } else {
                        store.updateCharacter(char.id, { isDisabled: true } as any);
                      }
                    }}
                    className={`${char.isEnabled === false ? 'text-gray-400' : 'text-emerald-500'} p-1 -m-1 touch-manipulation font-bold text-[10px] bg-white rounded border ${t.border}`}
                  >
                    {char.isEnabled === false ? '已停用' : '已启用'}
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setCharToDelete(char.id);
                    }} 
                    className="text-red-500/70 hover:text-red-500 p-1 -m-1 touch-manipulation ml-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {(!setting.characters || setting.characters.length === 0) && (
              <div className="col-span-2 text-center text-emerald-600 dark:text-emerald-500/50 text-sm py-4">
                暂无角色，点击右上角添加
              </div>
            )}
          </div>
        </div>
        
        {charToDelete && (
          <div className="absolute inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-xl border ${t.border}`}>
              <h3 className="text-lg font-bold mb-2">确认删除</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">确定要删除这个角色吗？删除后该角色将不会再出现在系统内。</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCharToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold"
                >
                  取消
                </button>
                <button 
                  onClick={() => handleDeleteChar(charToDelete)}
                  className="flex-1 py-2 rounded-xl bg-red-500 text-white font-bold"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${t.bg} ${t.text} font-serif`}>
      <div className={`px-4 pt-7 pb-3 flex items-center justify-between border-b ${t.border} ${t.header}`}>
        <div className="w-8"></div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Book size={24} /> 世界书</h1>
        <button onClick={() => setIsAddingSetting(true)} className={`${t.prim}`}><Plus size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className={`text-xs ${t.prim} mb-6 text-center`}>
          在这里添加的世界观和角色设定，将会影响所有角色的对话和朋友圈回复。
        </p>

        <button 
          onClick={() => setIsEditingBaseCode(true)}
          className={`w-full ${t.panel} text-emerald-800 dark:text-emerald-200 font-bold py-2 rounded-xl border ${t.inputBorder} shadow-sm active:scale-95 mb-6`}
        >
          编辑基础代码 👨‍💻
        </button>
        
        {worldSettings.map(setting => (
          <div 
            key={setting.id} 
            className={`bg-white border ${t.border} rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow relative`}
          >
            <div 
              className="cursor-pointer"
              onClick={() => setSelectedSetting(setting.id)}
            >
              <h2 className={`font-bold ${t.text} mb-2`}>{setting.title}</h2>
              <p className="text-sm text-emerald-800 dark:text-emerald-200 line-clamp-3 whitespace-pre-wrap">{setting.content}</p>
              <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-500 flex items-center gap-1">
                <span>{(setting.characters || []).length} 个角色</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => handleActivateSetting(setting.id)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeWorldSettingId === setting.id 
                    ? `${t.panel} ${t.prim} border ${t.inputBorder}` 
                    : `${t.bg} ${t.prim} border ${t.inputBorder} opacity-70 hover:opacity-100`
                }`}
              >
                {activeWorldSettingId === setting.id ? '✓ 已启用' : '启用'}
              </button>
              <button 
                onClick={() => setSettingToDelete(setting.id)}
                className="px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {settingToDelete && (
        <div className="absolute inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-xl border ${t.border}`}>
            <h3 className="text-lg font-bold mb-2">确认删除世界观</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">确定要删除这个世界观吗？删除后无法恢复。</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setSettingToDelete(null)}
                className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold"
              >
                取消
              </button>
              <button 
                onClick={handleDeleteSetting}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white font-bold"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
