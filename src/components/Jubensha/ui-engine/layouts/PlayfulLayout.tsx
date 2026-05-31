import { motion } from 'motion/react';
import { ChevronLeft, BookOpen, Flag, Search, Send, Smile } from 'lucide-react';
import type { LayoutProps } from '../types';

export default function PlayfulLayout({
  preset, config, caseData, messages, visibleClues, locations, selectedLocation,
  accusedCharacterId, phase, isAiTyping, showControls, script, showScriptModal,
  characters, selectedCharIds, userRole, onBack, onSend, onInterrogate,
  onInvestigate, onAdvancePhase, onAccuse, onSetAccused, onSetInterrogateTarget,
  onSetLocation, onToggleControls,
  onToggleScript, onSetInput, input, interrogateTarget, messagesEndRef,
}: LayoutProps) {
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-amber-50 via-white to-amber-50 text-zinc-700 font-sans relative">
      {/* Decorative bg elements */}
      <div className="fixed top-0 right-0 w-32 h-32 bg-amber-200/40 rounded-full blur-[60px] pointer-events-none" />
      <div className="fixed bottom-32 left-0 w-24 h-24 bg-pink-200/40 rounded-full blur-[50px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 px-5 pt-7 pb-4 flex items-center justify-between bg-white/60 backdrop-blur border-b border-amber-200/50">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 w-9 h-9 rounded-full flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <motion.div animate={{ rotate: [0, -5, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center gap-2">
          <Smile size={16} className="text-amber-400" />
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{phase}</span>
        </motion.div>
        <button onClick={onToggleScript} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 w-9 h-9 rounded-full flex items-center justify-center">
          <BookOpen size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto min-h-0 px-5 py-5 space-y-4">
        {/* Role card */}
        {caseData && (
          <div className="bg-white rounded-3xl border border-amber-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 to-pink-400 flex items-center justify-center text-white text-xl font-bold shadow-md">
                {userRole?.roleName?.charAt(0) || '?'}
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-700">{userRole?.roleName}</div>
                <div className="text-xs text-zinc-400">{userRole?.publicIdentity}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">{userRole?.personality}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Characters */}
        {caseData && (
          <div className="grid grid-cols-2 gap-2">
            {caseData.roles.filter((r: any) => r.playerId !== 'user').map((role: any, i: number) => (
              <div key={role.playerId}
                className="bg-white rounded-2xl border border-amber-200/40 p-4 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 flex items-center justify-center text-white text-sm font-bold mb-2">
                  {role.roleName?.charAt(0) || '?'}
                </div>
                <div className="text-sm font-bold text-zinc-700">{role.roleName}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{characters[role.playerId]?.name} 饰 · {role.publicIdentity}</div>
              </div>
            ))}
          </div>
        )}

        {/* Clues */}
        {visibleClues.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">🔍 发现的线索</div>
            {visibleClues.map((clue: any) => (
              <div key={clue.id} className="bg-white rounded-2xl border border-amber-200/40 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">📌</span>
                  <span className="text-sm font-bold text-zinc-700">{clue.title}</span>
                </div>
                <p className="text-xs text-zinc-500 ml-7">{clue.detail}</p>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'character' && <span className="text-[10px] text-zinc-400 mb-1 ml-2">{msg.name}</span>}
              {msg.role === 'system' ? (
                <div className="text-xs text-zinc-400 text-center italic w-full py-2">{msg.text}</div>
              ) : (
                <div className={`max-w-[85%] text-sm leading-relaxed px-5 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-2xl rounded-br-md shadow-sm'
                    : 'bg-white border border-amber-200/50 rounded-2xl rounded-bl-md shadow-sm text-zinc-600'
                }`}>
                  {msg.text}
                </div>
              )}
            </div>
          ))}
          {isAiTyping && <div className="text-zinc-400 text-sm animate-bounce ml-2">...</div>}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 border-t border-amber-200/50 bg-white/80 backdrop-blur px-5 pt-3 pb-6 space-y-3">
        {showControls && (
          <div className="space-y-2">
            <button onClick={onAdvancePhase} disabled={phase === 'final_vote'}
              className="w-full py-3 bg-amber-400 text-white rounded-xl font-medium text-xs
                hover:bg-amber-500 transition-colors shadow-sm disabled:opacity-40">
              🎬 推进剧情
            </button>
            <div className="flex gap-2">
              <select value={selectedLocation} onChange={e => onSetLocation(e.target.value)}
                className="flex-1 bg-white border border-amber-200/60 p-3 text-xs text-zinc-600 rounded-xl outline-none">
                {locations.map((l: string) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button onClick={onInvestigate} disabled={!(phase === 'investigation1' || phase === 'investigation2')}
                className="px-4 bg-white border border-amber-300 text-amber-500 rounded-xl hover:bg-amber-50 disabled:opacity-40">
                <Search size={18} />
              </button>
            </div>
            <div className="flex gap-2">
              <select value={accusedCharacterId || ''} onChange={e => onSetAccused(e.target.value || null)}
                className="flex-1 bg-white border border-amber-200/60 p-3 text-xs text-zinc-600 rounded-xl outline-none">
                <option value="">🎯 指认谁？</option>
                <option value="user">我自己</option>
                {selectedCharIds.map((id: string) => {
                  const role = caseData?.roles.find((r: any) => r.playerId === id);
                  return <option key={id} value={id}>{role?.roleName || characters[id]?.name || id}</option>;
                })}
              </select>
              <button onClick={onAccuse} disabled={!accusedCharacterId || isAiTyping || phase !== 'final_vote'}
                className="px-4 bg-amber-400 text-white rounded-xl hover:bg-amber-500 disabled:opacity-40 shadow-sm">
                <Flag size={18} />
              </button>
            </div>
          </div>
        )}
        <button onClick={onToggleControls}
          className="w-full text-center text-xs text-zinc-400">
          {showControls ? '收起 ↑' : '操作 ↓'}
        </button>
        <div className="flex gap-2">
          <input value={input} onChange={e => onSetInput(e.target.value)}
            placeholder="说点什么..."
            className="flex-1 bg-white border border-amber-200/60 p-3.5 text-sm text-zinc-700 rounded-xl outline-none placeholder:text-zinc-300"
          />
          <button onClick={() => onSend(input)} disabled={!input.trim() || isAiTyping}
            className="px-5 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-xl shadow-sm hover:shadow-md disabled:opacity-40 transition-all">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
