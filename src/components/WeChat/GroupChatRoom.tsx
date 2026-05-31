import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, MoreHorizontal, Smile, Plus, UserPlus, FileText, Image as ImageIcon, Trash2, Send } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import { getTopMemoriesForPrompt } from '../../lib/characterMemory';
import { getCurrentMood, buildMoodPrompt } from '../../lib/moodLoop';
import { ChatGroup, Message } from '../../types';
import ImageUploader from '../ImageUploader';
import { format } from 'date-fns';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, isDark }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmText?: string; isDark: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-2xl p-6 w-[280px] shadow-2xl`}>
        <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
        <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}>取消</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-3 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600 transition-colors">{confirmText || '确认'}</button>
        </div>
      </div>
    </div>
  );
}

export default function GroupChatRoom({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { wechatGroups, characters, settings, updateWeChatGroup, sendAdvancedMessage, clearGroupChatHistory, deleteGroupChat } = useAppStore();
  const group = wechatGroups[groupId];
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [showAtList, setShowAtList] = useState(false);
  const [selectedAtMembers, setSelectedAtMembers] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [tempName, setTempName] = useState(group?.name || '');
  const [showInvite, setShowInvite] = useState(false);
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);
  const [editingAliasName, setEditingAliasName] = useState('');
  
  const [showStickers, setShowStickers] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [attachType, setAttachType] = useState<'transfer' | 'gift' | null>(null);
  
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [giftName, setGiftName] = useState('');
  const [showPayPass, setShowPayPass] = useState(false);
  const [payPass, setPayPass] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const isDark = settings.wechatTheme === 'dark';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const grayBubbleClass = isDark ? 'bg-[#2b2b2b] text-gray-100' : 'bg-[#f3f4f6] text-slate-900';
  const cardClass = `rounded-[18px] overflow-hidden flex flex-col w-[220px] border shadow-sm ${
    isDark ? 'bg-[#2b2b2b] border-white/10' : 'bg-[#f3f4f6] border-gray-300/80'
  }`;
  const transferCardClass = `rounded-[18px] overflow-hidden flex flex-col w-[220px] border shadow-sm ${
    isDark ? 'bg-[#4b4453] border-white/10' : 'bg-[#f2dfe6] border-[#e7c6d1]'
  }`;
  const giftCardClass = `rounded-[18px] overflow-hidden flex flex-col w-[220px] border shadow-sm ${
    isDark ? 'bg-[#485266] border-white/10' : 'bg-[#dbe8f4] border-[#c6d9eb]'
  }`;
  
  useEffect(() => {
    if (group) setMessages(group.messages);
  }, [group?.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, attachType, showAttach, showStickers]);

  if (!group) return null;

  const handleOpenGroupGift = (messageId: string) => {
    const nextMessages = messages.map(message => message.id === messageId ? { ...message, giftStatus: 'opened' as const } : message);
    setMessages(nextMessages);
    updateWeChatGroup(groupId, { messages: nextMessages });
  };

  const handleSend = async (customText?: string, imageUrl?: string, stickerUrl?: string) => {
    const textToSend = customText || inputMsg;
    if (!textToSend.trim() && !imageUrl && !stickerUrl) return;
    
    setInputMsg('');
    setShowStickers(false);
    setShowAttach(false);
    setAttachType(null);

    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: 'user',
      text: textToSend,
      timestamp: Date.now(),
      imageUrl,
      stickerUrl,
      ...(textToSend.trim().startsWith('[礼物]') ? { type: 'gift' as const, giftName: textToSend.replace('[礼物]', '').trim(), giftStatus: 'opened' as const } : {}),
      ...(textToSend.trim().startsWith('[转账]') ? { type: 'transfer' as const } : {})
    };
    
    const updatedMsgs = [...messages, newMsg];
    setMessages(updatedMsgs);
    updateWeChatGroup(groupId, { messages: updatedMsgs });
    
    const mentionedIds = group.members.filter(m => m !== 'user' && textToSend.includes(`@${characters[m]?.name}`));
    
    if (mentionedIds.length > 0 || group.autonomous) {
      let turns = 0;
      let anyoneSpoke = true;
      let currentMsgs = updatedMsgs;
      let speakersThisTurn = mentionedIds.length > 0 ? mentionedIds : group.members.filter(m=>m!=='user');
      
      while (anyoneSpoke && turns < 3) {
        anyoneSpoke = false;
        for (const mId of speakersThisTurn) {
           const char = characters[mId];
           if (!char) continue;
           
           const isMentioned = mentionedIds.includes(mId);
           const recentMsgs = currentMsgs.slice(-10).map(m => {
              const sName = m.senderId === 'user' ? (settings.wechatName || '我') : (characters[m.senderId]?.name || '未知系统');
              return `${sName}: ${m.text}`;
           }).join('\n');
           
           const gState = useAppStore.getState();
           const currentMood = getCurrentMood(mId);
           const moodPrompt = buildMoodPrompt(currentMood);

           const relevantWorld = gState.worldSettings.find(ws =>
             ws.characters.some(c => c.id === mId)
           );
           const worldContext = relevantWorld
             ? relevantWorld.title + ': ' + relevantWorld.content
             : '';

           let card = null;
           for (const ws of gState.worldSettings) {
             const found = ws.characters.find(c => c.id === mId);
             if (found) { card = found; break; }
           }

           const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n) + '...' : s;
           const personality = trunc(card?.personality || char.personality || '', 200);
           const experience = trunc(card?.experience || char.experience || '', 200);
           const biography = trunc(card?.biography || char.biography || '', 300);
           const relationship = trunc(card?.relationship || char.relationship || '', 200);
           const viewOnMe = trunc(card?.viewOnMe || char.viewOnMe || '', 200);
           const ff = (v?: string) => (v || '').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
           const characterForceRequirements = ff(card?.forceRequirements);
           const worldForceRequirements = relevantWorld ? ff(relevantWorld.baseCode) : '';
           const characterMemories = getTopMemoriesForPrompt(mId, 300);
           const latestNewsIssue = (gState.newsIssues || [])[0];
           const newsContext = latestNewsIssue
             ? '【新闻】' + latestNewsIssue.articles.slice(0, 2).map(a => a.title).join('、')
             : '';
           
           // ── System instruction (same structure as getCharacterReply) ──
           const sysParts: string[] = [
             '角色：' + char.name + '。',
           ];
           if (worldContext) sysParts.push('世界观：' + worldContext);
           if (personality) sysParts.push('性格：' + personality + '。');
           if (experience) sysParts.push('经历：' + experience + '。');
           if (biography) sysParts.push('档案：' + biography + '。');
           sysParts.push('关系：' + relationship + '（你=' + (char.userNickname || '你') + '，好感' + (char.affection ?? 50) + '/100）。');
           if (viewOnMe) sysParts.push('对你的看法：' + viewOnMe);
           if (characterMemories) sysParts.push('记忆：\n' + characterMemories + '\n（不记得说不知道）');
           if (newsContext) sysParts.push(newsContext);
           sysParts.push('我们在一个名为【' + group.name + '】的微信群聊中。群成员有：' + group.members.map(x => x === 'user' ? '(用户)我' : characters[x]?.name).join('、') + '。');
           sysParts.push('风格：纯文字微信聊天，严禁动作/神态/心理描写。消息前无角色名/冒号/括号/星号，直接以文字开头。2-4条用\\n\\n分隔。严禁第四面墙——你就是角色本人，不是AI，不提扮演/模型/设定。如果是群聊里的回复可适当简短。你可以给"我"（用户）[转账] 或 [礼物]。');
           if (settings.bilingual) sysParts.push('双语：先中后英。');
           sysParts.push(moodPrompt);
           if (worldForceRequirements) sysParts.push('强制：' + worldForceRequirements);
           if (characterForceRequirements) sysParts.push('强制：' + characterForceRequirements);
           const systemInstruction = sysParts.join('\n');

           // ── User prompt ──
           let promptSuffix = '';
           if (isMentioned) {
             promptSuffix = '\n\n【强制要求】你刚才被@了！这是对你的直接呼叫，你必须回复！即使你想跳过也绝对不允许！必须输出你的回复内容，禁止回复"SKIP"。';
           } else {
             promptSuffix = '\n\n如果对这个话题不感兴趣，可以回复"SKIP"。';
           }

           const prompt = (recentMsgs ? '【最近】\n' + recentMsgs + '\n\n' : '')
             + '刚才有新消息。'
             + promptSuffix;
           
           try {
              let res = await generateAIResponse(prompt, systemInstruction);
              if (isMentioned) {
                let retries = 0;
                while ((res.includes('SKIP') || res.trim().length === 0) && retries < 3) {
                  await new Promise(r => setTimeout(r, 1000));
                  const retryPrompt = '【紧急】你刚才被用户在群里被@了！这是直接呼叫你，你必须回复！绝对不能回复SKIP！请立即输出你的回复内容。';
                  res = await generateAIResponse(retryPrompt, systemInstruction);
                  retries++;
                }
              }
              if (!res.includes('SKIP') && res.trim().length > 0) {
                anyoneSpoke = true;
                const parts = res.split(/\n\n+/).filter(p => !p.includes('SKIP') && p.trim());
                
                for (let i = 0; i < parts.length; i++) {
                   const part = parts[i].trim();
                   if (part.startsWith('[转账]')) {
                      const match = part.match(/¥(\d+(\.\d+)?)/);
                      if (match) {
                        useAppStore.getState().updateWeChatBalance(useAppStore.getState().wechatBalance + parseFloat(match[1]));
                      }
                   } else if (part.startsWith('[礼物]') && !part.includes('已添加')) {
                      useAppStore.getState().addWeChatGift({
                        id: Date.now().toString() + Math.random(),
                        name: part.replace('[礼物]', '').trim(),
                        senderId: mId,
                        timestamp: Date.now()
                      });
                   }
                   
                   const replyMsg: Message = {
                     id: Date.now().toString() + Math.random(),
                     senderId: mId,
                     text: part,
                     timestamp: Date.now(),
                     ...(part.startsWith('[礼物]') ? { type: 'gift' as const, giftName: part.replace('[礼物]', '').trim(), giftStatus: 'unopened' as const } : {}),
                     ...(part.startsWith('[转账]') ? { type: 'transfer' as const } : {})
                   };
                   currentMsgs = [...currentMsgs, replyMsg];
                   setMessages(currentMsgs);
                   updateWeChatGroup(groupId, { messages: currentMsgs });
                   
                   if (i < parts.length - 1) {
                     await new Promise(r => setTimeout(r, 1500));
                   }
                 }
               }
             } catch (e) {
               console.error('AI回复生成失败:', e);
             }
             
             await new Promise(r => setTimeout(r, 1500));
        }
        
        if (turns === 0) {
           speakersThisTurn = group.members.filter(m=>m!=='user');
        }
        turns++;
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 z-50 absolute inset-0 text-slate-800 dark:bg-black dark:text-gray-100">
      <div className="pt-14 pb-3 bg-gray-50 dark:bg-black flex items-center justify-between px-4 border-b dark:border-white/5 shrink-0 relative">
        <button onClick={onBack} className="text-gray-800 dark:text-gray-100 w-8 flex items-center -ml-2">
          <ChevronLeft size={28} />
        </button>
        <span className="font-medium truncate flex-1 text-center">{group.name} ({group.members.length})</span>
        <button onClick={() => setShowSettings(!showSettings)} className="text-gray-800 dark:text-gray-100 w-8 flex justify-end">
          <MoreHorizontal size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {messages.map((msg, idx) => {
           const isUser = msg.senderId === 'user';
           const senderChar = characters[msg.senderId];
           const avatar = isUser ? settings.wechatAvatar : senderChar?.avatar;
           const name = isUser ? (settings.wechatName || '我') : (senderChar?.name || '未知');
           
           const isTransfer = msg.text?.startsWith('[转账] ');
           const isGift = msg.text?.startsWith('[礼物] ');
           
           let showTime = false;
           if (idx === 0) {
             showTime = true;
           } else {
             const prevMsg = messages[idx - 1];
             if (msg.timestamp - prevMsg.timestamp > 5 * 60 * 1000) {
               showTime = true;
             }
           }
           
           return (
           <React.Fragment key={msg.id}>
             {showTime && (
               <div className="text-center text-xs text-gray-400 py-2">{format(msg.timestamp, 'yyyy年MM月dd日 HH:mm')}</div>
             )}
             <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
               {!isUser && (
                 <div 
                   className="w-9 h-9 rounded-md flex-shrink-0"
                   style={{ background: avatar?.startsWith('#') ? avatar : `url(${avatar}) center/cover` }}
                 />
               )}
               <div className={`max-w-[75%] ${isUser ? 'order-1' : ''}`}>
                 {!isUser && <div className="text-xs text-gray-400 mb-1 ml-1">{name}</div>}
                 <div className={`${cardClass} ${isUser ? 'bg-green-500 text-white' : grayBubbleClass} ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                   {msg.type === 'transfer' && (
                     <div className="p-3">
                       <div className="flex items-center gap-2 mb-2">
                         <span className="text-lg">💰</span>
                         <span className="text-sm font-medium">{msg.text}</span>
                       </div>
                       <div className={`text-xs ${isUser ? 'text-green-100' : 'text-gray-500'}`}>微信转账</div>
                     </div>
                   )}
                   {msg.type === 'gift' && (
                     <div className="p-3">
                       <div className="flex items-center gap-2 mb-2">
                         <span className="text-lg">🎁</span>
                         <span className="text-sm font-medium">{msg.giftName || msg.text}</span>
                       </div>
                       {msg.giftStatus === 'unopened' && (
                         <button onClick={() => handleOpenGroupGift(msg.id)} className="w-full py-2 text-xs bg-white dark:bg-black rounded-lg">接收礼物</button>
                       )}
                       {msg.giftStatus === 'opened' && (
                         <div className={`text-xs ${isUser ? 'text-green-100' : 'text-gray-500'}`}>已接收礼物</div>
                       )}
                     </div>
                   )}
                   {!msg.type && (
                     <div className="px-3 py-2">
                       <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                     </div>
                   )}
                   {msg.imageUrl && (
                     <img src={msg.imageUrl} className="w-full max-w-[200px] object-cover" />
                   )}
                   {msg.stickerUrl && <img src={msg.stickerUrl} alt="sticker" className="w-24 h-24 object-contain mt-1" />}
                 </div>
               </div>
               {isUser && (
                 <div 
                   className="w-9 h-9 rounded-md flex-shrink-0"
                   style={{ background: avatar?.startsWith('#') ? avatar : `url(${avatar}) center/cover` }}
                 />
               )}
             </div>
           </React.Fragment>
           );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-gray-50 dark:bg-[#191919] border-t dark:border-white/5 p-3 pb-safe flex flex-col shrink-0 relative z-10 transition-all">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setShowAtList(!showAtList); setShowStickers(false); setShowAttach(false); }}
            className="text-gray-800 dark:text-gray-100"
          >
            <span className="font-bold text-lg">@</span>
          </button>
          <input 
            type="text" 
            value={inputMsg}
            onChange={e => setInputMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="flex-1 h-10 bg-white dark:bg-[#2c2c2c] dark:text-gray-100 rounded-lg px-3 outline-none"
            placeholder="发送消息..."
          />
          <button onClick={() => handleSend()} className="bg-slate-700 text-white w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50" disabled={!inputMsg.trim()}>
            <Send size={20} />
          </button>
          <button 
            onClick={() => { setShowAttach(!showAttach); setShowStickers(false); setShowAtList(false); }}
            className="text-gray-800 dark:text-gray-100"
          >
            <Plus size={28} />
          </button>
        </div>
        
        {showAtList && (
          <div className="mt-3 bg-white dark:bg-[#191919] rounded-xl p-3 shadow-lg border dark:border-white/10">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">选择要@的成员</div>
            <div className="space-y-2">
              {group.members.filter(m => m !== 'user').map(m => {
                const char = characters[m];
                const name = group.memberAliases?.[m] || (char?.name || '未知');
                const isSelected = selectedAtMembers.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedAtMembers(prev => prev.filter(id => id !== m));
                      } else {
                        setSelectedAtMembers(prev => [...prev, m]);
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      isSelected 
                        ? 'bg-blue-500/10 border border-blue-500/30' 
                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div 
                      className="w-8 h-8 rounded-md"
                      style={{ background: char?.avatar.startsWith('#') ? char.avatar : `url(${char?.avatar}) center/cover` }}
                    />
                    <span className={`text-sm flex-1 text-left ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>
                      {name}
                    </span>
                    {isSelected && (
                      <span className="text-blue-500 text-xs font-medium">已选择</span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedAtMembers.length > 0 && (
              <button
                onClick={() => {
                  const atText = selectedAtMembers.map(m => {
                    const char = characters[m];
                    const name = group.memberAliases?.[m] || (char?.name || '未知');
                    return `@${name}`;
                  }).join(' ');
                  setInputMsg(prev => prev + atText + ' ');
                  setShowAtList(false);
                  setSelectedAtMembers([]);
                }}
                className="w-full mt-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                发送@
              </button>
            )}
          </div>
        )}

        {showStickers && (
          <div className="mt-4 pt-4 border-t dark:border-white/5 h-48 overflow-y-auto w-full px-2 pb-2">
            <div className="grid grid-cols-4 gap-2">
              {useAppStore.getState().stickers.length === 0 ? (
                <div className="col-span-4 text-center text-gray-400 text-sm py-4">暂无表情包，请在"我"中添加</div>
              ) : (
                useAppStore.getState().stickers.map((url, i) => (
                  <img 
                    key={i} 
                    src={url} 
                    alt="sticker" 
                    className="w-full aspect-square object-cover rounded cursor-pointer border border-gray-200 dark:border-white/10"
                    onClick={() => handleSend('', undefined, url)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {showAttach && (
          <div className="mt-4 pt-4 border-t dark:border-white/5 pb-2 px-4 h-48">
            <div className="grid grid-cols-4 gap-x-6 gap-y-4">
              <ImageUploader onImageSelected={(url) => handleSend('', url, undefined)} className="flex flex-col items-center gap-1 cursor-pointer">
                <div className="w-14 h-14 bg-white dark:bg-[#333] rounded-2xl flex items-center justify-center shadow-sm">
                  <ImageIcon size={28} className="text-gray-500 dark:text-gray-400" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">照片</span>
              </ImageUploader>
              <button onClick={() => { setAttachType('transfer'); setShowAttach(false); }} className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 bg-white dark:bg-[#333] rounded-2xl flex items-center justify-center shadow-sm">
                  <span className="font-bold text-2xl text-slate-500">¥</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">转账</span>
              </button>
              <button onClick={() => { setAttachType('gift'); setShowAttach(false); }} className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 bg-white dark:bg-[#333] rounded-2xl flex items-center justify-center shadow-sm text-slate-500">
                  <span className="font-bold text-2xl">🎁</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">礼物</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {attachType && !selectedRecipientId && (
        <div className="absolute inset-0 z-[60] bg-gray-100 dark:bg-black p-4 flex flex-col pt-14 text-slate-800 dark:text-white">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setAttachType(null)} className="p-1"><ChevronLeft size={24} /></button>
            <h2 className="text-xl font-medium">选择{attachType === 'gift' ? '礼物' : '转账'}接收人</h2>
          </div>
          <div className="bg-white dark:bg-[#191919] rounded-2xl p-2 py-4 flex flex-col divide-y dark:divide-white/10 shadow-sm">
             {group.members.filter(m => m !== 'user').map(m => {
                const char = characters[m];
                const name = group.memberAliases?.[m] || (char?.name || '未知');
                return (
                  <button key={m} onClick={() => setSelectedRecipientId(m)} className="w-full flex items-center gap-3 p-4 text-left">
                    <div 
                      className="w-10 h-10 rounded-md"
                      style={{ background: char?.avatar.startsWith('#') ? char.avatar : `url(${char?.avatar}) center/cover` }}
                    />
                    <span className="font-medium">{name}</span>
                  </button>
                );
             })}
          </div>
        </div>
      )}

      {attachType && selectedRecipientId && !showPayPass && (
        <div className="absolute inset-0 z-[60] bg-gray-100 dark:bg-black p-4 flex flex-col pt-14 text-slate-800 dark:text-white">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setSelectedRecipientId(null); setAttachType(null); }} className="p-1"><ChevronLeft size={24} /></button>
            <h2 className="text-xl font-medium">发给 {group.memberAliases?.[selectedRecipientId] || characters[selectedRecipientId]?.name}</h2>
          </div>
          
          <div className="bg-white dark:bg-[#191919] rounded-2xl p-4 shadow-sm space-y-4">
            {attachType === 'transfer' && (
              <>
                <input 
                  type="number" 
                  value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-3xl font-bold bg-transparent outline-none border-b pb-2 dark:border-white/10"
                />
                <input 
                  type="text" 
                  value={transferNote}
                  onChange={e => setTransferNote(e.target.value)}
                  placeholder="转账说明"
                  className="w-full bg-gray-50 dark:bg-black rounded-lg px-3 py-2 outline-none text-sm dark:border-white/10 border"
                />
              </>
            )}
            {attachType === 'gift' && (
              <input 
                type="text" 
                value={giftName}
                onChange={e => setGiftName(e.target.value)}
                placeholder="礼物名称"
                className="w-full bg-gray-50 dark:bg-black rounded-lg px-3 py-2 outline-none text-sm dark:border-white/10 border"
              />
            )}
          </div>
          
          <div className="mt-auto">
            <button 
              onClick={() => setShowPayPass(true)}
              className="w-full py-4 bg-green-500 text-white rounded-xl font-medium text-lg"
            >
              {attachType === 'transfer' ? `转账 ¥${transferAmount}` : '发送礼物'}
            </button>
          </div>
        </div>
      )}

      {showPayPass && (
        <div className="absolute inset-0 z-[70] bg-gray-100 dark:bg-black p-4 flex flex-col pt-14 text-slate-800 dark:text-white">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setShowPayPass(false)} className="p-1"><ChevronLeft size={24} /></button>
            <h2 className="text-xl font-medium">输入支付密码</h2>
          </div>
          
          <div className="bg-white dark:bg-[#191919] rounded-2xl p-6 shadow-sm">
            <div className="flex gap-2 justify-center mb-6">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className={`w-10 h-12 border-b-2 flex items-center justify-center text-2xl ${payPass.length > i ? 'border-green-500' : 'border-gray-300 dark:border-white/20'}`}>{
                  payPass.length > i ? '●' : ''
                }</div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3,4,5,6,7,8,9,'','取消',0].map((n, i) => (
                <button 
                  key={i}
                  onClick={() => {
                    if (n === '取消') {
                      setShowPayPass(false);
                      setPayPass('');
                    } else if (n !== '') {
                      const newPass = payPass + n;
                      setPayPass(newPass);
                      if (newPass.length === 6) {
                        setTimeout(() => {
                          setShowPayPass(false);
                          setPayPass('');
                          if (attachType === 'transfer') {
                            handleSend(`[转账] ¥${transferAmount} ${transferNote}`);
                          } else {
                            handleSend(`[礼物] ${giftName || '神秘礼物'}`);
                          }
                          setAttachType(null);
                          setSelectedRecipientId(null);
                          setTransferAmount('');
                          setTransferNote('');
                          setGiftName('');
                        }, 300);
                      }
                    }
                  }}
                  className={`py-4 rounded-xl text-xl font-medium ${n === '' ? 'bg-transparent' : 'bg-gray-100 dark:bg-[#2c2c2c]'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 z-[60] bg-gray-100 dark:bg-black p-4 flex flex-col pt-14 overflow-y-auto">
           <div className="flex items-center gap-3 mb-6">
             <button onClick={() => setShowSettings(false)} className="p-1"><ChevronLeft size={24} /></button>
             <h2 className="text-xl font-medium">群设置</h2>
           </div>
           
           <div className="bg-white dark:bg-[#191919] rounded-xl p-4 mb-4 shadow-sm transition-colors">
             <div className="p-4 flex items-center justify-between">
               <span className="font-bold text-sm">群名称</span>
               <input 
                 value={tempName} 
                 onChange={e => setTempName(e.target.value)}
                 className="flex-1 ml-4 text-right bg-transparent outline-none text-gray-600 dark:text-gray-300"
               />
             </div>
             <button 
               onClick={() => { updateWeChatGroup(groupId, { name: tempName }); }}
               className="w-full py-3 bg-green-500 text-white rounded-xl font-medium"
             >
               保存名称
             </button>
           </div>
           
           <div className="bg-white dark:bg-[#191919] rounded-xl p-4 mb-4 shadow-sm transition-colors">
             <div className="flex items-center justify-between mb-3">
               <span className="font-bold text-sm">群成员</span>
               <button onClick={() => { setShowSettings(false); setShowInvite(true); }} className="text-blue-500 text-sm font-medium flex items-center gap-1">
                 <UserPlus size={16} /> 邀请
               </button>
             </div>
             <div className="space-y-2">
               {group.members.map(m => {
                  const char = characters[m];
                  const name = m === 'user' ? (settings.wechatName || '我') : (group.memberAliases?.[m] || (char?.name || '未知'));
                  const isEditing = editingAliasId === m;
                  return (
                    <div key={m} className="flex items-center gap-3 p-2">
                      <div 
                        className="w-8 h-8 rounded-md"
                        style={{ background: m === 'user' ? (settings.wechatAvatar?.startsWith('#') ? settings.wechatAvatar : `url(${settings.wechatAvatar}) center/cover`) : (char?.avatar.startsWith('#') ? char.avatar : `url(${char?.avatar}) center/cover`) }}
                      />
                      <span className="flex-1 text-sm">{name}</span>
                      {m !== 'user' && (
                        <button onClick={() => { setEditingAliasId(m); setEditingAliasName(group.memberAliases?.[m] || char?.name || ''); }} className="text-blue-500 text-xs">备注</button>
                      )}
                      {m !== 'user' && (
                        <button 
                          onClick={() => updateWeChatGroup(groupId, { members: group.members.filter(x => x !== m) })}
                          className="text-red-500 text-xs"
                        >
                          移除
                        </button>
                      )}
                    </div>
                  );
               })}
             </div>
           </div>
           
           {editingAliasId && (
            <div className="bg-white dark:bg-[#191919] rounded-xl p-4 mb-4 shadow-sm transition-colors">
              <div className="text-sm font-bold mb-3">设置 {characters[editingAliasId]?.name} 的群备注</div>
               <input 
                 value={editingAliasName} 
                 onChange={e=>setEditingAliasName(e.target.value)}
                 className="flex-1 bg-gray-50 dark:bg-black border dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none w-full mb-3"
                 placeholder="输入新的群备注名称..."
               />
               <div className="flex gap-2">
                 <button onClick={() => setEditingAliasId(null)} className="flex-1 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-sm">取消</button>
                 <button 
                   onClick={() => {
                     updateWeChatGroup(groupId, { memberAliases: { ...group.memberAliases, [editingAliasId!]: editingAliasName } });
                     setEditingAliasId(null);
                   }} 
                   className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm"
                 >
                   保存
                 </button>
               </div>
             </div>
           )}
           
           <div className="bg-white dark:bg-[#191919] rounded-xl shadow-sm transition-colors">
             <div className="p-4 flex items-center justify-between">
               <span className="font-bold text-sm">允许角色自主聊天</span>
               <label className="relative inline-flex items-center cursor-pointer">
                 <input type="checkbox" checked={!!group.autonomous} onChange={e => updateWeChatGroup(groupId, {autonomous: e.target.checked})} className="sr-only peer" />
                 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
               </label>
             </div>
             <div className="p-4">
               <p className="text-xs text-gray-400">开启后，即使你没有艾特角色，他们也会根据群里的话题自主发言。如果人员较多，群里可能会变得很热闹喔！</p>
             </div>
           </div>
           
           <div className="bg-white dark:bg-[#191919] rounded-xl divide-y dark:divide-white/5 mt-4 transition-colors">
             <button onClick={() => setShowDeleteModal(true)} className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-[#2c2c2c] transition-colors flex items-center gap-3">
               <Trash2 size={18} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
               <div>
                 <span className="font-bold text-sm text-slate-700 dark:text-gray-200">删除该聊天</span>
                 <p className="text-xs text-gray-400 mt-1">仅清除聊天记录，不影响角色记忆</p>
               </div>
             </button>
             <button onClick={() => setShowClearModal(true)} className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-[#2c2c2c] transition-colors flex items-center gap-3">
               <Trash2 size={18} className="text-red-500" />
               <div>
                 <span className="font-bold text-sm text-red-500">清空聊天记录</span>
                 <p className="text-xs text-gray-400 mt-1">清除所有聊天记录和角色记忆</p>
               </div>
             </button>
           </div>
           
           <ConfirmModal
             isOpen={showClearModal}
             onClose={() => setShowClearModal(false)}
             onConfirm={() => { clearGroupChatHistory(groupId); setMessages([]); setShowSettings(false); }}
             title="清空聊天记录"
             message="确定要清空聊天记录吗？这将同时清除角色的相关记忆。"
             confirmText="清空"
             isDark={isDark}
           />
           
           <ConfirmModal
             isOpen={showDeleteModal}
             onClose={() => setShowDeleteModal(false)}
             onConfirm={() => { deleteGroupChat(groupId); onBack(); }}
             title="删除该聊天"
             message="确定要删除该聊天吗？这将清除聊天记录，但保留角色记忆。"
             confirmText="删除"
             isDark={isDark}
           />
           
           <div className="mt-8 flex justify-center">
             <button onClick={() => {
                const newGroups = { ...wechatGroups };
                delete newGroups[groupId];
                useAppStore.setState(prev => ({ wechatGroups: newGroups }));
                onBack();
             }} className="text-rose-500 font-bold bg-white dark:bg-[#191919] px-8 py-3 rounded-xl shadow-sm transition-colors">退出并删除群聊</button>
           </div>
        </div>
      )}

      {showInvite && (
        <div className="absolute inset-0 bg-white z-50 flex flex-col pt-14 px-4 text-slate-800">
          <div className="absolute top-4 inset-x-4 flex items-center justify-between z-50">
             <button onClick={() => setShowInvite(false)} className="text-gray-800">取消</button>
             <span className="font-medium">邀请好友</span>
             <div className="w-8"></div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 mt-4">
             {Object.values(characters).filter(c=>(c as any).isDisabled !== true).filter(c => !group.members.includes(c.id)).map(char => (
               <div key={char.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl" onClick={() => {
                 updateWeChatGroup(groupId, { members: [...group.members, char.id] });
                 setShowInvite(false);
               }}>
                 <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                   {!char.avatar.startsWith('#') ? <img src={char.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full" style={{backgroundColor: char.avatar}}/>}
                 </div>
                 <span className="font-medium">{char.name}</span>
               </div>
             ))}
             {Object.values(characters).filter(c=>(c as any).isDisabled !== true).filter(c => !group.members.includes(c.id)).length === 0 && (
               <div className="text-center text-gray-400 text-sm mt-10">你的所有好友都在群里了</div>
             )}
          </div>
        </div>
      )}

    </div>
  );
}
