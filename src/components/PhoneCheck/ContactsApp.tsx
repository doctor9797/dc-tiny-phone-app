import type { PhoneContact } from './data';

interface Props {
  contacts: PhoneContact[];
  isDark: boolean;
  onOpenChat: (contactId: string) => void;
}

export default function ContactsApp({ contacts, isDark, onOpenChat }: Props) {
  const bg = isDark ? 'text-gray-300' : 'text-gray-900';
  const subBg = isDark ? 'text-gray-500' : 'text-gray-500';

  return (
    <div className="h-full overflow-y-auto">
      {contacts.length === 0 && (
        <div className={`text-center mt-20 ${subBg}`}>暂无联系人</div>
      )}
      {contacts.map(contact => (
        <button
          key={contact.id}
          onClick={() => onOpenChat(contact.id)}
          className={`w-full flex items-center p-3 border-b text-left transition-colors ${
            isDark ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
          }`}
        >
          <div
            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold mr-3 text-sm"
            style={{ backgroundColor: contact.avatar || '#999' }}
          >
            {contact.name[0]}
          </div>
          <span className={`text-[15px] ${bg}`}>{contact.name}</span>
        </button>
      ))}
    </div>
  );
}
