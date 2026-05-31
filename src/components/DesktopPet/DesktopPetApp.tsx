import React from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Bell, BellOff, Sparkles } from 'lucide-react';

function PixelPreview({ characterId, petColor }: { characterId: string | null; petColor?: string }) {
  const { characters, settings } = useAppStore();
  const char = characterId ? characters[characterId] : null;
  const bodyColor = petColor || char?.avatar || '#c53030';

  return (
    <div style={{ position: 'relative', width: 64, height: 60 }}>
      <div style={{ position: 'absolute', width: 72, height: 11, left: '50%', bottom: -2, transform: 'translateX(-50%)', backgroundColor: '#E5E5E5', borderRadius: 5, opacity: 0.5 }} />
      <div style={{ position: 'absolute', width: 61, height: 45, left: '50%', top: -5, transform: 'translateX(-50%)', backgroundColor: '#ffffff', borderRadius: 21 }} />
      <div style={{ position: 'absolute', width: 48, height: 38, left: '50%', top: 14, transform: 'translateX(-50%)', backgroundColor: bodyColor, borderRadius: 16, boxShadow: '0 3px 6px rgba(0,0,0,0.1)' }} />
      <div style={{ position: 'absolute', width: 12, height: 26, left: 2, top: 26, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 6 }} />
      <div style={{ position: 'absolute', width: 12, height: 26, right: 2, top: 26, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 6 }} />
      <div style={{ position: 'absolute', width: 11, height: 6, left: 14, top: 32, backgroundColor: '#374151', borderRadius: 3 }} />
      <div style={{ position: 'absolute', width: 11, height: 6, right: 14, top: 32, backgroundColor: '#374151', borderRadius: 3 }} />
      <div style={{ position: 'absolute', width: 13, height: 4, left: '50%', top: 43, transform: 'translateX(-50%)', borderRadius: '0 0 6px 6px', borderBottom: '2px solid #374151' }} />
    </div>
  );
}

export default function DesktopPetApp() {
  const { closeApp, characters, settings, updateSettings } = useAppStore();
  const pet = settings.desktopPet || {
    enabled: false,
    characterId: null,
    x: 260,
    y: 360,
    remindMode: false
  };

  const availableChars = Object.values(characters).filter(char => (char as any).isDisabled !== true);

  return (
    <div className="h-full flex flex-col bg-[#fff7f3] text-slate-800">
      <div className="px-4 pt-7 pb-4 flex items-center justify-between border-b border-rose-100">
        <button onClick={closeApp}><ChevronLeft size={28} /></button>
        <div className="font-black tracking-wide">桌宠</div>
        <div className="w-7" />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="rounded-[2rem] bg-white p-5 border border-rose-100 shadow-sm overflow-visible">
          <div className="text-sm text-slate-500 mb-3">当前桌宠</div>
          <div className="flex items-center gap-4">
            <PixelPreview characterId={pet.characterId} petColor={pet.petColor} />
            <div className="flex-1">
              <div className="font-black text-xl mb-1">{pet.characterId ? characters[pet.characterId]?.name : '未选择角色'}</div>
              <div className="text-sm text-slate-500 leading-6">开启后会以Q版像素风小人形式悬浮在桌面上，支持拖动、动作切换、戳一戳和日程提醒。</div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-5 border border-rose-100 shadow-sm">
          <div className="font-bold mb-3">选择角色</div>
          <div className="grid grid-cols-2 gap-3">
            {availableChars.map(char => (
              <button
                key={char.id}
                onClick={() => updateSettings({ desktopPet: { ...pet, characterId: char.id } })}
                className={`p-3 rounded-2xl border text-left ${pet.characterId === char.id ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="font-bold truncate">{char.name}</div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{char.relationship}</div>
              </button>
            ))}
          </div>
          {pet.characterId && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-sm font-bold mb-3">桌宠颜色</div>
              <div className="flex flex-wrap gap-2.5 mb-3">
                {['#c53030', '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#319795', '#3182ce', '#5a67d8', '#805ad5', '#d53f8c', '#718096', '#1a202c'].map(color => (
                  <button
                    key={color}
                    onClick={() => updateSettings({ desktopPet: { ...pet, petColor: color } })}
                    className={`w-7 h-7 rounded-full border-2 transition-all active:scale-90 ${pet.petColor === color ? 'border-slate-600 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">自定义</span>
                <input
                  type="color"
                  value={pet.petColor || '#c53030'}
                  onChange={e => updateSettings({ desktopPet: { ...pet, petColor: e.target.value } })}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs text-slate-400 font-mono">{pet.petColor || '#c53030'}</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => updateSettings({ desktopPet: { ...pet, enabled: !pet.enabled } })}
          className={`w-full rounded-[2rem] p-5 text-left border shadow-sm ${pet.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
        >
          <div className="font-black text-lg">{pet.enabled ? '桌宠已开启' : '开启桌宠'}</div>
          <div className="text-sm text-slate-500 mt-1">开启后，小人会悬浮显示，可被拖动到任意角落。</div>
        </button>

        <button
          onClick={() => updateSettings({ desktopPet: { ...pet, remindMode: !pet.remindMode } })}
          className={`w-full rounded-[2rem] p-5 text-left border shadow-sm ${pet.remindMode ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}
        >
          <div className="flex items-center gap-2 font-black text-lg">
            {pet.remindMode ? <Bell size={20} /> : <BellOff size={20} />}
            消息提示模式
          </div>
          <div className="text-sm text-slate-500 mt-1">开启后，桌宠会根据你在日历里写下的日程，在合适时间主动提醒你。</div>
        </button>

        <div className="rounded-[2rem] bg-white p-5 border border-rose-100 shadow-sm">
          <div className="flex items-center gap-2 font-bold mb-3"><Sparkles size={18} />功能说明</div>
          <div className="space-y-2 text-sm text-slate-500 leading-6">
            <div>1. 桌宠会定时切换动作，包含待机、眨眼、挥手、跳动、被打扰等。</div>
            <div>2. 戳一戳时会出现聊天气泡。</div>
            <div>3. 戳得太频繁时，对应角色会在微信里来找你。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
