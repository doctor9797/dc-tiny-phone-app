import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Trash2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAIResponse } from '../../lib/ai';
import { format } from 'date-fns';

const TAROT_CARDS = [
  { name: "愚者", keyword: "fool" },
  { name: "魔术师", keyword: "magician" },
  { name: "女祭司", keyword: "priestess" },
  { name: "女皇", keyword: "empress" },
  { name: "皇帝", keyword: "emperor" },
  { name: "教皇", keyword: "hierophant" },
  { name: "恋人", keyword: "lovers" },
  { name: "战车", keyword: "chariot" },
  { name: "力量", keyword: "strength" },
  { name: "隐士", keyword: "hermit" },
  { name: "命运之轮", keyword: "wheel" },
  { name: "正义", keyword: "justice" },
  { name: "倒吊人", keyword: "hanged" },
  { name: "死神", keyword: "reaper" },
  { name: "节制", keyword: "temperance" },
  { name: "恶魔", keyword: "demon" },
  { name: "高塔", keyword: "tower" },
  { name: "星星", keyword: "star" },
  { name: "月亮", keyword: "moon" },
  { name: "太阳", keyword: "sun" },
  { name: "审判", keyword: "judgement" },
  { name: "世界", keyword: "world" }
].map(card => ({
  ...card,
  imageUrl: (seed: number) => `https://image.pollinations.ai/prompt/beautiful%20intricate%20tarot%20card%20${card.keyword}%20illustration%20masterpiece?width=400&height=600&nologo=true&seed=${seed}`
}));

const parseTarotText = (text: string) => {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .split('\n\n')
    .map(para => {
      if (para.startsWith('<')) return para;
      return `<p class="mb-3">${para}</p>`;
    })
    .join('');
};

export default function TarotApp() {
  const { closeApp, addTarotRecord, deleteTarotRecord, tarotRecords, characters } = useAppStore();
  const [step, setStep] = useState<'start' | 'animating' | 'cards' | 'interpretation' | 'history'>('start');
  const [cards, setCards] = useState<{name: string, keyword: string, imageUrl: string, seed: number, isReversed: boolean, flipped: boolean}[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatChar, setChatChar] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{sender: 'user'|'friend', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const activeCharacters = Object.values(characters).filter(c => !(c as any).isDisabled);

  const startDivination = () => {
    setStep('animating');
    const shuffled = [...TAROT_CARDS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3).map(card => {
      const seed = Math.floor(Math.random() * 1000000);
      return {
        name: card.name,
        keyword: card.keyword,
        imageUrl: card.imageUrl(seed),
        seed,
        isReversed: Math.random() > 0.5,
        flipped: false
      };
    });
    setTimeout(() => {
      setCards(selected);
      setStep('cards');
    }, 2000);
  };

  const flipCard = (index: number) => {
    const newCards = [...cards];
    newCards[index].flipped = true;
    setCards(newCards);
  };

  const getInterpretation = async () => {
    setStep('interpretation');
    setIsInterpreting(true);
    const cardNames = cards.map(c => `${c.name}(${c.isReversed ? '逆位' : '正位'})`).join('、');
    const prompt = `我抽到了三张塔罗牌：${cardNames}。请你以神秘学者的口吻解读。要求：分段清晰，每段空行，使用**加粗**表示重点。`;
    try {
      const reply = await generateAIResponse(prompt);
      setInterpretation(reply);
      addTarotRecord({
        id: Date.now().toString(),
        cards: cards.map(c => ({ name: c.name, keyword: c.keyword, isReversed: c.isReversed })),
        interpretation: reply,
        timestamp: Date.now()
      });
    } catch (e: any) {
      setInterpretation('解读失败：' + e.message);
    } finally {
      setIsInterpreting(false);
    }
  };

  const handleStartChat = async () => {
    if (activeCharacters.length === 0) return;
    const randomCharId = activeCharacters[Math.floor(Math.random() * activeCharacters.length)].id;
    setChatChar(randomCharId);
    setShowChat(true);
    setIsTyping(true);
    try {
      const char = characters[randomCharId];
      const reply = await generateAIResponse(`我占卜了塔罗牌，结果是${cards.map(c => c.name).join('、')}。以${char.name}身份安慰我，2-4条短消息。`);
      const parts = reply.split('\n\n').filter(Boolean);
      setChatMessages(parts.map(p => ({ sender: 'friend' as const, text: p.trim() })));
    } catch {
      setChatMessages([{ sender: 'friend', text: '不要太担心。' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !chatChar) return;
    const text = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user' as const, text }]);
    setIsTyping(true);
    try {
      const reply = await generateAIResponse(`关于塔罗牌讨论，回复我2-4条短消息。`);
      const parts = reply.split('\n\n').filter(Boolean);
      setChatMessages(prev => [...prev, ...parts.map(p => ({ sender: 'friend' as const, text: p.trim() }))]);
    } catch {
      setChatMessages(prev => [...prev, { sender: 'friend', text: '嗯。' }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (showChat && chatChar) {
    const char = characters[chatChar];
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-purple-50 via-white to-amber-50">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-purple-100">
          <button onClick={() => setShowChat(false)} className="text-purple-600"><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-medium text-gray-800">{char.name}</h1>
          <div className="w-7"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-purple-500 text-white rounded-br-none'
                  : 'bg-white text-gray-700 rounded-bl-none border border-gray-100'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="p-3 rounded-2xl rounded-bl-none text-sm bg-gray-100 text-gray-400">...</div>
            </div>
          )}
        </div>
        <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-purple-100 flex gap-2">
          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none" placeholder="诉说困惑..." />
          <button onClick={handleSendChat} className="bg-purple-500 text-white rounded-full px-5 py-2.5 text-sm font-medium">发送</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50 via-white to-amber-50">
      <div className="px-4 pt-12 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-purple-100">
        <button onClick={closeApp} className="text-purple-600"><ChevronLeft size={28} /></button>
        <h1 className="text-lg font-medium text-gray-800">塔罗占卜</h1>
        <button onClick={() => setStep('history')} className="text-purple-600"><BookOpen size={24} /></button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {step === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep('start')} className="text-purple-600"><ChevronLeft size={24} /></button>
                <h2 className="text-lg font-medium text-gray-800">占卜记录</h2>
                <div className="w-6"></div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {tarotRecords.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">暂无占卜记录</div>
                ) : (
                  tarotRecords.map(record => (
                    <div key={record.id} className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 relative group">
                      <button onClick={() => deleteTarotRecord(record.id)} className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                      </button>
                      <div className="text-xs text-purple-400 mb-2">{format(record.timestamp, 'yyyy年MM月dd日 HH:mm')}</div>
                      <div className="flex gap-2 mb-2">
                        {record.cards.map((c, i) => (
                          <span key={i} className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded-full">{c.name}{c.isReversed ? '逆' : ''}</span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-3">{record.interpretation}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {step === 'start' && (
            <motion.div key="start" exit={{ opacity: 0 }} className="flex flex-col items-center">
              <div className="relative mb-12">
                <div className="w-44 h-44 rounded-full bg-gradient-to-br from-purple-200 to-amber-100 flex items-center justify-center shadow-xl">
                  <div className="w-36 h-36 rounded-full bg-white flex items-center justify-center">
                    <span className="text-6xl">✨</span>
                  </div>
                </div>
              </div>
              <h2 className="text-2xl font-light text-gray-700 mb-2 tracking-wide">Tarot Divination</h2>
              <p className="text-gray-400 text-sm mb-8">探索命运的指引</p>
              <button onClick={startDivination} className="px-8 py-3 bg-gray-800 text-white rounded-full text-sm font-medium hover:bg-gray-700 transition shadow-lg">
                开始占卜
              </button>
            </motion.div>
          )}

          {step === 'animating' && (
            <motion.div key="animating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
              <div className="relative w-20 h-20 mb-6">
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full border border-gray-300"
                />
                <motion.div
                  animate={{ scale: [1.2, 1.6, 1.2], opacity: [0.15, 0.35, 0.15] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                  className="absolute inset-0 rounded-full border border-gray-300"
                />
                <motion.div
                  animate={{ scale: [1.4, 1.85, 1.4], opacity: [0.08, 0.2, 0.08] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                  className="absolute inset-0 rounded-full border border-gray-300"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl">🔮</span>
                </div>
              </div>
              <p className="text-gray-500 animate-pulse">命运之轮转动中...</p>
            </motion.div>
          )}

          {step === 'cards' && (
            <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center w-full">
              <p className="text-sm text-gray-400 mb-6">点击卡牌揭示命运</p>
              <div className="flex justify-center gap-4 mb-8">
                {cards.map((card, i) => (
                  <motion.div key={i} initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} className="relative">
                    <div className="w-24 h-36 rounded-xl overflow-hidden cursor-pointer shadow-lg hover:shadow-xl transition-shadow" onClick={() => !card.flipped && flipCard(i)}>
                      {card.flipped ? (
                        <div className="w-full h-full relative">
                          <img src={card.imageUrl} alt={card.name} className={`w-full h-full object-cover ${card.isReversed ? 'rotate-180' : ''}`} referrerPolicy="no-referrer" />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent py-2 text-center">
                            <span className="text-xs text-white font-medium">{card.name}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                          <div className="w-14 h-20 border border-amber-400/50 rounded-lg flex items-center justify-center">
                            <span className="text-amber-400 text-2xl">✧</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {card.flipped && (
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-purple-500 whitespace-nowrap">
                        {card.isReversed ? '逆位' : '正位'}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
              {cards.every(c => c.flipped) && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={getInterpretation} className="px-6 py-2.5 bg-purple-500 text-white rounded-full text-sm font-medium shadow-lg hover:bg-purple-600 transition">
                  查看解读
                </motion.button>
              )}
            </motion.div>
          )}

          {step === 'interpretation' && (
            <motion.div key="interpretation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center w-full h-full">
              <div className="flex justify-center gap-3 mb-4">
                {cards.map((card, i) => (
                  <div key={i} className="w-14 h-20 rounded-lg overflow-hidden shadow-md border border-purple-200">
                    <img src={card.imageUrl} alt={card.name} className={`w-full h-full object-cover ${card.isReversed ? 'rotate-180' : ''}`} referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>

              <div className="flex-1 min-h-0 w-full bg-white rounded-2xl p-5 shadow-sm border border-purple-100 overflow-y-auto">
                {isInterpreting ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                    <span className="text-4xl">🔮</span>
                    <p>解读中...</p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: parseTarotText(interpretation) }} />
                )}
              </div>

              {!isInterpreting && (
                <div className="mt-4 flex gap-3 w-full">
                  <button onClick={() => setStep('start')} className="flex-1 py-2.5 rounded-full border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">再来一次</button>
                  <button onClick={handleStartChat} disabled={activeCharacters.length === 0} className="flex-1 py-2.5 rounded-full bg-purple-500 text-white text-sm disabled:opacity-50">咨询好友</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
