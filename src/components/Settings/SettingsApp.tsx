import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Save, ChevronRight, Palette, Plus, Trash2, User } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import { VoiceApiConfig } from '../../types';
import { injectFont, saveFontData, removeInjectedFont } from '../../lib/fontStorage';

type ViewMode = 'main' | 'api' | 'persona' | 'personalize' | 'appnames' | 'icons' | 'theme' | 'fullscreen';

const THEMES = [
  { id: 'cyan', name: '浅蓝', bg: 'bg-sky-100' },
  { id: 'pink', name: '浅粉', bg: 'bg-pink-100' },
  { id: 'white', name: '白色', bg: 'bg-white' },
  { id: 'green', name: '浅绿', bg: 'bg-emerald-100' },
  { id: 'purple', name: '浅紫', bg: 'bg-purple-100' },
  { id: 'black', name: '黑色', bg: 'bg-black' },
  { id: 'gray', name: '浅灰', bg: 'bg-slate-100' },
  { id: 'yellow', name: '浅黄', bg: 'bg-amber-100' },
];

export default function SettingsApp() {
  const { settings, updateSettings, closeApp, characters } = useAppStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [fontError, setFontError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('main');
  const [fs, setFs] = useState(false);

  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setFs(!!document.fullscreenElement);
    const handler = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleSave = () => {
    updateSettings(localSettings);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1500);
    if (view !== 'main') setView('main');
  };

  const renderHeader = (title: string, backToMain = true) => (
    <>
    <div className="bg-white px-4 pt-7 pb-4 flex items-center justify-between border-b shrink-0 z-10 transition-colors">
      {backToMain ? (
        <button onClick={() => setView('main')} className="w-8 h-8 flex items-center -ml-2 text-slate-500"><ChevronLeft size={24} /></button>
      ) : (
        <button onClick={closeApp} className="w-8 h-8 flex items-center -ml-2 text-slate-500"><ChevronLeft size={24} /></button>
      )}
      <h1 className="text-lg font-bold text-slate-800">{title}</h1>
      <button onClick={handleSave} className="p-2 -mr-2 text-blue-500 font-bold">保存</button>
    </div>
    {savedToast && (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-5 py-2 rounded-full z-[9999] animate-fade-in pointer-events-none">
        保存成功
      </div>
    )}
    </>
  );

  const renderMenuButton = (label: string, icon: React.ReactNode, target: ViewMode) => (
    <button 
      onClick={() => setView(target)}
      className="w-full bg-white px-5 py-4 flex items-center justify-between active:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-3 font-medium text-slate-700">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          {icon}
        </div>
        {label}
      </div>
      <ChevronRight size={20} className="text-slate-300"/>
    </button>
  );

  if (view === 'main') {
    return (
      <div className="h-full flex flex-col bg-slate-50">
        {renderHeader('设置', false)}
        <div className="flex-1 overflow-y-auto pt-4 pb-20">
          <div className="mx-4 mb-4 bg-white rounded-2xl overflow-hidden shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100">
            {renderMenuButton('API 配置', <span className="font-mono text-xs font-bold">API</span>, 'api')}
            <div className="h-px bg-slate-50 ml-[60px]" />
            {renderMenuButton('我的设定', <span className="font-bold">ME</span>, 'persona')}
            <div className="h-px bg-slate-50 ml-[60px]" />
            {renderMenuButton('主题与个性化', <Palette size={16}/>, 'theme')}
          </div>

          <div className="mx-4 bg-white rounded-2xl overflow-hidden shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100">
            {renderMenuButton('系统显示及其他', <span className="font-bold">OS</span>, 'personalize')}
            <div className="h-px bg-slate-50 ml-[60px]" />
            {renderMenuButton('重新命名应用', <span className="font-bold text-xs">A/B</span>, 'appnames')}
            <div className="h-px bg-slate-50 ml-[60px]" />
            {renderMenuButton('自定义应用图标', <span className="font-bold text-xs">ICO</span>, 'icons')}
            <div className="h-px bg-slate-50 ml-[60px]" />
            {renderMenuButton('全屏显示', <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>, 'fullscreen')}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'api') {
     return (
       <div className="h-full flex flex-col bg-slate-50">
         {renderHeader('API 配置')}
         <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* 文字生成API */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="text-2xl">✍️</span> 文字生成API
              </h2>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">API Base URL</label>
                <input 
                  type="text" 
                  value={localSettings.apiBaseUrl}
                  onChange={e => setLocalSettings({...localSettings, apiBaseUrl: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="例如: https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">API Key</label>
                <input 
                  type="password" 
                  value={localSettings.apiKey}
                  onChange={e => setLocalSettings({...localSettings, apiKey: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="输入你的 API Key"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">模型</label>
                <input 
                  type="text" 
                  value={localSettings.apiModel}
                  onChange={e => setLocalSettings({...localSettings, apiModel: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="例如: gpt-4, gpt-3.5-turbo"
                />
              </div>
            </div>

            {/* MiniMax语音API */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">🎤</span> MiniMax 语音API
                </h2>
                <button
                  onClick={() => {
                    const newConfig: VoiceApiConfig = {
                      id: Date.now().toString(),
                      baseUrl: 'https://api.minimax.chat/v1',
                      groupId: '',
                      apiKey: '',
                      voiceId: '',
                      ttsModel: 'speech-02',
                      sttModel: 'whisper-1',
                      characterId: '',
                      characterName: '',
                    };
                    setLocalSettings({
                      ...localSettings,
                      voiceApiConfigs: [...(localSettings.voiceApiConfigs || []), newConfig],
                    });
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium"
                >
                  <Plus size={16} />
                  新增
                </button>
              </div>
              
              {(localSettings.voiceApiConfigs || []).length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  暂未配置语音API，点击上方"新增"添加
                </div>
              ) : (
                <div className="space-y-4">
                  {(localSettings.voiceApiConfigs || []).map((config, index) => (
                    <div key={config.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">配置 {index + 1}</span>
                        <button
                          onClick={() => {
                            if (confirm('确定要删除这个语音API配置吗？')) {
                              setLocalSettings({
                                ...localSettings,
                                voiceApiConfigs: (localSettings.voiceApiConfigs || []).filter(c => c.id !== config.id),
                              });
                            }
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">专属Voice ID</label>
                        <input
                          type="text"
                          value={config.voiceId}
                          onChange={e => {
                            const newConfigs = [...(localSettings.voiceApiConfigs || [])];
                            newConfigs[index] = { ...newConfigs[index], voiceId: e.target.value };
                            setLocalSettings({ ...localSettings, voiceApiConfigs: newConfigs });
                          }}
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                          placeholder="输入专属Voice ID（如: female-shaonv）"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">对应角色</label>
                        <select
                          value={config.characterId}
                          onChange={e => {
                            const newConfigs = [...(localSettings.voiceApiConfigs || [])];
                            const charId = e.target.value;
                            const charName = charId ? (characters[charId]?.name || '') : '';
                            newConfigs[index] = { ...newConfigs[index], characterId: charId, characterName: charName };
                            setLocalSettings({ ...localSettings, voiceApiConfigs: newConfigs });
                          }}
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                        >
                          <option value="">请选择角色</option>
                          {Object.values(characters).filter(c => !c.isDisabled).map(char => (
                            <option key={char.id} value={char.id}>{char.name}</option>
                          ))}
                        </select>
                        {config.characterId && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                            <User size={14} />
                            <span>该音色专属于: {config.characterName}</span>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Base URL</label>
                        <input
                          type="text"
                          value={config.baseUrl}
                          onChange={e => {
                            const newConfigs = [...(localSettings.voiceApiConfigs || [])];
                            newConfigs[index] = { ...newConfigs[index], baseUrl: e.target.value };
                            setLocalSettings({ ...localSettings, voiceApiConfigs: newConfigs });
                          }}
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                          placeholder="https://api.minimax.chat/v1"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Group ID</label>
                        <input
                          type="password"
                          value={config.groupId}
                          onChange={e => {
                            const newConfigs = [...(localSettings.voiceApiConfigs || [])];
                            newConfigs[index] = { ...newConfigs[index], groupId: e.target.value };
                            setLocalSettings({ ...localSettings, voiceApiConfigs: newConfigs });
                          }}
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                          placeholder="你的Group ID"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">API Key</label>
                        <input
                          type="password"
                          value={config.apiKey}
                          onChange={e => {
                            const newConfigs = [...(localSettings.voiceApiConfigs || [])];
                            newConfigs[index] = { ...newConfigs[index], apiKey: e.target.value };
                            setLocalSettings({ ...localSettings, voiceApiConfigs: newConfigs });
                          }}
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                          placeholder="你的API Key"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">TTS模型</label>
                          <select
                            value={config.ttsModel}
                            onChange={e => {
                              const newConfigs = [...(localSettings.voiceApiConfigs || [])];
                              newConfigs[index] = { ...newConfigs[index], ttsModel: e.target.value };
                              setLocalSettings({ ...localSettings, voiceApiConfigs: newConfigs });
                            }}
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                          >
                            <option value="speech-01">speech-01 (中文)</option>
                            <option value="speech-02">speech-02 (英文)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">STT模型</label>
                          <input
                            type="text"
                            value={config.sttModel}
                            onChange={e => {
                              const newConfigs = [...(localSettings.voiceApiConfigs || [])];
                              newConfigs[index] = { ...newConfigs[index], sttModel: e.target.value };
                              setLocalSettings({ ...localSettings, voiceApiConfigs: newConfigs });
                            }}
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                            placeholder="whisper-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

         </div>
       </div>
     );
      }

  if (view === 'theme') {
     return (
       <div className="h-full flex flex-col bg-slate-50">
         {renderHeader('主题与个性化')}
         <div className="flex-1 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
               <h2 className="text-sm font-bold text-slate-700 mb-4">全局主题颜色</h2>
               <div className="grid grid-cols-4 gap-3">
                 {THEMES.map(t => (
                   <button 
                     key={t.id}
                     onClick={() => setLocalSettings({...localSettings, osTheme: t.id})}
                     className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                       localSettings.osTheme === t.id ? 'border-blue-500 scale-105 shadow-md' : 'border-transparent'
                     } ${t.bg}`}
                   >
                     <span className={`text-xs font-bold ${t.id === 'black' ? 'text-white' : 'text-slate-800'}`}>{t.name}</span>
                   </button>
                 ))}
               </div>
            </div>
         </div>
       </div>
     );
  }

  if (view === 'persona') {
     return (
       <div className="h-full flex flex-col bg-slate-50">
         {renderHeader('我的设定')}
         <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              {['name', 'age', 'birthDate', 'profession', 'identity', 'appearance', 'experience'].map((key) => (
                <div key={key}>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    {key === 'name' ? '名字' : key === 'age' ? '年龄' : key === 'birthDate' ? '出生日期' : key === 'profession' ? '职业' : key === 'identity' ? '身份' : key === 'appearance' ? '外貌' : '经历'}
                  </label>
                  <input
                    type="text"
                    value={(localSettings.persona as any)[key]}
                    onChange={e => setLocalSettings({
                      ...localSettings,
                      persona: { ...localSettings.persona, [key]: e.target.value }
                    })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                    placeholder={key === 'birthDate' ? 'YYYY-MM-DD' : ''}
                  />
                </div>
              ))}
            </div>
         </div>
       </div>
     );
  }

  if (view === 'personalize') {
     return (
       <div className="h-full flex flex-col bg-slate-50">
         {renderHeader('系统显示及其他')}
         <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">锁屏壁纸 (可选择图片或双击移除)</label>
                <ImageUploader onImageSelected={url => setLocalSettings({...localSettings, lockscreenWallpaper: url})}>
                   <div 
                     onDoubleClick={() => setLocalSettings({...localSettings, lockscreenWallpaper: ''})}
                     className="w-full h-32 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 bg-cover bg-center cursor-pointer hover:bg-slate-100 transition-colors"
                     style={localSettings.lockscreenWallpaper ? { backgroundImage: `url(${localSettings.lockscreenWallpaper})` } : {}}
                   >
                     {!localSettings.lockscreenWallpaper && <span className="text-sm">点击选择图片或双击清除</span>}
                   </div>
                </ImageUploader>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">主界面壁纸 (可选择图片或双击移除)</label>
                <ImageUploader onImageSelected={url => setLocalSettings({...localSettings, wallpaper: url})}>
                   <div 
                     onDoubleClick={() => setLocalSettings({...localSettings, wallpaper: ''})}
                     className="w-full h-32 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 bg-cover bg-center cursor-pointer hover:bg-slate-100 transition-colors"
                     style={localSettings.wallpaper ? { backgroundImage: `url(${localSettings.wallpaper})` } : {}}
                   >
                     {!localSettings.wallpaper && <span className="text-sm">点击选择图片或双击清除</span>}
                   </div>
                </ImageUploader>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">锁屏密码 (留空则无密码)</label>
                <input 
                  type="text" 
                  maxLength={6}
                  value={localSettings.passcode}
                  onChange={e => setLocalSettings({...localSettings, passcode: e.target.value.replace(/[^0-9]/g, '')})}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white"
                  placeholder="4位或6位数字"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold text-slate-700">双语模式 (中英双语回复)</span>
                <input 
                  type="checkbox" 
                  checked={localSettings.bilingual}
                  onChange={e => setLocalSettings({...localSettings, bilingual: e.target.checked})}
                  className="w-5 h-5 accent-blue-500"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-sm font-bold text-slate-700">底部毛玻璃横条</div>
                  <div className="text-xs text-slate-400 mt-1">开启后主页面底部会常驻显示 Dock</div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.showDock !== false}
                  onChange={e => setLocalSettings({ ...localSettings, showDock: e.target.checked })}
                  className="w-5 h-5 accent-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">系统时间偏移 (分钟)</label>
                <input 
                  type="number" 
                  value={localSettings.timeOffsetMinutes || 0}
                  onChange={e => setLocalSettings({...localSettings, timeOffsetMinutes: parseInt(e.target.value) || 0})}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="border-t border-slate-100 pt-4 mt-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">自定义全局字体</label>
                <p className="text-xs text-slate-400 mb-3">支持 TTF、WOFF、WOFF2、OTF 格式。上传后整个界面字体都会改变（已设特殊字体的地方除外）。</p>
                {localSettings.customFontName ? (
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔤</span>
                        <span className="font-medium text-slate-700">{localSettings.customFontName || '自定义字体'}</span>
                      </div>
                      <button
                        onClick={async () => {
                          await removeInjectedFont(localSettings.customFontName);
                          setLocalSettings({...localSettings, customFontData: undefined, customFontName: undefined});
                        }}
                        className="px-4 py-1.5 bg-red-500 text-white text-sm rounded-lg font-medium"
                      >
                        移除
                      </button>
                    </div>
                    <div className="text-xs text-slate-400 bg-white rounded-lg p-3 border border-slate-200 break-all line-clamp-2">
                      {localSettings.customFontName || '已加载字体'}
                    </div>
                    <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                      <span>✓</span> 字体已加载
                    </p>
                  </div>
                ) : (
                  <>
                  <label htmlFor="font-file-input" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                    <span className="text-2xl mb-1">📁</span>
                    <span className="text-sm text-slate-500">点击选择字体文件</span>
                    <input
                      id="font-file-input"
                      type="file"
                      accept=".ttf,.woff,.woff2,.otf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setFontError(null);
                        if (file.size > 50 * 1024 * 1024) {
                          setFontError('字体文件太大，请选择 50MB 以内的文件');
                          e.target.value = '';
                          return;
                        }
                        const name = file.name;
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const arrayBuffer = ev.target?.result as ArrayBuffer;
                          if (!arrayBuffer) {
                            setFontError('读取字体文件失败');
                            return;
                          }
                          try {
                            // 直接注入 ArrayBuffer（FontFace API 原生支持，无 URL 长度问题）
                            await injectFont(name, arrayBuffer);
                            // 保存原始数据到 IndexedDB（无 base64 开销）
                            await saveFontData(name, arrayBuffer);
                            setLocalSettings({...localSettings, customFontName: name, customFontData: undefined});
                          } catch (err) {
                            console.error('[Font] error:', err);
                            setFontError('应用字体失败，请重试');
                          }
                        };
                        reader.onerror = () => {
                          setFontError('读取字体文件失败，请重试');
                        };
                        reader.readAsArrayBuffer(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {fontError && (
                    <p className="text-sm text-red-500 mt-1">{fontError}</p>
                  )}
                  </>
                )}
              </div>
            </div>
         </div>
       </div>
     );
  }

  const appsList = [
    { id: 'wechat', defaultName: '微信' },
    { id: 'music', defaultName: '音乐' },
    { id: 'settings', defaultName: '设置' },
    { id: 'tarot', defaultName: '占星' },
    { id: 'bottle', defaultName: '漂流瓶' },
    { id: 'worldbook', defaultName: '世界书' },
    { id: 'liarsbar', defaultName: '骗子酒馆' },
    { id: 'jubensha', defaultName: '剧本杀' },
    { id: 'ifapp', defaultName: 'IF' },
    { id: 'vocab', defaultName: '单词' },
    { id: 'copet', defaultName: '共养' },
    { id: 'focus', defaultName: '陪伴' },
    { id: 'reader', defaultName: '阅读' },
    { id: 'calendar', defaultName: '日历' },
    { id: 'billing', defaultName: '记账' },
    { id: 'beautify', defaultName: '美化' },
    { id: 'news', defaultName: '日报' },
    { id: 'desktoppet', defaultName: '桌宠' },
    { id: 'writing', defaultName: '写作' },
    { id: 'diary', defaultName: '日记' },
    { id: 'couplediary', defaultName: '情侣日记' },
    { id: 'movie', defaultName: '电影' },
    { id: 'mailbox', defaultName: '信箱' },
    { id: 'forum', defaultName: '论坛' },
    { id: 'memory', defaultName: '记忆' },
    { id: 'hunter', defaultName: '猎心' },
    { id: 'marriage', defaultName: '婚姻' },
    { id: 'weather', defaultName: '天气' },
  ].sort((a, b) => a.defaultName.localeCompare(b.defaultName, 'zh-CN'));

  if (view === 'appnames') {
     return (
       <div className="h-full flex flex-col bg-slate-50">
         {renderHeader('重新命名应用')}
         <div className="flex-1 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              {appsList.map(app => (
                <div key={app.id}>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{app.defaultName} (默认名称)</label>
                  <input 
                    type="text" 
                    value={localSettings.appNameOverrides?.[app.id] || ''}
                    onChange={e => setLocalSettings({
                      ...localSettings, 
                      appNameOverrides: { ...(localSettings.appNameOverrides || {}), [app.id]: e.target.value }
                    })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                    placeholder="留空使用默认名称"
                  />
                </div>
              ))}
            </div>
         </div>
       </div>
     );
  }

  if (view === 'icons') {
     return (
       <div className="h-full flex flex-col bg-slate-50">
         {renderHeader('自定义应用图标')}
         <div className="flex-1 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <p className="text-xs text-slate-500 mb-2">支持填图片 URL，也支持直接上传本机图片</p>
              {appsList.map(app => (
                <div key={app.id} className="border border-slate-100 rounded-2xl p-3">
                  <label className="block text-sm font-bold text-slate-700 mb-1">{app.defaultName}</label>
                  {localSettings.appIcons?.[app.id] && (
                    <div className="mb-3 w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={localSettings.appIcons?.[app.id]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <input 
                    type="text" 
                    value={localSettings.appIcons?.[app.id] || ''}
                    onChange={e => setLocalSettings({
                      ...localSettings, 
                      appIcons: { ...(localSettings.appIcons || {}), [app.id]: e.target.value }
                    })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                    placeholder="留空使用默认图标"
                  />
                  <div className="flex gap-2 mt-3">
                    <ImageUploader
                      onImageSelected={(url) => setLocalSettings({
                        ...localSettings,
                        appIcons: { ...(localSettings.appIcons || {}), [app.id]: url }
                      })}
                    >
                      <button type="button" className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">
                        上传本机图片
                      </button>
                    </ImageUploader>
                    <button
                      type="button"
                      onClick={() => setLocalSettings({
                        ...localSettings,
                        appIcons: { ...(localSettings.appIcons || {}), [app.id]: '' }
                      })}
                      className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-sm font-bold"
                    >
                      清空
                    </button>
                  </div>
                </div>
              ))}
            </div>
         </div>
       </div>
     );
  }

  if (view === 'fullscreen') {
     return (
       <div className="h-full flex flex-col bg-slate-50">
         {renderHeader('全屏显示')}
         <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                开启全屏显示后，浏览器地址栏和工具栏将被隐藏，内容铺满整个屏幕。<br />
                退出全屏可再次点击此按钮或按手机系统返回手势 / Esc 键。
              </p>
              <button
                onClick={() => {
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                  } else {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                }}
                className="w-full flex items-center justify-between px-5 py-4 bg-white border border-slate-200 rounded-xl active:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 font-medium text-slate-700">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </div>
                  {fs ? '退出全屏' : '进入全屏'}
                </div>
                <div className={`px-3 py-1 rounded-lg text-sm font-bold ${
                  fs
                    ? 'bg-red-500 text-white'
                    : 'bg-blue-500 text-white'
                }`}>
                  {fs ? '退出' : '进入'}
                </div>
              </button>
            </div>
         </div>
       </div>
     );
  }

  return null;
}
