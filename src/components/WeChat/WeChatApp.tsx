import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Users, Compass, User } from 'lucide-react';
import { useAppStore } from '../../store';
import ChatList from './ChatList';
import Contacts from './Contacts';
import Moments from './Moments';
import Me from './Me';
import ChatRoom from './ChatRoom';
import GroupChatRoom from './GroupChatRoom';
import { generateCharacterMoment } from '../../lib/ai';

export default function WeChatApp() {
  const { settings, updateSettings, characters, addMoment, updateCharacter } = useAppStore();
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'moments' | 'me'>('chats');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeGroupChat, setActiveGroupChat] = useState<string | null>(null);
  const momentsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isDark = settings.wechatTheme === 'dark';

  // Handle opening chat from notification
  React.useEffect(() => {
    if ((settings as any).activeWeChatCharId) {
      setActiveChat((settings as any).activeWeChatCharId);
      setActiveTab('chats');
      updateSettings({ activeWeChatCharId: null } as any);
    }
  }, [(settings as any).activeWeChatCharId, updateSettings]);

  // Auto-generate character moments
  useEffect(() => {
    const checkAndGenerateMoments = async () => {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      for (const [charId, char] of Object.entries(characters)) {
        if (char.isDisabled || char.isWeChatFriend === false) continue;
        if (!char.momentsEnabled) continue;
        
        const frequency = char.momentsFrequency || 2;
        const intervalMs = oneDayMs / frequency;
        const lastMomentAt = char.lastMomentAt || 0;
        
        if (now - lastMomentAt >= intervalMs) {
          try {
            const momentData = await generateCharacterMoment(charId);
            addMoment({
              authorId: charId,
              content: momentData.content,
              imageUrl: momentData.imageUrl,
              location: momentData.location,
            });
            updateCharacter(charId, { lastMomentAt: now });
          } catch (e) {
            console.error(`Failed to generate moment for ${char.name}:`, e);
          }
        }
      }
    };

    // Check every 30 minutes
    momentsTimerRef.current = setInterval(checkAndGenerateMoments, 30 * 60 * 1000);
    
    // Also check on mount
    checkAndGenerateMoments();

    return () => {
      if (momentsTimerRef.current) {
        clearInterval(momentsTimerRef.current);
      }
    };
  }, [characters, addMoment, updateCharacter]);

  if (activeGroupChat) {
    return (
      <div className={`h-full ${isDark ? 'dark bg-black' : 'bg-gray-50'}`}>
         <GroupChatRoom groupId={activeGroupChat} onBack={() => setActiveGroupChat(null)} />
      </div>
    );
  }

  if (activeChat) {
    return (
      <div className={`h-full ${isDark ? 'dark bg-black' : 'bg-gray-50'}`}>
         <ChatRoom characterId={activeChat} onBack={() => setActiveChat(null)} />
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col font-sans transition-colors ${isDark ? 'dark bg-black' : 'bg-gray-50'}`}>
      <div className={`flex-1 overflow-hidden relative ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {activeTab === 'chats' && <ChatList onOpenChat={setActiveChat} onOpenGroupChat={setActiveGroupChat} />}
        {activeTab === 'contacts' && <Contacts onOpenChat={setActiveChat} />}
        {activeTab === 'moments' && <Moments />}
        {activeTab === 'me' && <Me />}
      </div>

      <div className={`h-[54px] flex justify-around items-center border-t shrink-0 z-40 ${isDark ? 'bg-[#191919] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
        <TabButton icon={<MessageCircle />} label="微信" active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} isDark={isDark} />
        <TabButton icon={<Users />} label="通讯录" active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} isDark={isDark} />
        <TabButton icon={<Compass />} label="发现" active={activeTab === 'moments'} onClick={() => setActiveTab('moments')} isDark={isDark} />
        <TabButton icon={<User />} label="我" active={activeTab === 'me'} onClick={() => setActiveTab('me')} isDark={isDark} />
      </div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick, isDark }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, isDark: boolean }) {
  const activeColor = isDark ? '#f3f4f6' : '#374151';
  const inactiveColor = isDark ? '#9ca3af' : '#6b7280';
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center w-full h-full active:opacity-70 transition-opacity" style={{ color: active ? activeColor : inactiveColor }}>
      <div className="mb-0.5">{React.cloneElement(icon as React.ReactElement, { size: 26, strokeWidth: active ? 2.5 : 2 })}</div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
