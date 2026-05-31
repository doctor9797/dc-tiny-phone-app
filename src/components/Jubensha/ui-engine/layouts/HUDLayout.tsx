import { motion } from 'motion/react';
import { ChevronLeft, BookOpen, Flag, Search, Send, Cpu, Terminal } from 'lucide-react';
import type { LayoutProps } from '../types';

export default function HUDLayout({
  preset, config, caseData, messages, visibleClues, locations, selectedLocation,
  accusedCharacterId, phase, isAiTyping, showControls, script, showScriptModal,
  characters, selectedCharIds, userRole, onBack, onSend, onInterrogate,
  onInvestigate, onAdvancePhase, onAccuse, onSetAccused, onSetInterrogateTarget,
  onSetLocation, onToggleControls,
  onToggleScript, onSetInput, input, interrogateTarget, messagesEndRef,
}: LayoutProps) {
  const phaseLabels: Record<string, string> = {
    intro: 'INIT', investigation1: 'SCAN_01', discussion: 'LINK',
    investigation2: 'SCAN_02', final_vote: 'JUDGE',
  };

  return (
    <div className="h-full flex flex-col bg-[#050510] font-mono relative text-[#0ff]">
      {/* Grid BG */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-fuchsia-900/20 blur-[100px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-900/15 blur-[80px] mix-blend-screen pointer-events-none" />

      {/* Status bar */}
      <div className="relative z-10 border-b border-[#0ff]/20 bg-black/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2 text-[10px] text-[#0ff]/50">
          <span className="flex items-center gap-1"><Cpu size={10} className="text-fuchsia-400" /> SYS:ONLINE</span>
          <span className="text-fuchsia-400 tracking-widest text-xs">{'>'}{phaseLabels[phase] || phase}{'<'}</span>
          <span className="text-[10px]">NODE:{config.background}</span>
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <button onClick={onBack} className="text-[#0ff]/50 hover:text-[#0ff]"><ChevronLeft size={20} /></button>
          <h1 className="text-[10px] uppercase tracking-widest text-fuchsia-400">{config.background} / {config.theme}</h1>
          <button onClick={onToggleScript} className="text-[#0ff]/50 hover:text-[#0ff]"><BookOpen size={16} /></button>
        </div>
      </div>

      {/* Dashboard */}
      <div className="relative z-10 flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
        {/* Role data panel */}
        {caseData && (
          <div className="border border-[#0ff]/15 bg-black/60">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#0ff]/10 bg-[#0ff]/5">
              <Terminal size={10} className="text-fuchsia-400" />
              <span className="text-[10px] uppercase text-fuchsia-400 tracking-widest">PLAYER_DATA</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-[#0ff]/50 text-xs">NAME</span>
              <span className="text-right text-[#0ff]">{userRole?.roleName}</span>
              <span className="text-[#0ff]/50 text-xs">ID</span>
              <span className="text-right text-fuchsia-400">{userRole?.publicIdentity}</span>
              <span className="text-[#0ff]/50 text-xs">TYPE</span>
              <span className="text-right text-[#0ff]">{userRole?.personality}</span>
            </div>
          </div>
        )}

        {/* Agent nodes */}
        {caseData && (
          <div className="border border-[#0ff]/15 bg-black/60">
            <div className="px-3 py-1.5 border-b border-[#0ff]/10 bg-[#0ff]/5">
              <span className="text-[10px] uppercase text-fuchsia-400 tracking-widest">AGENT_NODES [{caseData.roles.filter((r: any) => r.playerId !== 'user').length}]</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {caseData.roles.filter((r: any) => r.playerId !== 'user').map((role: any) => (
                <div key={role.playerId}
                  className="border border-[#0ff]/10 bg-black/40 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[#0ff] font-bold truncate">{role.roleName}</span>
                    <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                      <span className="w-1 h-1 bg-green-400 rounded-full shadow-[0_0_4px_#4ade80]" />ON
                    </span>
                  </div>
                  <div className="text-xs text-[#0ff]/50 truncate">{characters[role.playerId]?.name} 饰 · {role.publicIdentity}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clues */}
        {visibleClues.length > 0 && (
          <div className="border border-[#0ff]/15 bg-black/60">
            <div className="px-3 py-1.5 border-b border-[#0ff]/10 bg-[#0ff]/5">
              <span className="text-[10px] uppercase text-fuchsia-400 tracking-widest">EVIDENCE [{visibleClues.length}]</span>
            </div>
            <div className="p-3 space-y-2">
              {visibleClues.map((clue: any) => (
                <div key={clue.id} className="border-l-2 border-fuchsia-500/50 pl-2">
                  <div className="text-sm text-fuchsia-300">{'>'}{clue.title}</div>
                  <div className="text-xs text-[#0ff]/50">{clue.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="border border-[#0ff]/15 bg-black/60">
          <div className="px-3 py-1.5 border-b border-[#0ff]/10 bg-[#0ff]/5">
            <span className="text-[10px] uppercase text-fuchsia-400 tracking-widest">COMM_LOG</span>
          </div>
          <div className="p-3 space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'character' && <span className="text-[10px] text-[#0ff]/40 mb-0.5">{msg.name}</span>}
                <div className={`text-sm max-w-[90%] p-2 leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-200'
                    : msg.role === 'system'
                    ? 'text-[#0ff]/40 text-center italic text-xs'
                    : 'border border-[#0ff]/10 bg-black/40 text-[#0ff]/80'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isAiTyping && <div className="text-[#0ff]/40 text-sm animate-pulse">CONNECTING...</div>}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 border-t border-[#0ff]/20 bg-black/80 backdrop-blur px-3 pt-2 pb-6 space-y-2">
        {showControls && (
          <div className="space-y-1.5">
            <button onClick={onAdvancePhase} disabled={phase === 'final_vote'}
              className="w-full py-2 border border-[#0ff]/30 text-[#0ff] text-xs uppercase tracking-widest
                hover:bg-[#0ff]/10 disabled:opacity-30 transition-all">
              ADVANCE &gt;&gt;
            </button>
            <div className="flex gap-1.5">
              <select value={interrogateTarget || ''} onChange={e => onSetInterrogateTarget(e.target.value || null)}
                className="flex-1 bg-black border border-[#0ff]/20 p-2 text-xs text-[#0ff] outline-none">
                <option value="">INTERROGATE</option>
                {caseData?.roles.filter((r: any) => r.playerId !== 'user').map((role: any) => (
                  <option key={role.playerId} value={role.playerId}>{role.roleName}（{characters[role.playerId]?.name}）</option>
                ))}
              </select>
              <button onClick={() => onInterrogate(interrogateTarget)} disabled={!interrogateTarget}
                className="px-3 border border-[#0ff]/30 text-[#0ff] disabled:opacity-30">
                盘问
              </button>
            </div>
            <div className="flex gap-1.5">
              <select value={selectedLocation} onChange={e => onSetLocation(e.target.value)}
                className="flex-1 bg-black border border-[#0ff]/20 p-2 text-xs text-[#0ff] outline-none">
                {locations.map((l: string) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button onClick={onInvestigate} disabled={!(phase === 'investigation1' || phase === 'investigation2')}
                className="px-3 border border-[#0ff]/30 text-[#0ff] disabled:opacity-30">
                <Search size={14} />
              </button>
            </div>
            <div className="flex gap-1.5">
              <select value={accusedCharacterId || ''} onChange={e => onSetAccused(e.target.value || null)}
                className="flex-1 bg-black border border-[#0ff]/20 p-2 text-xs text-[#0ff] outline-none">
                <option value="">ACCUSE TARGET</option>
                <option value="user">SELF</option>
                {selectedCharIds.map((id: string) => {
                  const role = caseData?.roles.find((r: any) => r.playerId === id);
                  return <option key={id} value={id}>{role?.roleName || characters[id]?.name || id}</option>;
                })}
              </select>
              <button onClick={onAccuse} disabled={!accusedCharacterId || isAiTyping || phase !== 'final_vote'}
                className="px-3 border border-[#0ff] text-[#0ff] disabled:opacity-30">
                <Flag size={14} />
              </button>
            </div>
          </div>
        )}
        <button onClick={onToggleControls}
          className="w-full text-center text-xs text-[#0ff]/50 uppercase tracking-widest">
          {showControls ? 'HIDE' : 'CONTROLS'}
        </button>
        <div className="flex gap-1.5">
          <input value={input} onChange={e => onSetInput(e.target.value)}
            placeholder="TRANSMIT..."
            className="flex-1 bg-black border border-[#0ff]/20 p-2.5 text-sm text-[#0ff] outline-none placeholder:text-[#0ff]/30"
          />
          <button onClick={() => onSend(input)} disabled={!input.trim() || isAiTyping}
            className="px-4 border border-[#0ff] text-[#0ff] hover:bg-[#0ff] hover:text-black transition-all disabled:opacity-30">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
