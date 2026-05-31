import { ChevronLeft, BookOpen, Flag, Search, Send } from 'lucide-react';
import type { LayoutProps } from '../types';

export default function MinimalLayout({
  preset, config, caseData, messages, visibleClues, locations, selectedLocation,
  accusedCharacterId, phase, isAiTyping, showControls, script, showScriptModal,
  characters, selectedCharIds, userRole, onBack, onSend, onInterrogate,
  onInvestigate, onAdvancePhase, onAccuse, onSetAccused, onSetInterrogateTarget,
  onSetLocation, onToggleControls,
  onToggleScript, onSetInput, input, interrogateTarget, messagesEndRef,
}: LayoutProps) {
  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-200 font-sans relative">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 pt-7 pb-3 flex items-center justify-between bg-zinc-950">
        <button onClick={onBack} className="text-zinc-500 hover:text-white"><ChevronLeft size={20} /></button>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-zinc-600">{caseData?.caseTitle || '案件'}</span>
          <span className="text-[10px] px-2 py-0.5 border border-zinc-700 text-zinc-400 uppercase tracking-wider">{phase}</span>
        </div>
        <button onClick={onToggleScript} className="text-zinc-500 hover:text-white"><BookOpen size={16} /></button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {/* Role */}
        {caseData && (
          <div className="border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 w-16 shrink-0">角色</span>
              <div>
                <span className="text-white text-sm font-semibold">{userRole?.roleName}</span>
                <span className="text-zinc-500 mx-2">·</span>
                <span className="text-zinc-400 text-xs">{userRole?.publicIdentity}</span>
              </div>
            </div>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 w-16 shrink-0">性格</span>
              <span className="text-zinc-400 text-xs">{userRole?.personality}</span>
            </div>
          </div>
        )}

        {/* Characters */}
        {caseData && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">涉案人员</div>
            <div className="space-y-1">
              {caseData.roles.filter((r: any) => r.playerId !== 'user').map((role: any) => (
                <div key={role.playerId}
                  className="px-4 py-3 bg-zinc-900/30 border border-zinc-800/50">
                  <div>
                    <div className="text-sm font-medium text-white">{role.roleName}</div>
                    <div className="text-xs text-zinc-500">{characters[role.playerId]?.name} 饰 · {role.publicIdentity}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clues */}
        {visibleClues.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">物证 ({visibleClues.length})</div>
            <div className="space-y-2">
              {visibleClues.map((clue: any) => (
                <div key={clue.id} className="border-l-2 border-indigo-500 pl-4 py-2">
                  <div className="text-sm font-medium text-white">{clue.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{clue.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'character' && <span className="text-[10px] text-zinc-500 mb-1">{msg.name}</span>}
              <div className={`max-w-[85%] text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-lg px-4 py-2'
                  : msg.role === 'system'
                  ? 'text-zinc-500 text-center italic text-xs w-full'
                  : 'bg-zinc-800 text-zinc-200 rounded-lg px-4 py-2'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isAiTyping && <div className="text-zinc-500 text-sm animate-pulse">...</div>}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-zinc-800 bg-zinc-950 px-4 pt-3 pb-6 space-y-3">
        {showControls && (
          <div className="space-y-2">
            <button onClick={onAdvancePhase} disabled={phase === 'final_vote'}
              className="w-full py-2.5 bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs uppercase tracking-wider
                hover:bg-zinc-800 transition-colors disabled:opacity-40">
                → 推进阶段
            </button>
            <div className="flex gap-2">
              <select value={interrogateTarget || ''} onChange={e => onSetInterrogateTarget(e.target.value || null)}
                className="flex-1 bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-zinc-300 outline-none">
                <option value="">盘问对象</option>
                {caseData?.roles.filter((r: any) => r.playerId !== 'user').map((role: any) => (
                  <option key={role.playerId} value={role.playerId}>{role.roleName}（{characters[role.playerId]?.name}）</option>
                ))}
              </select>
              <button onClick={() => onInterrogate(interrogateTarget)} disabled={!interrogateTarget}
                className="px-4 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:bg-zinc-800 disabled:opacity-40">
                盘问
              </button>
            </div>
            <div className="flex gap-2">
              <select value={selectedLocation} onChange={e => onSetLocation(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-zinc-300 outline-none">
                {locations.map((l: string) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button onClick={onInvestigate} disabled={!(phase === 'investigation1' || phase === 'investigation2')}
                className="px-4 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:bg-zinc-800 disabled:opacity-40">
                <Search size={16} />
              </button>
            </div>
            <div className="flex gap-2">
              <select value={accusedCharacterId || ''} onChange={e => onSetAccused(e.target.value || null)}
                className="flex-1 bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-zinc-300 outline-none">
                <option value="">指认对象</option>
                <option value="user">我自己</option>
                {selectedCharIds.map((id: string) => {
                  const role = caseData?.roles.find((r: any) => r.playerId === id);
                  return <option key={id} value={id}>{role?.roleName || characters[id]?.name || id}</option>;
                })}
              </select>
              <button onClick={onAccuse} disabled={!accusedCharacterId || isAiTyping || phase !== 'final_vote'}
                className="px-4 bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-500 disabled:opacity-40">
                <Flag size={16} />
              </button>
            </div>
          </div>
        )}
        <button onClick={onToggleControls}
          className="w-full text-center text-xs text-zinc-600 uppercase tracking-wider">
          {showControls ? '收起' : '操作面板'}
        </button>
        <div className="flex gap-2">
          <input value={input} onChange={e => onSetInput(e.target.value)}
            placeholder="输入发言..."
            className="flex-1 bg-zinc-900 border border-zinc-800 p-3 text-sm text-white outline-none placeholder:text-zinc-600"
          />
          <button onClick={() => onSend(input)} disabled={!input.trim() || isAiTyping}
            className="px-5 bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-500 disabled:opacity-40 transition-colors">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
