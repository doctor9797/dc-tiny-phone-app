import { useState } from 'react';
import { ChevronLeft, Wallpaper, Lock } from 'lucide-react';

interface Props {
  characterId: string;
  lockscreenWallpaper: string;
  homeWallpaper: string;
  passcode: string;
  onSetLockWall: (val: string) => void;
  onSetHomeWall: (val: string) => void;
  onSetPasscode: (val: string) => void;
  onHome: () => void;
  onChange?: (description: string) => void;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 400;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SettingsApp({
  characterId,
  lockscreenWallpaper,
  homeWallpaper,
  passcode,
  onSetLockWall,
  onSetHomeWall,
  onSetPasscode,
  onHome,
  onChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<'main' | 'wallpaper' | 'passcode'>('main');
  const [newPass, setNewPass] = useState(passcode);
  const [newLockWall, setNewLockWall] = useState(lockscreenWallpaper);
  const [newHomeWall, setNewHomeWall] = useState(homeWallpaper);

  return (
    <div className="w-full h-full bg-[#f2f2f7] flex flex-col pt-7">
      <div className="flex items-center justify-between px-4 mb-4 shrink-0">
        {activeTab !== 'main' ? (
          <button onClick={() => setActiveTab('main')} className="flex items-center text-blue-500 font-medium">
            <ChevronLeft size={24} className="-ml-2" />
            <span className="text-[17px]">设置</span>
          </button>
        ) : (
          <>
            <h1 className="text-3xl font-bold ml-2">设置</h1>
            <button onClick={onHome} className="text-blue-500 text-[15px] font-medium">返回</button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto w-full">
        {activeTab === 'main' && (
          <div className="bg-white mx-4 rounded-xl shadow-sm border border-gray-200 overflow-hidden text-[17px]">
            <button
              onClick={() => setActiveTab('wallpaper')}
              className="w-full flex items-center justify-between p-3 border-b border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-md bg-blue-500 text-white flex items-center justify-center">
                  <Wallpaper size={18} />
                </div>
                <span>壁纸</span>
              </div>
              <ChevronLeft size={20} className="rotate-180 text-gray-400" />
            </button>
            <button
              onClick={() => setActiveTab('passcode')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-md bg-green-500 text-white flex items-center justify-center">
                  <Lock size={18} />
                </div>
                <span>{passcode ? '修改密码' : '设置密码'}</span>
              </div>
              <ChevronLeft size={20} className="rotate-180 text-gray-400" />
            </button>
          </div>
        )}

        {activeTab === 'wallpaper' && (
          <div className="px-4">
            <h2 className="text-xl font-bold mb-4">更换壁纸</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-2">
              <div className="p-3 border-b border-gray-100 text-sm text-gray-500">锁屏壁纸</div>
              <div className="p-3 flex items-center gap-3">
                {newLockWall && (
                  <div className="w-12 h-20 rounded-lg bg-cover bg-center shrink-0 border border-gray-200"
                    style={{ backgroundImage: 'url(' + newLockWall + ')' }}
                  />
                )}
                <label className="flex-1 flex items-center justify-center py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-blue-500 text-sm font-medium cursor-pointer hover:bg-gray-100 active:scale-[0.98] transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const dataUrl = await readFileAsDataURL(file);
                        setNewLockWall(dataUrl);
                      }
                    }}
                  />
                  {newLockWall ? '更换图片' : '选择图片'}
                </label>
                {newLockWall && (
                  <button onClick={() => setNewLockWall('')} className="text-red-500 text-xs shrink-0">清除</button>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-2">
              <div className="p-3 border-b border-gray-100 text-sm text-gray-500">桌面壁纸</div>
              <div className="p-3 flex items-center gap-3">
                {newHomeWall && (
                  <div className="w-12 h-20 rounded-lg bg-cover bg-center shrink-0 border border-gray-200"
                    style={{ backgroundImage: 'url(' + newHomeWall + ')' }}
                  />
                )}
                <label className="flex-1 flex items-center justify-center py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-blue-500 text-sm font-medium cursor-pointer hover:bg-gray-100 active:scale-[0.98] transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const dataUrl = await readFileAsDataURL(file);
                        setNewHomeWall(dataUrl);
                      }
                    }}
                  />
                  {newHomeWall ? '更换图片' : '选择图片'}
                </label>
                {newHomeWall && (
                  <button onClick={() => setNewHomeWall('')} className="text-red-500 text-xs shrink-0">清除</button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-6 ml-2">
              支持 PNG、JPG 等图片格式
            </p>
            <button
              onClick={() => {
                if (newLockWall !== lockscreenWallpaper) onSetLockWall(newLockWall);
                if (newHomeWall !== homeWallpaper) onSetHomeWall(newHomeWall);
                const parts: string[] = [];
                if (newLockWall !== lockscreenWallpaper) parts.push('锁屏壁纸');
                if (newHomeWall !== homeWallpaper) parts.push('桌面壁纸');
                if (parts.length > 0) onChange?.('更换了' + parts.join('，'));
                setActiveTab('main');
              }}
              className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl active:bg-blue-600 transition-colors"
            >
              保存壁纸
            </button>
          </div>
        )}

        {activeTab === 'passcode' && (
          <div className="px-4">
            <h2 className="text-xl font-bold mb-4">{passcode ? '修改密码' : '设置密码'}</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-2">
              <input
                type="text"
                value={newPass}
                onChange={e => setNewPass(e.target.value.replace(/\D/g, ''))}
                maxLength={4}
                placeholder="留空则不设密码"
                className="w-full p-3 outline-none text-[17px] text-center tracking-widest"
              />
            </div>
            <p className="text-xs text-gray-500 mb-6 ml-2 text-center">
              4 位数字密码。留空则上滑直接解锁。
            </p>
            <button
              onClick={() => {
                if (newPass !== passcode) {
                  onSetPasscode(newPass);
                  onChange?.(newPass ? '设置了锁屏密码' + newPass : '清除了锁屏密码');
                }
                setActiveTab('main');
              }}
              className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl active:bg-blue-600 transition-colors"
            >
              保存密码
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
