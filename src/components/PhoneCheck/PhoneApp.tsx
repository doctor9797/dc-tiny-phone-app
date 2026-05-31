import { useState } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import type { CallLogData } from './data';

interface Props {
  characterId: string;
  character: { name: string; personality: string; biography?: string };
  onHome: () => void;
  callLogData: CallLogData;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}分${s}秒` : `${m}分钟`;
}

function formatCallTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (diff < 172800000) return `昨天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const DIRECTION_CONFIG = {
  incoming: { icon: PhoneIncoming, color: 'text-green-500', label: '来电' },
  outgoing: { icon: PhoneOutgoing, color: 'text-blue-500', label: '去电' },
  missed: { icon: PhoneIncoming, color: 'text-red-500', label: '未接' },
};

export default function PhoneApp({ characterId, character, onHome, callLogData }: Props) {
  const [tab, setTab] = useState<'all' | 'missed'>('all');

  const filtered = tab === 'missed'
    ? callLogData.records.filter(r => r.direction === 'missed')
    : callLogData.records;

  const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="w-full h-full bg-[#f2f2f7] text-black flex flex-col">
      {/* Header */}
      <div className="bg-white flex items-center justify-between px-4 pt-7 pb-3 border-b border-gray-200 shrink-0">
        <button onClick={onHome} className="text-blue-500 text-sm font-medium">返回</button>
        <h1 className="text-[17px] font-semibold">最近通话</h1>
        <div className="w-10" />
      </div>

      {/* Tabs */}
      <div className="bg-white px-4 pb-2 border-b border-gray-200 shrink-0">
        <div className="flex gap-4">
          <button
            onClick={() => setTab('all')}
            className={'text-sm font-medium pb-1 border-b-2 transition-colors ' + (tab === 'all' ? 'text-blue-500 border-blue-500' : 'text-gray-500 border-transparent')}
          >
            全部
          </button>
          <button
            onClick={() => setTab('missed')}
            className={'text-sm font-medium pb-1 border-b-2 transition-colors ' + (tab === 'missed' ? 'text-blue-500 border-blue-500' : 'text-gray-500 border-transparent')}
          >
            未接来电
          </button>
        </div>
      </div>

      {/* Call list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Phone size={40} className="mb-2 opacity-40" />
            <span className="text-sm">暂无通话记录</span>
          </div>
        )}
        {sorted.map((call, i) => {
          const config = DIRECTION_CONFIG[call.direction];
          const Icon = config.icon;
          const isSameContact = i > 0 && sorted[i - 1].contactName === call.contactName;

          return (
            <div key={call.id} className="bg-white flex items-center px-4 py-2.5 border-b border-gray-100">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#c6c6c8] flex items-center justify-center text-white text-sm font-medium shrink-0 mr-3">
                {call.contactName[0]}
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-medium truncate">{call.contactName}</div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Icon size={12} className={config.color} />
                  <span>{isSameContact ? '' : config.label}</span>
                  <span>{formatDuration(call.duration)}</span>
                </div>
              </div>
              {/* Time */}
              <div className="text-xs text-gray-400 ml-3 shrink-0">{formatCallTime(call.timestamp)}</div>
            </div>
          );
        })}
        <div className="h-4" />
      </div>
    </div>
  );
}
