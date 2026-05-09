import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { Lock, Wifi, Battery } from 'lucide-react';

export default function LockScreen() {
  const { unlock, settings } = useAppStore();
  const [time, setTime] = useState(new Date());
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const utc = time.getTime() + (time.getTimezoneOffset() * 60000);
  const beijingTime = new Date(utc + (3600000 * 8) + ((settings.timeOffsetMinutes || 0) * 60000));

  const handleSwipeUp = (e: any, info: any) => {
    if (info.offset.y < -100) {
      if (settings.passcode) {
        setShowPasscode(true);
      } else {
        unlock();
      }
    }
  };

  const handlePasscodeEnter = (digit: string) => {
    if (digit === '') return;
    setErrorMsg('');
    setIsError(false);
    
    // Clear passcode early if we were in an error state
    let currentPasscode = isError ? '' : passcode;
    const newPasscode = currentPasscode + digit;
    
    setPasscode(newPasscode);
    if (newPasscode.length === settings.passcode.length) {
      if (newPasscode === settings.passcode) {
        unlock();
      } else {
        setErrorMsg('密码错误');
        setIsError(true);
        // Will clear array visually but logically clear it next type or delay
      }
    }
  };

  const getBackgroundStyle = () => {
    const isUsingDefault = settings.lockscreenWallpaper === '#0f172a' || settings.lockscreenWallpaper === '' || settings.lockscreenWallpaper === '#1e293b';
    const isImage = settings.lockscreenWallpaper?.startsWith('http') || settings.lockscreenWallpaper?.startsWith('data:');
    if (isImage || (!isUsingDefault && !settings.osTheme)) {
      return { background: `url(${settings.lockscreenWallpaper}) center/cover no-repeat` };
    }
    const themeColors: any = {
      'cyan': 'linear-gradient(to bottom, #0284c7, #082f49)',
      'pink': 'linear-gradient(to bottom, #db2777, #831843)',
      'white': '#ffffff',
      'green': 'linear-gradient(to bottom, #047857, #064e3b)',
      'purple': 'linear-gradient(to bottom, #6b21a8, #3b0764)',
      'black': '#000000',
      'gray': 'linear-gradient(to bottom, #374151, #111827)'
    };
    const bg = settings.osTheme ? (themeColors[settings.osTheme] || themeColors['gray']) : (themeColors['gray']);
    const textColor = settings.osTheme === 'white' ? '#1e293b' : '#ffffff';

    return { 
      background: bg,
      color: textColor
    };
  };

  return (
    <motion.div 
      className="absolute inset-0 z-50 flex flex-col items-center justify-between overflow-hidden"
      style={getBackgroundStyle()}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={handleSwipeUp}
    >
      <div className="w-full flex justify-end px-6 pt-4 text-sm font-medium">
        <div className="flex items-center gap-2">
          <Wifi size={16} />
          <Battery size={16} />
        </div>
      </div>

      <AnimatePresence>
        {!showPasscode ? (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center mt-20 flex-1"
          >
            <Lock size={24} className="mb-4" />
            <div className="text-7xl font-light tracking-wider">
              {format(beijingTime, 'HH:mm')}
            </div>
            <div className="text-xl mt-2 font-medium">
              {format(beijingTime, 'MM月dd日 EEEE')}
            </div>
            
            <div className="mt-auto mb-10 animate-bounce text-sm opacity-80">
              向上滑动解锁
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center flex-1 w-full px-8"
          >
            <div className="text-xl mb-4 font-medium tracking-widest">{errorMsg ? " " : "输入密码"}</div>
            
            {/* Error Message Space */}
            <div className={`text-base mb-4 font-medium h-6 text-rose-400 ${errorMsg ? 'animate-pulse' : 'opacity-0'}`}>
              {errorMsg}
            </div>
            
            <motion.div 
              className="flex gap-4 mb-12"
              animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              {Array.from({ length: settings.passcode.length }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-full border-2 transition-colors ${i < passcode.length ? 'bg-white' : 'border-white'} ${isError && i < passcode.length ? 'bg-rose-400 border-rose-400' : ''}`} 
                />
              ))}
            </motion.div>
            
            <div className="grid grid-cols-3 gap-y-4 gap-x-8 w-full max-w-[280px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, passcode.length > 0 ? 'delete' : 'cancel'].map((key, i) => (
                <div key={i} className="flex justify-center flex-col items-center">
                  {key === 'cancel' ? (
                    <button
                      onClick={() => {
                        setShowPasscode(false);
                        setPasscode('');
                        setErrorMsg('');
                        setIsError(false);
                      }}
                      className="w-20 h-20 flex items-center justify-center text-sm font-bold opacity-90 active:opacity-100"
                    >
                      取消
                    </button>
                  ) : key === 'delete' ? (
                    <button
                      onClick={() => setPasscode(prev => prev.slice(0, -1))}
                      className="w-20 h-20 flex items-center justify-center text-sm font-bold opacity-90 active:opacity-100"
                    >
                      删除
                    </button>
                  ) : key !== '' ? (
                    <button
                      onClick={() => handlePasscodeEnter(key.toString())}
                      className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-light bg-black/20 active:bg-white/30 backdrop-blur-sm transition-colors border border-white/10"
                    >
                      {key}
                    </button>
                  ) : (
                    <div className="w-20 h-20" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
