import { Search } from 'lucide-react';
import type { PhoneContact } from './data';

interface Props {
  contacts: PhoneContact[];
  isDark: boolean;
  onOpenChat: (contactId: string) => void;
}

export default function ChatsList({ contacts, isDark, onOpenChat }: Props) {
  const bg = isDark ? 'text-gray-300' : 'text-gray-900';
  const subBg = isDark ? 'text-gray-500' : 'text-gray-500';

  // Only show contacts with messages, sorted by most recent message
  const chatContacts = contacts
    .filter(c => c.messages.length > 0)
    .sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1].timestamp;
      const bLast = b.messages[b.messages.length - 1].timestamp;
      return bLast - aLast;
    });

  return (
    <div className="h-full overflow-y-auto">
      <div className={`p-3 mx-3 my-2 rounded flex items-center ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
        <Search size={16} className="mr-2" />
        <span className="text-sm">搜索</span>
      </div>
      {chatContacts.length === 0 && (
        <div className={`text-center mt-20 ${subBg}`}>暂无聊天记录</div>
      )}
      {chatContacts.map(contact => {
        const lastMsg = contact.messages[contact.messages.length - 1];
        const timeStr = lastMsg ? formatTime(lastMsg.timestamp) : '';
        return (
          <button
            key={contact.id}
            onClick={() => onOpenChat(contact.id)}
            className={`w-full flex items-center p-4 border-b text-left transition-colors ${
              isDark ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
            }`}
          >
            <div
              className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold mr-3 text-sm"
              style={{ backgroundColor: contact.avatar || '#999' }}
            >
              {contact.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <h3 className={`font-medium text-[15px] truncate ${bg}`}>{contact.name}</h3>
                {timeStr && <span className={`text-[11px] ${subBg} ml-2`}>{timeStr}</span>}
              </div>
              <p className={`text-sm truncate ${subBg}`}>{lastMsg?.text || ''}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
