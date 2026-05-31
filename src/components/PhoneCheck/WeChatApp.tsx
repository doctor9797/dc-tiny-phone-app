import { useState } from 'react';
import { MessageCircle, Users, Compass, User, ChevronLeft } from 'lucide-react';
import type { PhoneCheckData, PhoneCheckMoments } from './data';
import ChatsList from './ChatsList';
import ChatView from './ChatView';
import ContactsApp from './ContactsApp';
import MomentsApp from './MomentsApp';
import DiscoverApp from './DiscoverApp';
import ProfileApp from './ProfileApp';

interface Props {
  phoneData: PhoneCheckData;
  moments: PhoneCheckMoments;
  ownerName: string;
  ownerAvatar: string;
  ownerPersonality: string;
  ownerCover?: string;
  callerName: string;
  callerRelation: string;
  isDark: boolean;
  onBack: () => void;
  onSendMessage: (contactId: string, text: string) => void;
  onPostMoment: (content: string) => void;
}

export default function WeChatApp({ phoneData, moments, ownerName, ownerAvatar, ownerCover, ownerPersonality, callerName, callerRelation, isDark, onBack, onSendMessage, onPostMoment }: Props) {
  const [tab, setTab] = useState<'chats' | 'contacts' | 'discover' | 'me'>('chats');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showMoments, setShowMoments] = useState(false);

  const activeContact = activeChatId
    ? phoneData.contacts.find(c => c.id === activeChatId) || null
    : null;

  if (activeContact) {
    return (
      <ChatView
        contact={activeContact}
        ownerName={ownerName}
        ownerPersonality={ownerPersonality}
        callerName={callerName}
        callerRelation={callerRelation}
        isDark={isDark}
        onBack={() => setActiveChatId(null)}
        onSendMessage={onSendMessage}
      />
    );
  }

  // Moments full screen view (from discover->moments)
  if (showMoments) {
    return (
      <div className="w-full h-full flex flex-col">
        <MomentsApp
          posts={moments.posts}
          ownerName={ownerName}
          ownerAvatar={ownerAvatar}
          ownerCover={ownerCover}
          isDark={isDark}
          onBack={() => setShowMoments(false)}
          onPost={onPostMoment}
        />
      </div>
    );
  }

  return (
    <div className={'w-full h-full flex flex-col ' + (isDark ? 'bg-black text-white' : 'bg-white text-black')}>
      {/* Header */}
      <div className={'px-4 py-3 flex items-center justify-between border-b shrink-0 ' + (isDark ? 'bg-[#191919] border-white/5' : 'bg-gray-50 border-gray-200')}>
        <button onClick={onBack} className="p-1 -ml-1">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-medium text-[17px]">
          {tab === 'chats' ? '微信' : tab === 'contacts' ? '通讯录' : tab === 'discover' ? '发现' : '我'}
        </h1>
        <div className="w-8" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'chats' && <ChatsList contacts={phoneData.contacts} isDark={isDark} onOpenChat={setActiveChatId} />}
        {tab === 'contacts' && <ContactsApp contacts={phoneData.contacts} isDark={isDark} onOpenChat={setActiveChatId} />}
        {tab === 'discover' && <DiscoverApp isDark={isDark} onOpenMoments={() => setShowMoments(true)} />}
        {tab === 'me' && <ProfileApp ownerName={ownerName} ownerAvatar={ownerAvatar} isDark={isDark} />}
      </div>

      {/* Bottom Tab Bar */}
      <div className={'h-14 pb-1 border-t flex justify-around items-center text-[10px] shrink-0 ' + (isDark ? 'bg-[#191919] border-white/5' : 'bg-gray-50 border-gray-200')}>
        <button onClick={() => setTab('chats')} className={'flex flex-col items-center ' + (tab === 'chats' ? 'text-[#07C160]' : '') + ' ' + (isDark ? 'text-gray-400' : 'text-gray-500')}>
          <MessageCircle size={22} className="mb-0.5" />
          <span>微信</span>
        </button>
        <button onClick={() => setTab('contacts')} className={'flex flex-col items-center ' + (tab === 'contacts' ? 'text-[#07C160]' : '') + ' ' + (isDark ? 'text-gray-400' : 'text-gray-500')}>
          <Users size={22} className="mb-0.5" />
          <span>通讯录</span>
        </button>
        <button onClick={() => setTab('discover')} className={'flex flex-col items-center ' + (tab === 'discover' ? 'text-[#07C160]' : '') + ' ' + (isDark ? 'text-gray-400' : 'text-gray-500')}>
          <Compass size={22} className="mb-0.5" />
          <span>发现</span>
        </button>
        <button onClick={() => setTab('me')} className={'flex flex-col items-center ' + (tab === 'me' ? 'text-[#07C160]' : '') + ' ' + (isDark ? 'text-gray-400' : 'text-gray-500')}>
          <User size={22} className="mb-0.5" />
          <span>我</span>
        </button>
      </div>
    </div>
  );
}
