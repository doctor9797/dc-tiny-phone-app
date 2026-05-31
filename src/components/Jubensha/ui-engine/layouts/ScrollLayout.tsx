import { motion } from 'motion/react';
import { ChevronLeft, BookOpen, Flag, Search, Send } from 'lucide-react';
import type { LayoutProps } from '../types';

export default function ScrollLayout({
  preset, config, caseData, messages, visibleClues, locations, selectedLocation,
  accusedCharacterId, phase, isAiTyping, showControls, script, showScriptModal,
  characters, selectedCharIds, userRole, onBack, onSend, onInterrogate,
  onInvestigate, onAdvancePhase, onAccuse, onSetAccused, onSetInterrogateTarget,
  onSetLocation, onToggleControls,
  onToggleScript, onSetInput, input, interrogateTarget, messagesEndRef,
}: LayoutProps) {
  const phaseNames: Record<string, string> = {
    intro: '序 · 破冰', investigation1: '壹 · 搜证', discussion: '贰 · 论辩',
    investigation2: '叁 · 再探', final_vote: '肆 · 指认',
  };

  return (
    <div className="h-full flex flex-col bg-[#f4ecd8] font-serif relative text-[#2c2826]">
      <div className="fixed inset-0 opacity-20 pointer-events-none mix-blend-multiply"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'0.05\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23n)\' opacity=\'0.3\'/%3E%3C/svg%3E")', backgroundSize: '200px 200px' }}
      />

      {/* Header */}
      <div className="relative z-10 border-b border-[#2c2826]/15 px-4 pt-7 pb-3 flex items-center justify-between bg-[#f4ecd8]">
        <button onClick={onBack} className="text-[#8a8178]"><ChevronLeft size={24} /></button>
        <div className="absolute left-1/2 -translate-x-1/2 text-xs tracking-[0.2em] text-[#8a1c1c] font-bold">
          {phaseNames[phase] || phase}
        </div>
        <button onClick={onToggleScript} className="text-[#8a8178]"><BookOpen size={20} /></button>
      </div>

      {/* Scroll body */}
      <div className="relative z-10 flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-5">
        {/* Decorative seal */}
        <div className="flex justify-center mb-2">
          <div className="w-8 h-8 rounded-full border border-[#8a1c1c]/40 flex items-center justify-center">
            <span className="text-[10px] text-[#8a1c1c]">卷</span>
          </div>
        </div>

        {/* Role card */}
        {caseData && (
          <div className="border border-[#2c2826]/15 p-4 relative">
            <div className="absolute -top-2.5 left-4 bg-[#f4ecd8] px-2 text-[10px] tracking-widest text-[#8a1c1c]">我的角色</div>
            <div className="text-sm font-bold mt-1">{userRole?.roleName}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[#8a8178]">{userRole?.publicIdentity}</span>
              <span className="text-[#8a1c1c]/40">|</span>
              <span className="text-xs text-[#8a8178]">{userRole?.personality}</span>
            </div>
          </div>
        )}

        {/* Character list */}
        {caseData && (
          <div>
            <div className="text-[10px] tracking-[0.2em] text-[#8a1c1c] mb-2 border-b border-[#2c2826]/10 pb-1">登场人物</div>
            <div className="space-y-2">
              {caseData.roles.filter((r: any) => r.playerId !== 'user').map((role: any) => (
                <div key={role.playerId} className="border-l-2 border-[#8a1c1c]/30 pl-3 py-1">
                  <div>
                    <div className="text-sm font-bold">{role.roleName}</div>
                    <div className="text-xs text-[#8a8178]">{characters[role.playerId]?.name} 饰 · {role.publicIdentity}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clues */}
        {visibleClues.length > 0 && (
          <div>
            <div className="text-[10px] tracking-[0.2em] text-[#8a1c1c] mb-2 border-b border-[#2c2826]/10 pb-1">物证</div>
            <div className="space-y-2">
              {visibleClues.map((clue: any) => (
                <div key={clue.id} className="border border-[#2c2826]/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8a1c1c]" />
                    <span className="text-sm font-bold">{clue.title}</span>
                  </div>
                  <p className="text-xs text-[#8a8178] ml-3.5">{clue.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'character' && (
                <span className="text-[10px] text-[#8a8178] mb-1 ml-1">{msg.name}</span>
              )}
              <div className={`max-w-[85%] text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#8a1c1c] text-[#f4ecd8] p-3'
                  : msg.role === 'system'
                  ? 'text-[#8a8178] text-center italic text-xs'
                  : 'border border-[#2c2826]/20 p-3 bg-white/40'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isAiTyping && <div className="text-[#8a8178] text-sm animate-pulse">· · ·</div>}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 border-t border-[#2c2826]/15 bg-[#f4ecd8] px-4 pt-3 pb-6 space-y-3">
        {showControls && (
          <div className="space-y-2">
            <button onClick={onAdvancePhase} disabled={phase === 'final_vote'}
              className="w-full py-2 border border-[#8a1c1c]/30 text-[#8a1c1c] text-xs tracking-wider
                hover:bg-[#8a1c1c]/10 transition-colors disabled:opacity-40">
              推进阶段
            </button>
            <div className="flex gap-2">
              <select value={interrogateTarget || ''} onChange={e => onSetInterrogateTarget(e.target.value || null)}
                className="flex-1 bg-transparent border border-[#2c2826]/20 p-2 text-xs outline-none">
                <option value="">盘问对象</option>
                {caseData?.roles.filter((r: any) => r.playerId !== 'user').map((role: any) => (
                  <option key={role.playerId} value={role.playerId}>{role.roleName}（{characters[role.playerId]?.name}）</option>
                ))}
              </select>
              <button onClick={() => onInterrogate(interrogateTarget)} disabled={!interrogateTarget}
                className="px-3 border border-[#8a1c1c]/30 text-[#8a1c1c] disabled:opacity-40">
                盘问
              </button>
            </div>
            <div className="flex gap-2">
              <select value={selectedLocation} onChange={e => onSetLocation(e.target.value)}
                className="flex-1 bg-transparent border border-[#2c2826]/20 p-2 text-xs outline-none">
                {locations.map((l: string) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button onClick={onInvestigate} disabled={!(phase === 'investigation1' || phase === 'investigation2')}
                className="px-3 border border-[#8a1c1c]/30 text-[#8a1c1c] disabled:opacity-40">
                <Search size={16} />
              </button>
            </div>
            <div className="flex gap-2">
              <select value={accusedCharacterId || ''} onChange={e => onSetAccused(e.target.value || null)}
                className="flex-1 bg-transparent border border-[#2c2826]/20 p-2 text-xs outline-none">
                <option value="">指认对象</option>
                <option value="user">我自己</option>
                {selectedCharIds.map((id: string) => {
                  const role = caseData?.roles.find((r: any) => r.playerId === id);
                  return <option key={id} value={id}>{role?.roleName || characters[id]?.name || id}</option>;
                })}
              </select>
              <button onClick={onAccuse} disabled={!accusedCharacterId || isAiTyping || phase !== 'final_vote'}
                className="px-3 border border-[#8a1c1c] text-[#8a1c1c] disabled:opacity-40">
                <Flag size={16} />
              </button>
            </div>
          </div>
        )}
        <button onClick={onToggleControls}
          className="w-full text-center text-xs text-[#8a8178] tracking-wider">
          {showControls ? '收起' : '操作'}
        </button>
        <div className="flex gap-2">
          <input value={input} onChange={e => onSetInput(e.target.value)}
            placeholder="输入..."
            className="flex-1 bg-transparent border border-[#2c2826]/20 p-3 text-sm outline-none"
          />
          <button onClick={() => onSend(input)} disabled={!input.trim() || isAiTyping}
            className="px-4 border border-[#8a1c1c] text-[#8a1c1c] disabled:opacity-40">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
