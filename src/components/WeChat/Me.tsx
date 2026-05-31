import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronRight, Camera, Heart } from 'lucide-react';
import { format } from 'date-fns';
import ImageUploader from '../ImageUploader';

export default function Me() {
  const { settings, updateSettings, moments, characters } = useAppStore();
  const [activeView, setActiveView] = useState<'main' | 'profile' | 'moments' | 'stickers' | 'gifts' | 'settings'>('main');
  const [localName, setLocalName] = useState(settings.wechatName);
  const [localAvatar, setLocalAvatar] = useState(settings.wechatAvatar);
  const [localId, setLocalId] = useState(settings.wechatId);
  const [localSignature, setLocalSignature] = useState(settings.signature);
  const [localBalance, setLocalBalance] = useState(useAppStore.getState().wechatBalance || 0);
  const [localPayPass, setLocalPayPass] = useState(settings.wechatPaymentPasscode || '');
  const [newSticker, setNewSticker] = useState('');

  const handleSaveProfile = () => {
    updateSettings({ 
      wechatName: localName, 
      wechatAvatar: localAvatar,
      wechatId: localId,
      signature: localSignature,
      wechatPaymentPasscode: localPayPass
    });
    useAppStore.setState({ wechatBalance: localBalance });
    setActiveView('main');
  };

  const handleAddSticker = () => {
    if (newSticker) {
      useAppStore.getState().addSticker(newSticker);
      setNewSticker('');
    }
  };

  if (activeView === 'profile') {
    return (
      <div className="h-full flex flex-col bg-gray-100 dark:bg-black">
        <div className="bg-white dark:bg-black dark:text-white px-4 pt-7 pb-3 flex items-center justify-between border-b dark:border-white/5">
          <button onClick={() => setActiveView('main')} className="text-gray-600 dark:text-gray-300">取消</button>
          <h1 className="text-lg font-medium">个人信息</h1>
          <button onClick={handleSaveProfile} className="text-[#07c160]">保存</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">头像</label>
            <ImageUploader onImageSelected={setLocalAvatar} className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 dark:bg-zinc-700 cursor-pointer flex items-center justify-center">
               {localAvatar ? (
                 <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: localAvatar.startsWith('#') ? 'none' : `url(${localAvatar})`, backgroundColor: localAvatar.startsWith('#') ? localAvatar : 'transparent' }} />
               ) : (
                 <Camera className="text-gray-400" />
               )}
            </ImageUploader>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">昵称</label>
            <input 
              type="text" 
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              className="w-full border dark:border-white/10 dark:bg-black/20 rounded p-2 outline-none focus:border-[#07c160]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">微信号</label>
            <input 
              type="text" 
              value={localId}
              onChange={e => setLocalId(e.target.value)}
              className="w-full border dark:border-white/10 dark:bg-black/20 rounded p-2 outline-none focus:border-[#07c160]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">个性签名</label>
            <input 
              type="text" 
              value={localSignature}
              onChange={e => setLocalSignature(e.target.value)}
              className="w-full border dark:border-white/10 dark:bg-black/20 rounded p-2 outline-none focus:border-[#07c160]"
            />
          </div>
          <div className="pt-4 border-t border-white/5">
            <h3 className="text-sm font-bold mb-3 text-gray-100">支付与钱包</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">钱包余额</label>
                <input 
                  type="number" 
                  value={localBalance}
                  onChange={e => setLocalBalance(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">支付密码 (6位数)</label>
                <input 
                  type="password" 
                  maxLength={6}
                  value={localPayPass}
                  onChange={e => setLocalPayPass(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full border rounded p-2 tracking-[0.5em] font-mono text-center"
                  placeholder="未设置"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeView === 'moments') {
    const myMoments = moments.filter(m => m.authorId === 'user');
    return (
      <div className="h-full flex flex-col bg-white dark:bg-black transition-colors">
        <div className="bg-gray-100 dark:bg-[#191919] px-4 pt-7 pb-3 flex items-center justify-between border-b dark:border-white/5">
          <button onClick={() => setActiveView('main')} className="text-gray-600 dark:text-gray-300">返回</button>
          <h1 className="text-lg font-medium dark:text-gray-100">我的朋友圈</h1>
          <div className="w-8"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {myMoments.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">暂无朋友圈</div>
          ) : (
            myMoments.map(moment => (
              <div key={moment.id} className="flex gap-3 border-b dark:border-white/10 pb-6 transition-colors">
                <div className="w-12 text-xl font-bold text-gray-800 dark:text-gray-100 shrink-0">
                  {format(moment.timestamp, 'dd')}
                  <span className="text-xs font-normal text-gray-500 block">{format(moment.timestamp, 'MM月')}</span>
                </div>
                <div className="flex-1">
                  {moment.content && <div className="text-[15px] mb-2 whitespace-pre-wrap dark:text-gray-200">{moment.content}</div>}
                  {moment.imageUrl && (
                    <img src={moment.imageUrl} alt="moment" className="max-w-[200px] max-h-[200px] object-cover mb-2" />
                  )}
                  {moment.musicUrl && (
                    <div className="bg-gray-100 dark:bg-[#191919] p-2 flex items-center gap-2 mb-2 rounded transition-colors">
                      <div className="w-10 h-10 bg-gray-300 dark:bg-[#3c3c3c] flex items-center justify-center text-xs dark:text-gray-300">Music</div>
                      <div className="text-sm truncate flex-1 dark:text-gray-200">{moment.musicUrl}</div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (activeView === 'stickers') {
    const { stickers, addSticker } = useAppStore.getState();
    return (
      <div className="h-full flex flex-col bg-gray-100 dark:bg-black">
        <div className="bg-white dark:bg-black px-4 pt-14 pb-3 flex items-center justify-between border-b dark:border-white/5 transition-colors">
          <button onClick={() => setActiveView('main')} className="text-gray-600 dark:text-gray-300">返回</button>
          <h1 className="text-lg font-medium dark:text-gray-100">我的表情</h1>
          <div className="w-8"></div>
        </div>
        <div className="p-4 bg-white dark:bg-black mb-2 flex gap-2 border-b dark:border-white/5 transition-colors">
          <ImageUploader onImageSelected={(url) => { addSticker(url); setActiveView('stickers'); }} className="flex-1 border dark:border-white/10 dark:text-gray-300 rounded p-2 text-sm text-center text-gray-500 cursor-pointer">
            点击选择本地图片添加为表情
          </ImageUploader>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-black grid grid-cols-4 gap-2 content-start transition-colors">
          {stickers.map((url, i) => (
            <img key={i} src={url} alt="sticker" className="w-full aspect-square object-cover rounded bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (activeView === 'gifts') {
    const { wechatGifts, characters } = useAppStore.getState();
    return (
      <div className="h-full flex flex-col bg-gray-100 dark:bg-black">
        <div className="bg-white dark:bg-black px-4 pt-14 pb-3 flex items-center justify-between border-b dark:border-white/5 transition-colors">
          <button onClick={() => setActiveView('main')} className="text-gray-600 dark:text-gray-300">返回</button>
          <h1 className="text-lg font-medium dark:text-gray-100">收到的礼物</h1>
          <div className="w-8"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!wechatGifts || wechatGifts.length === 0 ? (
             <div className="text-center text-gray-400 mt-20">暂未收到礼物</div>
          ) : (
            wechatGifts.map(gift => {
               const char = characters[gift.senderId];
               return (
                 <div key={gift.id} className="bg-white dark:bg-[#191919] p-4 rounded-xl flex items-center gap-4 shadow-sm border border-slate-200 dark:border-white/10">
                    <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-2xl shrink-0 grayscale">🎁</div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-800 dark:text-gray-100 mb-1">{gift.name}</div>
                      <div className="text-xs text-gray-500 flex justify-between">
                         <span>来自: {char ? char.name : '未知'}</span>
                         <span>{format(gift.timestamp, 'MM-dd HH:mm')}</span>
                      </div>
                    </div>
                 </div>
               )
            })
          )}
        </div>
      </div>
    );
  }

  if (activeView === 'settings') {
    return (
      <div className="h-full flex flex-col bg-gray-100 dark:bg-black">
        <div className="bg-white dark:bg-[#191919] px-4 pt-14 pb-3 flex items-center gap-4 border-b dark:border-white/5 transition-colors">
          <button onClick={() => setActiveView('main')} className="text-gray-900 dark:text-gray-100">
            <ChevronRight className="rotate-180" />
          </button>
          <h1 className="text-lg font-medium dark:text-gray-100">设置</h1>
        </div>
        <div className="flex-1 overflow-y-auto pt-2 space-y-2">
          <div className="bg-white dark:bg-[#191919] px-4 py-4 flex justify-between items-center transition-colors cursor-pointer" onClick={() => setActiveView('profile')}>
            <span className="text-[17px] dark:text-gray-100">个人信息更改</span>
            <ChevronRight className="text-gray-400 dark:text-gray-500" />
          </div>
          
          <div className="bg-white dark:bg-[#191919] px-4 py-4 flex justify-between items-center transition-colors">
            <span className="text-[17px] dark:text-gray-100">深色模式</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                 type="checkbox" 
                 checked={settings.wechatTheme === 'dark'} 
                 onChange={e => updateSettings({ wechatTheme: e.target.checked ? 'dark' : 'light' })}
                 className="sr-only peer" 
              />
              <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[24px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-[#07c160]"></div>
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#ededed] dark:bg-black">
      <div className="bg-white dark:bg-black pt-16 pb-8 px-6 flex items-center gap-4 mb-2 cursor-pointer" onClick={() => setActiveView('profile')}>
        <div 
          className="w-16 h-16 rounded-lg bg-cover bg-center"
          style={{ backgroundImage: settings.wechatAvatar && !settings.wechatAvatar.startsWith('#') ? `url(${settings.wechatAvatar})` : 'none', backgroundColor: settings.wechatAvatar?.startsWith('#') ? settings.wechatAvatar : '#ffffff' }}
        />
        <div className="flex-1">
          <div className="text-xl font-medium mb-1 dark:text-gray-100">{settings.wechatName}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">微信号: {settings.wechatId}</div>
        </div>
        <ChevronRight className="text-gray-400 dark:text-gray-500" />
      </div>

      <div className="bg-white dark:bg-black px-4 py-3 flex justify-between items-center border-b border-t dark:border-white/5 mb-2 cursor-pointer" onClick={() => setActiveView('moments')}>
        <span className="dark:text-gray-100">朋友圈</span>
        <ChevronRight className="text-gray-400 dark:text-gray-500" />
      </div>
      
      <div className="bg-white dark:bg-black px-4 py-3 flex justify-between items-center border-b border-t dark:border-white/5 cursor-pointer" onClick={() => setActiveView('stickers')}>
        <span className="dark:text-gray-100">表情</span>
        <ChevronRight className="text-gray-400 dark:text-gray-500" />
      </div>

      <div className="bg-white dark:bg-black px-4 py-3 flex justify-between items-center border-b border-t dark:border-white/5 mt-2 cursor-pointer" onClick={() => setActiveView('gifts')}>
        <span className="dark:text-gray-100 text-slate-700">收到的礼物</span>
        <ChevronRight className="text-gray-400 dark:text-gray-500" />
      </div>
      
      
      <div className="bg-white dark:bg-black px-4 py-3 flex justify-between items-center border-b border-t dark:border-white/5 mt-2 cursor-pointer" onClick={() => setActiveView('settings')}>
        <span className="dark:text-gray-100">设置</span>
        <ChevronRight className="text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  );
}
