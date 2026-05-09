import React, { useMemo, useRef } from 'react';
import { useAppStore } from '../../store';
import { UserPlus } from 'lucide-react';
import { pinyin } from 'pinyin-pro';

export default function Contacts({ onOpenChat }: { onOpenChat: (id: string) => void }) {
  const { characters, closeApp, friendRequests, acceptFriendRequest } = useAppStore();
  const listRef = useRef<HTMLDivElement>(null);

  const pendingRequests = friendRequests.filter(r => r.status === 'pending');

  const { starred, grouped, letters } = useMemo(() => {
    const chars = Object.values(characters).filter(c=>(c as any).isDisabled !== true).filter(c => c.isWeChatFriend !== false);
    
    const getPinyinStr = (str: string) => {
      if (!str) return '';
      return pinyin(str, { toneType: 'none', type: 'string' }).replace(/\s/g, '').toUpperCase();
    };

    const starred = chars.filter(c => c.isStarred).sort((a, b) => getPinyinStr(a.remark || a.name).localeCompare(getPinyinStr(b.remark || b.name)));
    
    const grouped: Record<string, typeof chars> = {};
    chars.forEach(c => {
      const name = c.remark || c.name;
      const pinyinStr = getPinyinStr(name);
      let initial = pinyinStr.charAt(0);
      if (!/[A-Z]/.test(initial)) {
        initial = '#';
      }
      if (!grouped[initial]) grouped[initial] = [];
      grouped[initial].push(c);
    });

    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => getPinyinStr(a.remark || a.name).localeCompare(getPinyinStr(b.remark || b.name)));
    });

    const letters = Object.keys(grouped).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });

    return { starred, grouped, letters };
  }, [characters]);

  const scrollToLetter = (letter: string) => {
    const el = document.getElementById(`contact-group-${letter}`);
    if (el && listRef.current) {
      listRef.current.scrollTo({ top: el.offsetTop - 60, behavior: 'smooth' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      <div className="bg-gray-100 dark:bg-black px-4 pt-14 pb-3 flex items-center justify-center relative z-10 transition-colors">
        <h1 className="text-lg font-medium dark:text-gray-100">通讯录</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto" ref={listRef}>
        {pendingRequests.length > 0 && (
          <div className="mb-2">
            <div className="bg-gray-100 dark:bg-[#191919] px-4 py-1 text-xs text-gray-500 dark:text-gray-400">新的朋友</div>
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-3 border-b dark:border-white/5 bg-white dark:bg-[#111111]">
                <div className="flex items-center">
                  <div 
                    className="w-10 h-10 rounded-md flex-shrink-0"
                    style={{ background: (req.characterCard.avatar || '').startsWith('#') ? req.characterCard.avatar : `url(${req.characterCard.avatar}) center/cover` }}
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{req.characterCard.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">请求添加你为朋友</div>
                  </div>
                </div>
                <button 
                  onClick={() => acceptFriendRequest(req.id)}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                >
                  接受
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-100 dark:bg-[#191919] px-4 py-1 text-xs text-gray-500 dark:text-gray-400">我</div>
        <div className="flex items-center p-3 border-b dark:border-white/5 cursor-pointer active:bg-gray-100 dark:active:bg-white/5 bg-white dark:bg-[#111111]">
          <div 
            className="w-10 h-10 rounded-md flex-shrink-0"
            style={{ background: (useAppStore.getState().settings.wechatAvatar || '').startsWith('#') ? useAppStore.getState().settings.wechatAvatar : `url(${useAppStore.getState().settings.wechatAvatar}) center/cover` }}
          />
          <div className="ml-3 flex-1">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {useAppStore.getState().settings.wechatName || '我'}
            </span>
          </div>
        </div>

        {starred.length > 0 && (
          <div id="contact-group-star">
            <div className="bg-gray-100 dark:bg-[#191919] px-4 py-1 text-xs text-gray-500 dark:text-gray-400">星标朋友</div>
            {starred.map((character) => (
              <div 
                key={character.id} 
                onClick={() => onOpenChat(character.id)}
                className="flex items-center p-3 border-b dark:border-white/5 cursor-pointer active:bg-gray-100 dark:active:bg-white/5 bg-white dark:bg-[#111111]"
              >
                <div 
                  className="w-10 h-10 rounded-md flex-shrink-0"
                  style={{ background: (character.avatar || '').startsWith('#') ? character.avatar : `url(${character.avatar}) center/cover` }}
                />
                <div className="ml-3 flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{character.remark || character.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {letters.map(letter => (
          <div key={letter} id={`contact-group-${letter}`}>
            <div className="bg-gray-100 dark:bg-[#191919] px-4 py-1 text-xs text-gray-500 dark:text-gray-400">{letter}</div>
            {grouped[letter].map((character) => (
              <div 
                key={character.id} 
                onClick={() => onOpenChat(character.id)}
                className="flex items-center p-3 border-b dark:border-white/5 cursor-pointer active:bg-gray-100 dark:active:bg-white/5 bg-white dark:bg-[#111111]"
              >
                <div 
                  className="w-10 h-10 rounded-md flex-shrink-0"
                  style={{ background: (character.avatar || '').startsWith('#') ? character.avatar : `url(${character.avatar}) center/cover` }}
                />
                <div className="ml-3 flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{character.remark || character.name}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Alphabet Navigation */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center text-[10px] text-gray-500 dark:text-gray-400 pr-1 z-20">
        {starred.length > 0 && (
          <div className="py-0.5 cursor-pointer hover:text-green-500" onClick={() => scrollToLetter('star')}>★</div>
        )}
        {letters.map(letter => (
          <div key={letter} className="py-0.5 cursor-pointer hover:text-green-500" onClick={() => scrollToLetter(letter)}>
            {letter}
          </div>
        ))}
      </div>
    </div>
  );
}
