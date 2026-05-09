import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { format } from 'date-fns';
import { Plus, Users } from 'lucide-react';
import { ChatGroup, Message } from '../../types';

export default function ChatList({ onOpenChat, onOpenGroupChat }: { onOpenChat: (id: string) => void; onOpenGroupChat: (id: string) => void }) {
  const { chats, characters, wechatGroups, createWeChatGroup, settings } = useAppStore();
  const [showOptions, setShowOptions] = useState(false);

  const individualChats = Object.entries(chats)
    .filter(([charId, msgs]) => msgs.length > 0 && characters[charId]?.isWeChatFriend !== false)
    .map(([charId, msgs]) => ({
      type: 'individual' as const,
      id: charId,
      character: characters[charId],
      lastMessage: msgs[msgs.length - 1],
    }));

  const groupChatsList = Object.values(wechatGroups)
    .map(group => ({
      type: 'group' as const,
      id: group.id,
      group: group,
      lastMessage: group.messages[group.messages.length - 1] || { text: '暂无消息', timestamp: Date.now() } as Message
    }));

  const chatList = [...individualChats, ...groupChatsList]
    .sort((a, b) => {
      const aStarred = a.type === 'individual' && a.character?.isStarred;
      const bStarred = b.type === 'individual' && b.character?.isStarred;
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      return b.lastMessage.timestamp - a.lastMessage.timestamp;
    });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      <div className="bg-gray-100 dark:bg-black px-4 pt-14 pb-3 flex items-center justify-between relative dark:border-white/5 border-b shrink-0 z-10 transition-colors">
        <div className="w-8"></div>
        <h1 className="text-lg font-medium dark:text-gray-100">微信</h1>
        <button onClick={() => setShowOptions(!showOptions)} className="w-8 flex justify-end text-slate-800 dark:text-gray-100 cursor-pointer">
           <Plus size={24} />
        </button>
        {showOptions && (
           <div className="absolute top-16 right-4 bg-slate-800 dark:bg-[#2c2c2c] text-white rounded-lg py-2 z-50 shadow-xl shadow-black/20 w-32 animate-fade-in origin-top-right">
              <button 
                className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700 dark:hover:bg-white/10 active:bg-slate-600"
                onClick={() => {
                   setShowOptions(false);
                   const id = 'group_' + Date.now();
                   createWeChatGroup({
                      id,
                      name: '新建群聊',
                      members: ['user'],
                      messages: [],
                      autonomous: false,
                      memberAliases: {}
                   });
                   onOpenGroupChat(id);
                }}
              >
                 <Users size={16} /> 发起群聊
              </button>
           </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto" onClick={() => setShowOptions(false)}>
        {chatList.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
            暂无聊天记录
          </div>
        ) : (
          chatList.map((item) => {
            if (item.type === 'individual') {
              const { character, lastMessage } = item;
              return (
                <div 
                  key={`ind_${item.id}`} 
                  onClick={() => onOpenChat(item.id)}
                  className={`flex items-center p-3 border-b dark:border-white/5 cursor-pointer active:bg-gray-100 dark:active:bg-white/5 ${character.isStarred ? 'bg-gray-50 dark:bg-[#191919]' : ''}`}
                >
                  <div 
                    className="w-12 h-12 rounded-md flex-shrink-0"
                    style={{ background: character.avatar.startsWith('#') ? character.avatar : `url(${character.avatar}) center/cover` }}
                  />
                  <div className="ml-3 flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{character.remark || character.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{format(lastMessage.timestamp, 'HH:mm')}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {lastMessage.text}
                    </div>
                  </div>
                </div>
              );
            } else {
              const { group, lastMessage } = item;
              return (
                <div 
                  key={`grp_${item.id}`} 
                  onClick={() => onOpenGroupChat(item.id)}
                  className={`flex items-center p-3 border-b dark:border-white/5 cursor-pointer active:bg-gray-100 dark:active:bg-white/5`}
                >
                  <div className="w-12 h-12 rounded-md flex-shrink-0 bg-gray-200 dark:bg-zinc-700 grid grid-cols-2 gap-0.5 p-1">
                     {group.members.slice(0, 4).map((m, i) => {
                        const avatar = m === 'user' ? settings.wechatAvatar : characters[m]?.avatar;
                        return (
                          <div key={i} className="w-full h-full rounded-[2px]" style={{ background: avatar?.startsWith('#') ? avatar : `url(${avatar}) center/cover` }} />
                        )
                     })}
                  </div>
                  <div className="ml-3 flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{group.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{format(lastMessage.timestamp, 'HH:mm')}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {lastMessage.text}
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
}
