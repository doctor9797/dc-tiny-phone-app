import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { ChevronLeft, Send } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import type { PhoneContact, PhoneMessage } from './data';

interface Props {
  contact: PhoneContact;
  ownerName: string;
  ownerPersonality: string;
  callerName: string;
  callerRelation: string;
  isDark: boolean;
  onBack: () => void;
  onSendMessage: (contactId: string, text: string) => void;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function formatMsgTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function ChatView({ contact, ownerName, ownerPersonality, callerName, callerRelation, isDark, onBack, onSendMessage }: Props) {
  const [messages, setMessages] = useState<PhoneMessage[]>(contact.messages);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;
    setInputText('');

    const userMsg: PhoneMessage = {
      id: randomId(),
      text,
      sender: 'me',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    onSendMessage(contact.id, text);

    setIsTyping(true);
    const recentContext = [...messages, userMsg]
      .slice(-6)
      .map(m => `${m.sender === 'me' ? ownerName : contact.name}: ${m.text}`)
      .join('\n');

    const prompt = `你是${contact.name}，${ownerName}的${contact.relationship}。你的性格：${contact.personality || '性格温和'}。

${ownerName}刚才给你发了一条消息。

${contact.relationship === '家人' || contact.relationship?.includes('子') || contact.relationship?.includes('女') || contact.relationship?.includes('父') || contact.relationship?.includes('母') || contact.relationship?.includes('兄') || contact.relationship?.includes('弟') || contact.relationship?.includes('姐') || contact.relationship?.includes('妹') ? `${ownerName}的${callerRelation}${callerName}可能会在${ownerName}身边，你知道${callerName}的存在。` : contact.relationship === '管家' || contact.relationship === '手下' || contact.relationship === '下属' || contact.relationship === '员工' || contact.relationship === '学生' ? `${callerName}是${ownerName}的${callerRelation}。你可能不知道${callerName}是谁，但如果对方说话语气不像${ownerName}，你会觉得不对劲。` : `${callerName}是${ownerName}的${callerRelation}。你可能知道也可能不知道${callerName}，但如果对方说话语气不像${ownerName}，你会觉得奇怪。`}

最近的聊天记录：
${recentContext}

${ownerName}的性格：${ownerPersonality}

回复要求：
1. 根据你和${ownerName}的关系回复对方——如果对方说话语气、用词、态度像${ownerName}，就当是${ownerName}本人正常聊天
2. 如果对方说话语气、用词、态度不像是${ownerName}（比如更粗鲁、更直接、更怯懦、或者用词习惯不同），你要根据情况判断对方是谁
3. 如果你知道${callerName}（${ownerName}的${callerRelation}），可能会问"你不是${ownerName}吧？${callerName}？"
4. 如果你不知道对方是谁，但觉得不对劲，可以质问"你是谁？${ownerName}呢？"
5. 如果你觉得就是${ownerName}本人，正常回复就行
6. 回复内容必须和对方发的消息内容相关
7. 【强制】只用对话，禁止任何动作描写、环境描写、心理描写、神态描写
8. 【强制】不要用引号括住整句话，正常直接输出对话内容即可。但如果是在引用对方的话或者表达讽刺，可以用引号

只输出对话内容，一句话。`;

    try {
      const reply = await generateAIResponse(prompt);
      if (reply?.trim()) {
        const replyMsg: PhoneMessage = {
          id: randomId(),
          text: reply.trim(),
          sender: 'them',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, replyMsg]);
        onSendMessage(contact.id, reply.trim());
      }
    } catch {
      // Silently fail
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const bg = isDark ? 'bg-black' : 'bg-gray-100';
  const headerBg = isDark ? 'bg-[#191919]' : 'bg-gray-50';
  const bubbleMe = isDark ? 'bg-[#07C160] text-white' : 'bg-[#95ec69] text-black';
  const bubbleThem = isDark ? 'bg-gray-800 text-white' : 'bg-white text-black';

  return (
    <div className={`h-full flex flex-col ${bg}`}>
      {/* Header */}
      <div className={`flex items-center px-2 py-2 border-b shrink-0 ${headerBg} ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center ml-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2"
            style={{ backgroundColor: contact.avatar || '#999' }}
          >
            {contact.name[0]}
          </div>
          <span className="font-medium text-[16px]">{contact.name}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[75%] px-3 py-2 rounded-lg text-[15px] leading-relaxed ${
                msg.sender === 'me' ? bubbleMe : bubbleThem
              }`}
            >
              {msg.text}
            </div>
            <span className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              {formatMsgTime(msg.timestamp)}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-start">
            <div className={`px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-400'}`}>
              对方正在输入...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className={`p-3 border-t flex items-center space-x-2 shrink-0 ${isDark ? 'bg-[#191919] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="回复..."
          className={`flex-1 px-3 py-2 rounded-lg text-sm border outline-none ${
            isDark
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
              : 'bg-white border-gray-200 text-black placeholder-gray-400'
          }`}
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || isTyping}
          className="p-2 text-[#07C160] disabled:opacity-40"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
