import { motion } from 'motion/react';
import { ChevronLeft, BookOpen, Flag, Search, Send, Sparkles } from 'lucide-react';
import type { LayoutProps } from '../types';

export default function RitualLayout({
  preset, config, caseData, messages, visibleClues, locations, selectedLocation,
  accusedCharacterId, phase, isAiTyping, showControls, script, showScriptModal,
  characters, selectedCharIds, userRole, onBack, onSend, onInterrogate,
  onInvestigate, onAdvancePhase, onAccuse, onSetAccused, onSetInterrogateTarget,
  onSetLocation, onToggleControls,
  onToggleScript, onSetInput, input, interrogateTarget, messagesEndRef,
}: LayoutProps) {
  const phaseNames: Record<string, string> = {
    intro: '启灵', investigation1: '探知', discussion: '议会',
    investigation2: '深窥', final_vote: '裁决',
  };

  return (
    <div className="h-full flex flex-col bg-[#181411] font-serif relative text-[#d4af37]">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,#231d18_0%,#15110d_100%)]" />
      <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 6, repeat: Infinity }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#d4af37]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed inset-2 border border-[#8b6b23]/15 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 text-center border-b border-[#8b6b23]/25 px-4 pt-7 pb-3">
        <motion.div animate={{ rotate: [0, 3, 0, -3, 0] }} transition={{ duration: 8, repeat: Infinity }}
          className="inline-block mb-1">
          <Sparkles size={16} className="text-[#d4af37]/50" />
        </motion.div>
        <div className="flex items-center justify-between absolute left-4 right-4 top-12">
          <button onClick={onBack} className="text-[#8b6b23]/70 hover:text-[#d4af37]"><ChevronLeft size={20} /></button>
          <span />
          <button onClick={onToggleScript} className="text-[#8b6b23]/70 hover:text-[#d4af37]"><BookOpen size={16} /></button>
        </div>
        <div className="text-xs tracking-[0.3em] text-[#8b6b23] uppercase">{phaseNames[phase] || phase}</div>
        <div className="text-[10px] text-[#8b6b23]/60 mt-0.5">{config.background} · {config.theme}</div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
        {/* Character seal */}
        {caseData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="border border-[#8b6b23]/25 bg-[#1d1915] p-4 text-center shadow-[0_0_20px_rgba(139,107,35,0.05)]">
            <div className="w-10 h-10 rounded-full border-2 border-[#d4af37]/30 flex items-center justify-center mx-auto mb-2">
              <div className="w-4 h-4 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/40" />
            </div>
            <div className="text-sm font-bold text-[#d4af37]">{userRole?.roleName}</div>
            <div className="text-xs text-[#8b6b23]/80 mt-1">{userRole?.publicIdentity}</div>
            <div className="text-xs text-[#8b6b23]/60 mt-0.5 italic">"{userRole?.personality}"</div>
          </motion.div>
        )}

        {/* Council members */}
        {caseData && (
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[#8b6b23] text-center mb-3 uppercase">命运之席</div>
            <div className="grid grid-cols-2 gap-2">
              {caseData.roles.filter((r: any) => r.playerId !== 'user').map((role: any, i: number) => (
                <motion.div key={role.playerId}
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="bg-[#1d1915] border border-[#8b6b23]/25 p-3
                    shadow-[0_0_15px_rgba(139,107,35,0.03)]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs">{['✦', '◈', '♛', '◇'][i % 4]}</span>
                    <span className="text-sm font-bold text-[#d4af37]">{role.roleName}</span>
                  </div>
                  <div className="text-xs text-[#8b6b23]/70">{characters[role.playerId]?.name} 饰 · {role.publicIdentity}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Clues */}
        {visibleClues.length > 0 && (
          <div className="border border-[#8b6b23]/25 bg-[#1d1915] p-4">
            <div className="text-[10px] tracking-[0.3em] text-[#8b6b23] text-center mb-3 uppercase">启示碎片</div>
            <div className="space-y-2">
              {visibleClues.map((clue: any) => (
                <div key={clue.id} className="border-l-2 border-[#d4af37]/30 pl-3">
                  <div className="text-sm text-[#e5c76b] font-bold">{clue.title}</div>
                  <div className="text-xs text-[#8b6b23]/80 mt-0.5">{clue.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="border border-[#8b6b23]/20 bg-[#1d1915] p-3">
          <div className="text-[10px] tracking-[0.3em] text-[#8b6b23] text-center mb-3 uppercase">灵音</div>
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'character' && <span className="text-[10px] text-[#8b6b23]/70 mb-0.5">{msg.name}</span>}
                <div className={`text-sm max-w-[88%] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#d4af37]/10 border border-[#d4af37]/30 p-3 text-[#e5c76b]'
                    : msg.role === 'system'
                    ? 'text-[#8b6b23]/60 text-center italic text-xs'
                    : 'border border-[#8b6b23]/20 bg-black/30 p-3 text-[#d4af37]/80'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isAiTyping && <div className="text-[#8b6b23]/60 text-sm text-center animate-pulse">· · ·</div>}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 border-t border-[#8b6b23]/25 bg-[#181411] px-4 pt-3 pb-6 space-y-3">
        {showControls && (
          <div className="space-y-2">
            <button onClick={onAdvancePhase} disabled={phase === 'final_vote'}
              className="w-full py-2.5 border border-[#d4af37] text-[#d4af37] text-xs tracking-[0.3em] uppercase
                shadow-[0_0_15px_rgba(212,175,55,0.05)] hover:shadow-[0_0_25px_rgba(212,175,55,0.15)]
                hover:bg-[#d4af37]/5 disabled:opacity-30 transition-all">
              ～ 推进 ～
            </button>
            <div className="flex gap-2">
              <select value={interrogateTarget || ''} onChange={e => onSetInterrogateTarget(e.target.value || null)}
                className="flex-1 bg-[#1d1915] border border-[#8b6b23]/25 p-2.5 text-xs text-[#d4af37] outline-none">
                <option value="">问询对象</option>
                {caseData?.roles.filter((r: any) => r.playerId !== 'user').map((role: any) => (
                  <option key={role.playerId} value={role.playerId}>{role.roleName}（{characters[role.playerId]?.name}）</option>
                ))}
              </select>
              <button onClick={() => onInterrogate(interrogateTarget)} disabled={!interrogateTarget}
                className="px-3 border border-[#d4af37]/40 text-[#d4af37] disabled:opacity-30">
                问询
              </button>
            </div>
            <div className="flex gap-2">
              <select value={selectedLocation} onChange={e => onSetLocation(e.target.value)}
                className="flex-1 bg-[#1d1915] border border-[#8b6b23]/25 p-2.5 text-xs text-[#d4af37] outline-none">
                {locations.map((l: string) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button onClick={onInvestigate} disabled={!(phase === 'investigation1' || phase === 'investigation2')}
                className="px-3 border border-[#d4af37]/40 text-[#d4af37] disabled:opacity-30">
                <Search size={16} />
              </button>
            </div>
            <div className="flex gap-2">
              <select value={accusedCharacterId || ''} onChange={e => onSetAccused(e.target.value || null)}
                className="flex-1 bg-[#1d1915] border border-[#8b6b23]/25 p-2.5 text-xs text-[#d4af37] outline-none">
                <option value="">裁决对象</option>
                <option value="user">自我</option>
                {selectedCharIds.map((id: string) => {
                  const role = caseData?.roles.find((r: any) => r.playerId === id);
                  return <option key={id} value={id}>{role?.roleName || characters[id]?.name || id}</option>;
                })}
              </select>
              <button onClick={onAccuse} disabled={!accusedCharacterId || isAiTyping || phase !== 'final_vote'}
                className="px-3 border border-[#d4af37] text-[#d4af37] disabled:opacity-30">
                <Flag size={16} />
              </button>
            </div>
          </div>
        )}
        <button onClick={onToggleControls}
          className="w-full text-center text-xs text-[#8b6b23]/70 tracking-[0.3em] uppercase">
          {showControls ? '闭帘' : '开阵'}
        </button>
        <div className="flex gap-2">
          <input value={input} onChange={e => onSetInput(e.target.value)}
            placeholder="诉说..."
            className="flex-1 bg-[#1d1915] border border-[#8b6b23]/25 p-3 text-sm text-[#d4af37] outline-none placeholder:text-[#8b6b23]/60"
          />
          <button onClick={() => onSend(input)} disabled={!input.trim() || isAiTyping}
            className="px-4 border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37]/10 disabled:opacity-30 transition-all">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
