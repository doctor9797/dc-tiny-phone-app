import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { Image as ImageIcon } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { format } from 'date-fns';
import ImageUploader from '../ImageUploader';

export default function BottleApp() {
  const { closeApp, bottles, throwBottle, receiveBottleReply, characters, settings, updateSettings, addActivityLog } = useAppStore();
  const [showThrow, setShowThrow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isThrowing, setIsThrowing] = useState(false);

  const handleThrow = () => {
    if (!text.trim() && !imageUrl) return;
    setIsThrowing(true);

    throwBottle(text, imageUrl);
    const currentText = text;
    addActivityLog({
      id: `${Date.now()}_bottle_throw`,
      title: '扔出漂流瓶',
      detail: (text || '发送了一个漂流瓶').slice(0, 60),
      timestamp: Date.now()
    });
    setText('');
    setImageUrl('');

    setTimeout(async () => {
      setIsThrowing(false);
      setShowThrow(false);

      // Randomly pick a character to reply after 5-10 seconds
      setTimeout(async () => {
        const activeCharacters = Object.values(characters).filter(c => !(c as any).isDisabled);
        if (activeCharacters.length === 0) return;

        const randomCharId = activeCharacters[Math.floor(Math.random() * activeCharacters.length)].id;
        const char = characters[randomCharId];

        const bottleContent = currentText + (imageUrl ? ' [附带了图片]' : '');
        const prompt = `我扔了一个漂流瓶，内容是："${bottleContent}"。请你以DC角色${char.name}的身份，捡到这个漂流瓶并给出一个简短的回复。不要暴露你的真实身份，保持神秘感，但要符合你的性格。`;

        try {
          const reply = await generateAIResponse(prompt);
          saveInteractionMemory(randomCharId, `${char.name}捡到了我的漂流瓶并回复了我`, reply);
          useAppStore.getState().addEmotionEvent({ characterId: randomCharId, paDelta: 0.15, naDelta: -0.03, word: '好奇', valence: 0.35, arousal: 0.4, matchSource: 'free_form', source: 'manual' });

          // 将漂流瓶内容和回复存入角色的记忆库（用AI做总结，不是原文背诵）
          const memoryPrompt = `以下是用户扔出的漂流瓶内容和${char.name}的回复。请用一句话总结${char.name}捡到了什么样的漂流瓶以及他/她如何回应的。只输出总结，不输出其他内容。

漂流瓶内容：${bottleContent}
${char.name}的回复：${reply}`;
          try {
            const memorySummary = await generateAIResponse(memoryPrompt);
            if (memorySummary && memorySummary.trim()) {
              saveInteractionMemory(randomCharId, memorySummary.trim(), `漂流瓶: ${bottleContent}\n回复: ${reply}`, 'event', 4);
            }
          } catch (e) {
            // memory summary 非关键，静默失败
          }
          useAppStore.getState().addEmotionEvent({ characterId: randomCharId, paDelta: 0.12, naDelta: -0.02, word: '期待', valence: 0.3, arousal: 0.35, matchSource: 'free_form', source: 'manual' });
          const latestBottle = useAppStore.getState().bottles[0];
          if (latestBottle) {
            receiveBottleReply(latestBottle.id, reply);

            // Add notification
            const { setNotification } = useAppStore.getState();
            setNotification({
              id: Date.now(),
              characterId: randomCharId,
              text: `神秘人回复了你的漂流瓶：${reply.substring(0, 30)}${reply.length > 30 ? '...' : ''}`,
              sourceApp: 'wechat' as const,
            });

            addActivityLog({
              id: `${Date.now()}_bottle_reply`,
              title: `${char.name}捡到漂流瓶`,
              detail: `回复了你扔出的漂流瓶：${(currentText || '一只漂流瓶').slice(0, 36)}`,
              timestamp: Date.now(),
              relatedCharacterIds: [randomCharId]
            });
          }
        } catch (e) {
          console.error(e);
        }
      }, 5000 + Math.random() * 5000);

    }, 1000);
  };

  return (
    <div className="h-full flex flex-col bg-blue-900 text-white relative">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
        style={{ backgroundImage: `url(${settings.bottleWallpaper || 'https://images.unsplash.com/photo-1498623116890-37e912163d5d?q=80&w=1000&auto=format&fit=crop'})` }}
      ></div>

      <div className="px-4 pt-7 pb-4 flex items-center justify-between relative z-10">
        <div className="w-8"></div>
        <h1 className="text-lg font-medium">漂流瓶</h1>
        <button onClick={() => setShowSettings(true)}><ImageIcon size={22} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative z-10 space-y-4">
        {bottles.map(bottle => (
          <div key={bottle.id} className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-blue-200">{format(bottle.timestamp, 'MM-dd HH:mm')}</div>
              <button
                onClick={() => useAppStore.setState(state => ({ bottles: state.bottles.filter(b => b.id !== bottle.id) }))}
                className="text-xs text-red-300 hover:text-red-400"
              >
                删除
              </button>
            </div>
            {bottle.text && <div className="text-sm mb-3 whitespace-pre-wrap">我：{bottle.text}</div>}
            {bottle.imageUrl && <img src={bottle.imageUrl} alt="bottle" className="w-full rounded-lg mb-3" />}
            {bottle.reply ? (
              <div className="bg-blue-800/50 rounded p-3 text-sm border border-blue-400/30">
                <span className="text-blue-300">神秘人回复：</span>
                {bottle.reply}
              </div>
            ) : (
              <div className="text-xs text-blue-300 italic">漂流瓶在海上漂流中...</div>
            )}
          </div>
        ))}
      </div>

      <div className="p-6 flex justify-center relative z-10 pb-safe">
        <button
          onClick={() => setShowThrow(true)}
          className="bg-white/20 hover:bg-white/30 backdrop-blur border border-white/40 px-8 py-3 rounded-full font-medium tracking-wider transition-colors"
        >
          扔一个漂流瓶
        </button>
      </div>

      {showThrow && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-6 text-gray-900 h-[70%] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setShowThrow(false)} className="text-gray-500">取消</button>
              <span className="font-medium">写漂流瓶</span>
              <button
                onClick={handleThrow}
                disabled={(!text.trim() && !imageUrl) || isThrowing}
                className="text-blue-500 disabled:opacity-50"
              >
                {isThrowing ? '扔出...' : '扔出去'}
              </button>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              className="flex-1 w-full resize-none outline-none text-[15px] bg-gray-50 rounded-xl p-4 mb-4"
              placeholder="写下你想说的话..."
            />
            {imageUrl ? (
              <div className="relative mb-4">
                <img src={imageUrl} alt="preview" className="w-full h-40 object-cover rounded-xl" />
                <button
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ) : (
              <ImageUploader onImageSelected={(url) => setImageUrl(url)}>
                <div className="w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 text-sm text-gray-400 text-center cursor-pointer mb-4">
                  📷 添加图片（从本机导入）
                </div>
              </ImageUploader>
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-6 text-gray-900 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setShowSettings(false)} className="text-gray-500">取消</button>
              <span className="font-medium">更换背景</span>
              <button onClick={() => setShowSettings(false)} className="text-blue-500 font-medium">完成</button>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-2">当前背景</div>
              {settings.bottleWallpaper ? (
                <div className="relative rounded-2xl overflow-hidden mb-3">
                  <img src={settings.bottleWallpaper} alt="background" className="w-full h-32 object-cover rounded-2xl" />
                  <button
                    onClick={() => updateSettings({ bottleWallpaper: '' })}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-full h-32 bg-blue-800/30 rounded-2xl flex items-center justify-center mb-3">
                  <span className="text-blue-300 text-sm">默认海景背景</span>
                </div>
              )}
            </div>
            <ImageUploader onImageSelected={(url) => updateSettings({ bottleWallpaper: url })}>
              <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-500 font-bold text-center cursor-pointer">
                导入本机图片作为背景
              </div>
            </ImageUploader>
          </div>
        </div>
      )}
    </div>
  );
}
