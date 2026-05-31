import { motion } from 'motion/react';
import { ChevronLeft, BookOpen, Flag, Search, Send } from 'lucide-react';
import type { LayoutProps } from '../types';

function NoiseOverlay() {
  return (
    <motion.div className="fixed inset-0 pointer-events-none opacity-[0.04]"
      animate={{ opacity: [0.03, 0.07, 0.03] }}
      transition={{ duration: 3, repeat: Infinity }}
      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }}
    />
  );
}

export default function BrokenLayout({
  preset, config, caseData, messages, visibleClues, locations, selectedLocation,
  accusedCharacterId, phase, isAiTyping, showControls, script, showScriptModal,
  characters, selectedCharIds, userRole, onBack, onSend, onInterrogate,
  onInvestigate, onAdvancePhase, onAccuse, onSetAccused, onSetInterrogateTarget,
  onSetLocation, onToggleControls,
  onToggleScript, onSetInput, input, interrogateTarget, messagesEndRef,
}: LayoutProps) {
  const vignette = 'bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.9)_100%)]';

  return (
    <div className="h-full flex flex-col bg-[#161412] font-sans relative text-[#8f8f8f]">
      <div className={`fixed inset-0 pointer-events-none ${vignette}`} />
      <NoiseOverlay />
      <motion.div animate={{ opacity: [0.06, 0.15, 0.06] }} transition={{ duration: 5, repeat: Infinity }}
        className="fixed top-1/3 left-1/2 -translate-x-1/2 w-60 h-60 bg-red-800/10 rounded-full blur-[100px] pointer-events-none" />
      <motion.div animate={{ top: ['0%', '100%'] }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        className="fixed left-0 right-0 h-px bg-red-900/30 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 border-b border-[#2a2a2a] px-4 pt-7 pb-3 flex items-center justify-between"
        style={{ transform: 'rotate(-0.2deg)' }}>
        <button onClick={onBack} className="text-[#6a6a6a] hover:text-red-900 transition-colors"><ChevronLeft size={22} /></button>
        <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2.5, repeat: Infinity }}
          className="text-xs text-red-900/60 tracking-widest uppercase">
          {phase}
        </motion.div>
        <button onClick={onToggleScript} className="text-[#6a6a6a] hover:text-red-900 transition-colors"><BookOpen size={18} /></button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
        {/* Role card */}
        {caseData && (
          <div className="border border-[#2a2a2a] bg-[#161412] p-3" style={{ transform: 'rotate(0.3deg)' }}>
            <motion.div animate={{ opacity: [0.8, 0.3, 0.8] }} transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 bg-red-900 rounded-full mb-2" />
            <div className="text-sm font-bold text-[#7a7a7a]">{userRole?.roleName}</div>
            <div className="text-xs text-[#6a6a6a] mt-0.5">{userRole?.publicIdentity} · {userRole?.personality}</div>
            <div className="text-[10px] text-red-900/40 mt-1">ID: CORRUPTED</div>
          </div>
        )}

        {/* Characters */}
        {caseData && (
          <div className="border border-[#2a2a2a] bg-[#161412] p-3" style={{ transform: 'rotate(-0.4deg)' }}>
            <div className="flex items-center gap-2 mb-2">
              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1 h-1 bg-red-900 rounded-full" />
              <span className="text-[10px] text-red-900/60 uppercase tracking-widest">SURVIVORS</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {caseData.roles.filter((r: any) => r.playerId !== 'user').map((role: any, i: number) => (
                <div key={role.playerId}
                  className="border border-[#2a2a2a] bg-[#0f0e0c]/30 p-2"
                  style={{ transform: `rotate(${[0.5, -0.3, 0.8, -0.6][i % 4]}deg)`, marginTop: i % 2 ? '6px' : '0' }}>
                  <div className="text-sm font-bold text-[#7a7a7a]">{role.roleName}</div>
                  <div className="text-xs text-[#6a6a6a] truncate">{characters[role.playerId]?.name} 饰 · {role.publicIdentity}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clues */}
        {visibleClues.length > 0 && (
          <div className="border border-[#2a2a2a] bg-[#161412]" style={{ transform: 'rotate(0.2deg)' }}>
            <div className="px-3 py-1.5 border-b border-[#2a2a2a]">
              <span className="text-[10px] text-red-900/60 uppercase tracking-widest">// EVIDENCE [{visibleClues.length}] //</span>
            </div>
            <div className="p-3 space-y-2">
              {visibleClues.map((clue: any) => (
                <div key={clue.id} className="border-l border-red-900/30 pl-2"
                  style={{ transform: 'skewX(-1deg)' }}>
                  <div className="text-sm text-[#8f8f8f] font-bold">{clue.title}</div>
                  <div className="text-xs text-[#6a6a6a]">{clue.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="border border-[#2a2a2a] bg-[#161412]">
          <div className="px-3 py-1.5 border-b border-[#2a2a2a]">
            <span className="text-[10px] text-red-900/60 uppercase tracking-widest">// COMM_LOG //</span>
          </div>
          <div className="p-3 space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'character' && <span className="text-[10px] text-[#6a6a6a] mb-0.5">{msg.name}</span>}
                <div className={`text-sm max-w-[90%] p-2 leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-red-800/20 border border-red-900/30 text-[#8a8a8a]'
                    : msg.role === 'system'
                    ? 'text-[#6a6a6a] text-center italic text-xs'
                    : 'border border-[#2a2a2a] bg-[#0f0e0c]/30'
                }`} style={msg.role !== 'user' && msg.role !== 'system' ? { transform: `skewX(${i % 2 ? 1 : -1}deg)` } : {}}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isAiTyping && <div className="text-[#6a6a6a] text-sm animate-pulse">TRANSMISSION LOST...</div>}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 border-t border-[#2a2a2a] bg-[#161412] px-3 pt-2 pb-6 space-y-2">
        {showControls && (
          <div className="space-y-1.5">
            <button onClick={onAdvancePhase} disabled={phase === 'final_vote'}
              className="w-full py-2 border border-red-900/40 text-red-900/80 text-xs uppercase tracking-widest
                hover:bg-red-800/20 disabled:opacity-30 transition-all">
              [FORCE_ADVANCE]
            </button>
            <div className="flex gap-1.5">
              <select value={interrogateTarget || ''} onChange={e => onSetInterrogateTarget(e.target.value || null)}
                className="flex-1 bg-[#0f0e0c] border border-[#2a2a2a] p-2 text-xs text-[#6a6a6a] outline-none">
                <option value="">[INTERROGATE]</option>
                {caseData?.roles.filter((r: any) => r.playerId !== 'user').map((role: any) => (
                  <option key={role.playerId} value={role.playerId}>{role.roleName}（{characters[role.playerId]?.name}）</option>
                ))}
              </select>
              <button onClick={() => onInterrogate(interrogateTarget)} disabled={!interrogateTarget}
                className="px-3 border border-red-900/40 text-red-900/80 disabled:opacity-30">
                盘问
              </button>
            </div>
            <div className="flex gap-1.5">
              <select value={selectedLocation} onChange={e => onSetLocation(e.target.value)}
                className="flex-1 bg-[#0f0e0c] border border-[#2a2a2a] p-2 text-xs text-[#6a6a6a] outline-none">
                {locations.map((l: string) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button onClick={onInvestigate} disabled={!(phase === 'investigation1' || phase === 'investigation2')}
                className="px-3 border border-red-900/40 text-red-900/80 disabled:opacity-30">
                <Search size={14} />
              </button>
            </div>
            <div className="flex gap-1.5">
              <select value={accusedCharacterId || ''} onChange={e => onSetAccused(e.target.value || null)}
                className="flex-1 bg-[#0f0e0c] border border-[#2a2a2a] p-2 text-xs text-[#6a6a6a] outline-none">
                <option value="">[ACCUSE]</option>
                <option value="user">SELF</option>
                {selectedCharIds.map((id: string) => {
                  const role = caseData?.roles.find((r: any) => r.playerId === id);
                  return <option key={id} value={id}>{role?.roleName || characters[id]?.name || id}</option>;
                })}
              </select>
              <button onClick={onAccuse} disabled={!accusedCharacterId || isAiTyping || phase !== 'final_vote'}
                className="px-3 border border-red-900 text-red-900 disabled:opacity-30">
                <Flag size={14} />
              </button>
            </div>
          </div>
        )}
        <button onClick={onToggleControls}
          className="w-full text-center text-xs text-[#6a6a6a] uppercase tracking-widest">
          {showControls ? '[HIDE]' : '[CONTROLS]'}
        </button>
        <div className="flex gap-1.5">
          <input value={input} onChange={e => onSetInput(e.target.value)}
            placeholder="TRANSMIT..."
            className="flex-1 bg-[#0f0e0c] border border-[#2a2a2a] p-2.5 text-sm text-[#8f8f8f] outline-none placeholder:text-[#4a4a4a]"
          />
          <button onClick={() => onSend(input)} disabled={!input.trim() || isAiTyping}
            className="px-4 border border-red-900/40 text-red-900/80 hover:bg-red-800/20 disabled:opacity-30 transition-all">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
