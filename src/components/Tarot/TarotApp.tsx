import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Trash2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAIResponse } from '../../lib/ai';
import { estimateSentiment } from '../../lib/characterMemory';
import { format } from 'date-fns';

// m00.jpg~m21.jpg 对应 22 张 Rider-Waite 大阿卡那牌
const TAROT_IMAGES: Record<string, string> = {
  fool: '/tarot-cards/m00.jpg',
  magician: '/tarot-cards/m01.jpg',
  priestess: '/tarot-cards/m02.jpg',
  empress: '/tarot-cards/m03.jpg',
  emperor: '/tarot-cards/m04.jpg',
  hierophant: '/tarot-cards/m05.jpg',
  lovers: '/tarot-cards/m06.jpg',
  chariot: '/tarot-cards/m07.jpg',
  strength: '/tarot-cards/m08.jpg',
  hermit: '/tarot-cards/m09.jpg',
  wheel: '/tarot-cards/m10.jpg',
  justice: '/tarot-cards/m11.jpg',
  hanged: '/tarot-cards/m12.jpg',
  reaper: '/tarot-cards/m13.jpg',
  temperance: '/tarot-cards/m14.jpg',
  demon: '/tarot-cards/m15.jpg',
  tower: '/tarot-cards/m16.jpg',
  star: '/tarot-cards/m17.jpg',
  moon: '/tarot-cards/m18.jpg',
  sun: '/tarot-cards/m19.jpg',
  judgement: '/tarot-cards/m20.jpg',
  world: '/tarot-cards/m21.jpg',
};

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
  imageUrl: TAROT_IMAGES[card.keyword],
}));

// ── 卡牌图片组件（本地图片，永不加载失败） ──
function TarotCardImage({ card, className }: { card: any; className?: string }) {
  return (
    <div className={`w-full h-full relative ${className || ''}`}>
      <img
        src={card.imageUrl}
        alt={card.name}
        className={`w-full h-full object-cover ${card.isReversed ? 'rotate-180' : ''}`}
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </div>
  );
}

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
  const { closeApp, addTarotRecord, deleteTarotRecord, tarotRecords, characters, worldSettings } = useAppStore();
  const [step, setStep] = useState<'start' | 'animating' | 'cards' | 'interpretation' | 'history'>('start');
  const [cards, setCards] = useState<{name: string, keyword: string, imageUrl: string, isReversed: boolean, flipped: boolean}[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatChar, setChatChar] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{sender: 'user'|'friend', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── 自动滚到底部 ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const activeCharacters = Object.values(characters).filter(c => !(c as any).isDisabled);

  const startDivination = () => {
    setStep('animating');
    const shuffled = [...TAROT_CARDS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3).map(card => ({
      name: card.name,
      keyword: card.keyword,
      imageUrl: card.imageUrl,
      isReversed: Math.random() > 0.5,
      flipped: false,
    }));
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

  // ── 暴力擦除一切格式垃圾 ──
  const cleanTarotReply = (text: string): string => {
    return text
      // 删动作描写（括号内的内容）—— 注意不删【】因为要用它做分段标记
      .replace(/[（(][^）)]*[）)]/g, '')
      // 破折号只删符号本身，不删后面的文字
      .replace(/——+/g, ' ')
      .replace(/—{2,}/g, '')
      // Markdown 格式
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#{1,6}\s*/gm, '')
      // 行首各种列表标记
      .replace(/^[-—]{3,}\s*$/gm, '')
      .replace(/^[*_]{3,}\s*$/gm, '')
      .replace(/^[*•·]\s*/gm, '')
      .replace(/^[-]\s+/gm, '')
      .replace(/^\d+[.、）)]\s*/gm, '')
      // 残留的孤星号
      .replace(/\*{1,2}/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // ── 按【开场白】【第一张牌】等标记分段，精确拆成4条消息 ──
  const splitTarotReading = (text: string): string[] => {
    // 先按【xxx】标题劈开
    const sections = text.split(/(?=【[^】]+】)/).filter(Boolean).map(p => p.trim()).filter(p => p.length > 0);
    if (sections.length > 1) {
      return sections.map(s => s.replace(/^【[^】]+】\s*/g, '').trim()).filter(p => p.length > 0);
    }
    // 没有标题标记时（普通对话），按双换行或句子切分
    let parts = text.split(/\n\n+/).filter(Boolean).map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length === 1 && parts[0].length > 60) {
      parts = parts[0].split(/(?<=[。！？!?])\s*/).filter(p => p.trim().length > 0);
    }
    return parts.filter(p => !/^[-—*_•·]{2,}$/.test(p));
  };

  // ── 直接写入记忆库 ──
  const forceSaveTarotMemory = (
    charId: string,
    summary: string,
    content: string,
    importance: number = 5,
  ) => {
    const store = useAppStore.getState();
    const est = estimateSentiment(summary);
    store.addCharacterMemory(charId, {
      type: 'event',
      content,
      summary: summary.slice(0, 80),
      tags: ['塔罗占卜'],
      valence: est.valence,
      arousal: est.arousal,
      importance,
      layer: 'daily',
    });
    store.addEmotionEvent({
      characterId: charId,
      paDelta: 0.15,
      naDelta: -0.05,
      word: '神秘',
      valence: 0.3,
      arousal: 0.5,
      matchSource: 'free_form',
      source: 'manual',
    });
  };
  const handleStartChat = async () => {
    if (activeCharacters.length === 0) return;
    const randomCharId = activeCharacters[Math.floor(Math.random() * activeCharacters.length)].id;
    setChatChar(randomCharId);
    setShowChat(true);
    setIsTyping(true);
    try {
      const char = characters[randomCharId];
      // ── 读取世界书 + 角色卡 ──
      const relevantWorld = worldSettings.find(ws =>
        ws.characters.some(c => c.id === randomCharId)
      );
      const worldContext = relevantWorld
        ? relevantWorld.title + ': ' + relevantWorld.content
        : '';
      const card = relevantWorld?.characters.find(c => c.id === randomCharId) || null;
      const personality = card?.personality || char.personality || '';
      const relationship = card?.relationship || char.relationship || '';
      const biography = card?.biography || char.biography || '';
      const viewOnMe = card?.viewOnMe || (char as any).viewOnMe || '';
      const userNickname = card?.userNickname || char.userNickname || '你';

      const cardDetails = cards.map(c =>
        `${c.name}（${c.isReversed ? '逆位' : '正位'}）`
      ).join('、');

      // ── 构建 system instruction ──
      const sysParts: string[] = [
        '你是' + char.name + '，你和对方的关系是' + relationship + '。',
      ];
      if (worldContext) sysParts.push('世界观：' + worldContext);
      if (biography) sysParts.push('背景：' + biography);
      if (personality) sysParts.push('性格：' + personality);
      if (viewOnMe) sysParts.push('你对对方的看法：' + viewOnMe);
      sysParts.push(
        '对方昵称：' + userNickname + '。你必须根据你和对方的关系来称呼对方。' +
        '如果你们是情侣/恋人，用亲昵称呼；如果是朋友，用对方的名字。绝对不能叫错关系！'
      );
      const systemInstruction = sysParts.join('\n');

      const prompt =
        '现在你正在帮' + userNickname + '解读三张塔罗牌。抽到的牌是：\n' +
        cards.map((c, i) => `第${['一','二','三'][i]}张：${c.name}（${c.isReversed ? '逆位' : '正位'}）`).join('\n') +
        '\n\n你必须严格按照下面的格式输出，一个字都不许改格式：\n\n' +
        '【开场白】\n写一句简短问候和开场的话\n\n' +
        '【第一张牌】\n详细解读第一张牌的含义，150字以上\n\n' +
        '【第二张牌】\n详细解读第二张牌的含义，150字以上\n\n' +
        '【第三张牌】\n详细解读第三张牌的含义，并给出三张牌整体的建议，150字以上\n\n' +
        '规则：\n' +
        '- 必须用【开场白】【第一张牌】【第二张牌】【第三张牌】这四个标题分段\n' +
        '- 四个段落之间用\\n\\n空行分隔\n' +
        '- 严禁任何 Markdown 符号（** * --- # 等）\n' +
        '- 严禁动作描写、神态描写、心理描写——直接说话\n' +
        '- 保持' + char.name + '的性格特点和关系来称呼对方';
      const raw = await generateAIResponse(prompt, systemInstruction);
      const reply = cleanTarotReply(raw);
      const msgParts = splitTarotReading(reply);

      // ── 保存记忆：保证写入 ──
      forceSaveTarotMemory(
        randomCharId,
        `为${userNickname}解读塔罗牌：${cardDetails}`,
        `对方抽到${cardDetails}，我为其解读了牌面含义。解读摘要：${reply.slice(0, 200)}`,
        6
      );

      // ── 逐段发出，每段一条独立消息 ──
      setChatMessages(msgParts.map(p => ({ sender: 'friend' as const, text: p })));
    } catch {
      // AI 调用失败时的后备方案：长篇硬解
      const cardDetails = cards.map(c => `${c.name}（${c.isReversed ? '逆位' : '正位'}）`).join('、');
      const backupLines = [
        `我看到你抽到的牌了——${cardDetails}。让我来帮你说说这几张牌的含义。`,
        cards.map(c => `先聊${c.name}。${c.isReversed ? '逆位' : '正位'}的${c.name}表明这张牌的能量在你的生活中以${c.isReversed ? '内敛、需要反思' : '积极、显化'}的方式呈现。在塔罗中，${c.name}代表${c.keyword === 'fool' ? '新的开始和纯真的冒险精神' : c.keyword === 'lovers' ? '选择、爱情和价值观的融合' : c.keyword === 'tower' ? '突如其来的变革和重建' : '深刻的命运指引'}。`).join('\n\n'),
        `把三张牌放在一起看，它们构成了一个完整的故事脉络。第一张代表你当下的状态，第二张指出你需要关注的课题，第三张暗示发展的方向。整体来看，这段时期你需要相信自己的直觉，同时保持清醒的头脑。`,
        `你对哪张牌特别有感触吗？或者想聊聊你最近在困惑什么，我可以结合牌面帮你一起看看。`
      ];
      setChatMessages(backupLines.filter(Boolean).map(p => ({ sender: 'friend' as const, text: p })));
    } finally {
      setIsTyping(false);
    }
  };

  // ── 后续对话：智能区分"问塔罗知识" vs "求安慰" ──
  const handleSendChat = async () => {
    if (!chatInput.trim() || !chatChar) return;
    const text = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user' as const, text }]);
    setIsTyping(true);
    try {
      const char = characters[chatChar];
      // ── 读取世界书 + 角色卡 ──
      const relevantWorld = worldSettings.find(ws =>
        ws.characters.some(c => c.id === chatChar)
      );
      const worldContext = relevantWorld
        ? relevantWorld.title + ': ' + relevantWorld.content
        : '';
      const card = relevantWorld?.characters.find(c => c.id === chatChar) || null;
      const personality = card?.personality || char.personality || '';
      const relationship = card?.relationship || char.relationship || '';
      const viewOnMe = card?.viewOnMe || (char as any).viewOnMe || '';
      const userNickname = card?.userNickname || char.userNickname || '你';

      const cardDetails = cards.map(c =>
        `${c.name}（${c.isReversed ? '逆位' : '正位'}）`
      ).join('、');

      const sysParts: string[] = [
        '你是' + char.name + '，你和对方的关系是' + relationship + '。',
      ];
      if (worldContext) sysParts.push('世界观：' + worldContext);
      if (personality) sysParts.push('性格：' + personality);
      if (viewOnMe) sysParts.push('你对对方的看法：' + viewOnMe);
      sysParts.push('对方昵称：' + userNickname + '，根据关系正确称呼对方。');
      const systemInstruction = sysParts.join('\n');

      const prompt =
        '对方刚才抽了三张塔罗牌：' + cardDetails +
        '\n对方的上一句话：' + text +
        '\n\n请根据这句话判断：' +
        '\n- 如果对方在问塔罗牌的含义、牌面知识、占卜方法 → 讲解塔罗知识，语气专业又亲切' +
        '\n- 如果对方在表达困惑、焦虑、寻求安慰 → 先温柔安抚，再结合牌面给予鼓励，不说教' +
        '\n- 如果对方只是闲聊 → 轻松回应即可' +
        '\n\n要求：' +
        '\n1. 每条消息自然分段，一段一条消息' +
        '\n2. 每次回复2~3条消息，不要一口气全说完' +
        '\n3. 保持你的性格特点和关系设定' +
        '\n4. 如果对方提到具体牌名，要能说出那张牌的知识' +
        '\n\n【重要】严禁使用任何 Markdown 格式。禁止加粗、斜体、删除线、代码块、---分隔线。直接使用纯文字。\n' +
        '严禁动作描写、神态描写、心理描写。直接说话。';
      const raw = await generateAIResponse(prompt, systemInstruction);
      const reply = cleanTarotReply(raw);

      // ── 保存关键对话到记忆库（强制写入） ──
      const isTarotQuestion = /(牌|塔罗|占卜|正位|逆位|含义|意思|解释|张牌|解牌)/.test(text);
      const isSeekingComfort = /(怎么办|难过|伤心|害怕|担心|迷茫|困惑|好难|累|焦虑|不安|伤心|哭)/.test(text);
      const memImp = isSeekingComfort ? 5 : isTarotQuestion ? 4 : 3;
      forceSaveTarotMemory(
        chatChar,
        isTarotQuestion ? `讨论塔罗知识：${text.slice(0, 40)}` : isSeekingComfort ? `向我寻求安慰：${text.slice(0, 40)}` : text.slice(0, 60),
        `在塔罗占卜后，${userNickname}说"${text}"，我回复了ta`,
        memImp
      );

      // 分段发消息
      const msgParts2 = splitTarotReading(reply);
      setChatMessages(prev => [...prev, ...msgParts2.map(p => ({ sender: 'friend' as const, text: p }))]);
    } catch {
      setChatMessages(prev => [...prev, { sender: 'friend', text: '嗯…让我想想怎么说比较好。' }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (showChat && chatChar) {
    const char = characters[chatChar];
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-purple-50 via-white to-amber-50">
        <div className="px-4 pt-7 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-purple-100">
          <button onClick={() => setShowChat(false)} className="text-purple-600"><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-medium text-gray-800">{char.name}</h1>
          <div className="w-7"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
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
              <div className="p-3 rounded-2xl rounded-bl-none text-sm bg-gray-100 text-gray-400">
                <span className="inline-flex gap-0.5">
                  <span className="animate-bounce text-lg leading-none" style={{animationDelay:'0ms'}}>·</span>
                  <span className="animate-bounce text-lg leading-none" style={{animationDelay:'200ms'}}>·</span>
                  <span className="animate-bounce text-lg leading-none" style={{animationDelay:'400ms'}}>·</span>
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
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
      <div className="px-4 pt-7 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-purple-100">
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
                        <TarotCardImage card={card} />
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
                    <TarotCardImage card={card} />
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
