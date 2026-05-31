import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, User, Heart, Brain, Dumbbell, Hand, BookOpen, Battery, Smile, Pizza, Compass, Briefcase, Zap, PawPrint, Gamepad2, Store, CircleDollarSign, X, Sparkles, Trophy, Target } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';

const PET_TYPES = [
  { id: 'dog', name: '小狗', palette: ['#f8d7b5', '#d79a62', '#6a4a2f'] },
  { id: 'cat', name: '小猫', palette: ['#ffd6df', '#c78b95', '#5f434d'] },
  { id: 'bird', name: '鹦鹉', palette: ['#d2f0a6', '#7cb342', '#355d1b'] },
  { id: 'rabbit', name: '兔子', palette: ['#f7f0f4', '#d7c2d1', '#6f5a68'] },
  { id: 'hamster', name: '仓鼠', palette: ['#f3d4a8', '#c58a52', '#7a4b24'] },
  { id: 'turtle', name: '乌龟', palette: ['#b8efc8', '#4caf6b', '#2f5c3d'] },
];

const FURNITURES = [
  { id: 'f1', name: '云朵软垫', style: 'cloud', price: 50 },
  { id: 'f2', name: '糖果爬架', style: 'tower', price: 150 },
  { id: 'f3', name: '奶油沙发', style: 'sofa', price: 150 },
  { id: 'f4', name: '星球鱼缸', style: 'aquarium', price: 300 },
  { id: 'f5', name: '绒绒玩偶', style: 'plush', price: 60 },
  { id: 'f6', name: '发光跑轮', style: 'wheel', price: 200 },
  { id: 'f7', name: '蘑菇盆栽', style: 'plant', price: 120 },
  { id: 'f8', name: '抓抓木柱', style: 'post', price: 80 },
  { id: 'f9', name: '暖暖夜灯', style: 'lamp', price: 90 },
  { id: 'f10', name: '小帐篷', style: 'tent', price: 180 },
  { id: 'f11', name: '饮水台', style: 'fountain', price: 110 },
  { id: 'f12', name: '壁炉角', style: 'fireplace', price: 400 },
  { id: 'f13', name: '旋律盒', style: 'musicBox', price: 250 },
  { id: 'f14', name: '彩绒地毯', style: 'rug', price: 130 },
  { id: 'f15', name: '跳跳球架', style: 'toy', price: 40 },
];

const PET_THOUGHTS = {
  dog: ['今天想跑得更快一点', '如果现在有零食就好了', '我想贴着你们坐一会', '今天的空气闻起来很新鲜'],
  cat: ['这个角落现在属于我了', '想再被摸摸脑袋', '我其实已经注意你很久了', '窗边的光让我有点困'],
  bird: ['我想试试新的节奏', '高处看起来更有安全感', '今天想唱一段短短的旋律', '你们刚刚的声音很好听'],
  rabbit: ['想钻进软软的地方', '胡萝卜应该快到了吧', '今天想轻轻跳两下', '我现在心情很平静'],
  hamster: ['跑轮是不是该开始了', '我想把小窝整理一下', '今天适合偷偷囤点东西', '我刚想到一个新路线'],
  turtle: ['慢一点也很好', '阳光照在背上很舒服', '今天想待在暖和的地方', '我正在认真观察你们']
};

function PetFigure({ petType, stage = 'baby' }: { petType: string; stage?: string }) {
  const palette = PET_TYPES.find(type => type.id === petType)?.palette || ['#f4d6b2', '#c58b5a', '#5a402a'];
  const scale = stage === 'egg' ? 0.7 : stage === 'baby' ? 0.85 : stage === 'child' ? 1 : 1.12;
  const isRoundPet = petType === 'hamster' || petType === 'bird';
  const isLongEar = petType === 'rabbit';
  const isCat = petType === 'cat';
  const isTurtle = petType === 'turtle';

  return (
    <div className="relative" style={{ transform: `scale(${scale})` }}>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-24 h-4 bg-black/12 blur-md rounded-full" />
      <div className="relative w-32 h-32">
        <div
          className={`absolute left-1/2 -translate-x-1/2 top-5 shadow-xl border border-white/35 ${
            isRoundPet ? 'w-20 h-20 rounded-full' : 'w-22 h-20 rounded-[42px]'
          }`}
          style={{ backgroundImage: `linear-gradient(to bottom, ${palette[0]}, ${palette[1]})` }}
        />
        {isTurtle ? (
          <>
            <div className="absolute left-1/2 -translate-x-1/2 top-8 w-20 h-16 rounded-[36px] border border-white/30 shadow-lg" style={{ backgroundImage: `linear-gradient(to bottom, ${palette[1]}, ${palette[2]})` }} />
            <div className="absolute left-1/2 -translate-x-1/2 top-14 w-9 h-8 rounded-full bg-[#dff7e7] border border-white/35" />
          </>
        ) : (
          <>
            <div className={`absolute top-1 shadow-md ${isLongEar ? 'left-7 w-6 h-18 rounded-t-[18px] rounded-b-[10px] -rotate-[10deg]' : 'left-6 w-7 h-11 rounded-t-[18px] rounded-b-[10px] -rotate-[10deg]'}`} style={{ backgroundImage: `linear-gradient(to bottom, ${palette[0]}, ${palette[1]})` }} />
            <div className={`absolute top-1 shadow-md ${isLongEar ? 'right-7 w-6 h-18 rounded-t-[18px] rounded-b-[10px] rotate-[10deg]' : 'right-6 w-7 h-11 rounded-t-[18px] rounded-b-[10px] rotate-[10deg]'}`} style={{ backgroundImage: `linear-gradient(to bottom, ${palette[0]}, ${palette[1]})` }} />
            <div className={`absolute ${isLongEar ? 'left-[33px] top-4 h-10' : 'left-[31px] top-4 h-5'} w-3 rounded-full bg-white/35`} />
            <div className={`absolute ${isLongEar ? 'right-[33px] top-4 h-10' : 'right-[31px] top-4 h-5'} w-3 rounded-full bg-white/35`} />
          </>
        )}
        <div className="absolute left-[42px] top-[55px] w-3.5 h-4.5 rounded-full bg-[#2f241d]" />
        <div className="absolute right-[42px] top-[55px] w-3.5 h-4.5 rounded-full bg-[#2f241d]" />
        <div className="absolute left-[45px] top-[58px] w-1.5 h-1.5 rounded-full bg-white" />
        <div className="absolute right-[45px] top-[58px] w-1.5 h-1.5 rounded-full bg-white" />
        <div className={`absolute left-1/2 -translate-x-1/2 top-[73px] ${isCat ? 'w-11 h-8' : 'w-10 h-7'} rounded-[18px] bg-[#fff4ec] shadow-inner border border-white/40`}>
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-3 h-2 rounded-full bg-[#9a6670]" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-5 h-2 rounded-b-full border-b-2 border-[#9a6670]" />
        </div>
        {!isTurtle && (
          <>
            <div className="absolute left-8 bottom-3 w-4 h-7 rounded-full bg-white/25" />
            <div className="absolute right-8 bottom-3 w-4 h-7 rounded-full bg-white/25" />
          </>
        )}
      </div>
    </div>
  );
}

function FurnitureFigure({ style }: { style: string }) {
  const commonClass = 'w-full h-full rounded-2xl shadow-[0_12px_20px_rgba(0,0,0,0.18)]';
  if (style === 'sofa') return <div className={`${commonClass} bg-gradient-to-b from-pink-100 to-pink-300 border border-white/50 relative`}><div className="absolute inset-x-3 bottom-2 h-5 rounded-full bg-pink-50/80" /></div>;
  if (style === 'tower') return <div className={`${commonClass} bg-gradient-to-b from-amber-100 to-amber-300 border border-white/50 relative`}><div className="absolute inset-x-5 top-3 bottom-3 rounded-xl border-4 border-white/35" /></div>;
  if (style === 'aquarium') return <div className={`${commonClass} bg-gradient-to-b from-sky-200 to-cyan-400 border border-white/60 relative`}><div className="absolute inset-x-2 bottom-2 h-3 rounded-full bg-cyan-900/15" /></div>;
  if (style === 'wheel') return <div className={`${commonClass} flex items-center justify-center bg-gradient-to-b from-fuchsia-100 to-purple-300 border border-white/50`}><div className="w-12 h-12 rounded-full border-[6px] border-white/70" /></div>;
  if (style === 'plant') return <div className={`${commonClass} bg-gradient-to-b from-lime-100 to-emerald-200 border border-white/50 relative`}><div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-9 h-7 rounded-b-xl bg-amber-700/60" /></div>;
  if (style === 'fireplace') return <div className={`${commonClass} bg-gradient-to-b from-stone-200 to-stone-400 border border-white/50 relative`}><div className="absolute inset-x-4 bottom-3 h-8 rounded-xl bg-orange-300/80" /></div>;
  if (style === 'rug') return <div className={`${commonClass} bg-gradient-to-r from-rose-200 via-amber-100 to-sky-200 border border-white/50`} />;
  if (style === 'toy') return <div className={`${commonClass} bg-gradient-to-b from-amber-100 to-yellow-300 border border-white/50 flex items-center justify-center`}><div className="w-6 h-6 rounded-full bg-rose-300 shadow" /></div>;
  return <div className={`${commonClass} bg-gradient-to-b from-white to-slate-200 border border-white/50`} />;
}

const DraggableFurniture: React.FC<{ item: any; onPositionChange: (x: number, y: number) => void }> = ({ item, onPositionChange }) => {
  const [pos, setPos] = useState({ x: item.x, y: item.y });
  const [isDragging, setIsDragging] = useState(false);
  const furnitureData = FURNITURES.find(f => f.id === item.fId);

  return (
    <div 
      className="absolute cursor-grab active:cursor-grabbing touch-none z-20 transition-transform active:scale-110 w-24 h-24 rounded-2xl overflow-hidden" 
      style={{ 
        left: `${pos.x}%`, 
        top: `${pos.y}%`, 
        transform: 'translate(-50%, -50%)',
        filter: isDragging ? 'drop-shadow(0 20px 15px rgba(0,0,0,0.3))' : 'drop-shadow(0 10px 10px rgba(0,0,0,0.2))'
      }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setIsDragging(true);
        const startX = e.clientX;
        const startY = e.clientY;
        const startPosX = pos.x;
        const startPosY = pos.y;

        const handlePointerMove = (moveEv: PointerEvent) => {
          const parent = (e.target as HTMLElement).parentElement;
          if (!parent) return;
          const rect = parent.getBoundingClientRect();
          const dx = ((moveEv.clientX - startX) / rect.width) * 100;
          const dy = ((moveEv.clientY - startY) / rect.height) * 100;
          
          setPos({
            x: Math.min(Math.max(startPosX + dx, 5), 95),
            y: Math.min(Math.max(startPosY + dy, 5), 95)
          });
        };

        const handlePointerUp = () => {
          setIsDragging(false);
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
      }}
      onPointerUp={(e) => {
         onPositionChange(pos.x, pos.y);
      }}
    >
      {furnitureData && <FurnitureFigure style={furnitureData.style} />}
    </div>
  );
}

function CharadesGame({ copetData, char, updateCoPet, onBack }: any) {
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'result'>('loading');
  const [description, setDescription] = useState('');
  const [answer, setAnswer] = useState('');
  const [userInput, setUserInput] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [coinsEarned, setCoinsEarned] = useState(0);

  const startGame = async () => {
    setGameState('loading');
    try {
      const res = await generateAIResponse(`这是一个“你猜我画/猜词”游戏。
你是${char.name}，请你想一个日常物品（两个字），然后用你的口吻、性格，给出一段非常生动但**绝对不能包含该物品名称甚至其任何一个字**的描述（60字以内）。
请按此JSON格式返回：{"word": "苹果", "desc": "红艳艳的，咬一口脆甜多汁，雪公主最怕这个了！"}`);
      const data = JSON.parse(res.replace(/```json/g, '').replace(/```/g, ''));
      setAnswer(data.word);
      setDescription(data.desc);
      setGameState('playing');
    } catch {
      setAnswer('咖啡');
      setDescription('平时熬夜全靠这种苦苦的深色液体了。');
      setGameState('playing');
    }
  };

  const submitAnswer = () => {
    if (userInput.trim() === answer) {
      const earned = Math.floor(Math.random() * 20) + 20;
      updateCoPet({ ...copetData, coins: (copetData.coins || 0) + earned });
      setCoinsEarned(earned);
      setResultMsg(`太厉害了！你们真是心有灵犀！原来真的是【${answer}】！`);
    } else {
      setCoinsEarned(5);
      updateCoPet({ ...copetData, coins: (copetData.coins || 0) + 5 });
      setResultMsg(`哎呀猜错了，其实${char.name}想说的是【${answer}】呀！`);
    }
    setGameState('result');
  };

  // Auto start on mount
  useEffect(() => {
    startGame();
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center w-full">
      <h2 className="text-2xl font-black text-slate-800 text-center mb-2">心有灵犀猜词</h2>
      <p className="text-center text-slate-500 mb-6 text-sm">{char.name} 正在描述一个物品，请猜猜看！</p>
      
      {gameState === 'loading' ? (
        <div className="flex flex-col items-center justify-center space-y-4 h-64 w-full">
           <Brain size={48} className="text-purple-400 animate-pulse" />
           <p className="font-bold text-slate-500 animate-pulse">{char.name} 正在冥思苦想...</p>
        </div>
      ) : gameState === 'playing' ? (
        <div className="flex-1 w-full max-w-sm flex flex-col items-center">
           <div className="bg-purple-50 p-6 rounded-[2rem] border border-purple-200 shadow-sm mb-8 w-full relative">
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-purple-500 text-white font-bold px-4 py-1 rounded-full text-xs shadow-sm w-max">
               {char.name} 的描述
             </div>
             <p className="font-bold text-slate-700 text-base leading-relaxed mt-2 text-center">"{description}"</p>
           </div>
           
           <input 
             type="text"
             value={userInput}
             onChange={e => setUserInput(e.target.value)}
             placeholder="输入你的答案..."
             className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 text-center font-bold outline-none focus:border-purple-400 transition-colors mb-4"
           />
           <button 
             onClick={submitAnswer}
             className="w-full py-4 bg-purple-500 text-white rounded-2xl font-bold active:scale-95 transition-transform shadow-lg shadow-purple-500/30"
           >
             确定
           </button>
        </div>
      ) : (
        <div className="flex-1 w-full max-w-sm flex flex-col items-center animate-bounce-in">
           <div className="bg-purple-50 p-6 rounded-[2rem] border border-purple-200 shadow-sm mb-6 w-full text-center">
             <p className="font-bold text-slate-700 text-lg leading-relaxed">{resultMsg}</p>
           </div>
           
           <div className="text-amber-500 font-bold mb-8 text-lg bg-amber-50 px-6 py-2 rounded-full border border-amber-200 text-center">
             获得了 {coinsEarned} 金币！
           </div>
           
           <button onClick={startGame} className="w-full py-4 bg-purple-500 text-white rounded-2xl font-bold active:scale-95 transition-transform shadow-lg shadow-purple-500/30 mb-4">
             再来一局
           </button>
           <button onClick={onBack} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold active:scale-95 transition-transform">
             返回互动菜单
           </button>
        </div>
      )}
    </div>
  );
}

function ReflexGame({ copetData, updateCoPet, onBack }: any) {
  const TOTAL_ROUNDS = 6;
  const [target, setTarget] = useState(Math.floor(Math.random() * 9));
  const [hits, setHits] = useState(0);
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(2200);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [result, setResult] = useState<{ done: boolean; title: string; detail: string }>({ done: false, title: '', detail: '' });

  useEffect(() => {
    if (result.done) return;
    const roundDuration = Math.max(1100, 2400 - round * 140);
    const startedAt = Date.now();
    setTimeLeft(roundDuration);
    setTarget(Math.floor(Math.random() * 9));

    const timer = window.setInterval(() => {
      const remaining = roundDuration - (Date.now() - startedAt);
      if (remaining <= 0) {
        window.clearInterval(timer);
        finishRound(false, roundDuration);
      } else {
        setTimeLeft(remaining);
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [round, result.done]);

  const settleGame = (nextHits: number, nextCoins: number) => {
    updateCoPet({ ...copetData, coins: (copetData.coins || 0) + nextCoins });
    setResult({
      done: true,
      title: nextHits >= 5 ? '反应超快！' : nextHits >= 3 ? '还不错，再快一点' : '慢半拍啦',
      detail: `命中 ${nextHits}/${TOTAL_ROUNDS} 次，拿到 ${nextCoins} 金币。`
    });
  };

  const finishRound = (correct: boolean, reactionMs: number) => {
    const gain = correct ? Math.max(10, Math.floor((2400 - reactionMs) / 90) + round * 3) : 1;
    const nextHits = hits + (correct ? 1 : 0);
    const nextCoins = coinsEarned + gain;
    setHits(nextHits);
    setCoinsEarned(nextCoins);
    setLastGain(gain);

    if (round >= TOTAL_ROUNDS) {
      settleGame(nextHits, nextCoins);
      return;
    }

    setRound(prev => prev + 1);
  };

  const hit = (index: number) => {
    if (result.done) return;
    const roundDuration = Math.max(1100, 2400 - round * 140);
    const reactionMs = roundDuration - timeLeft;
    finishRound(index === target, reactionMs);
  };

  if (result.done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className="w-full max-w-sm rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <div className="text-2xl font-black text-amber-800 mb-2">{result.title}</div>
          <div className="text-sm text-amber-700 leading-6">{result.detail}</div>
          <div className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-amber-600 border border-amber-200">
            最后一轮 +{lastGain} 金币
          </div>
        </div>
        <button onClick={() => onBack()} className="mt-8 w-full max-w-sm py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">返回互动菜单</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center w-full">
      <h2 className="text-2xl font-black text-slate-800 text-center mb-2">拍拍爪反应赛</h2>
      <p className="text-center text-slate-500 mb-5 text-sm">每轮只有几秒，越快拍中发光爪印，金币越多。</p>
      <div className="w-full max-w-sm rounded-[2rem] border border-amber-100 bg-gradient-to-b from-white to-amber-50 p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-3">
          <span>第 {round}/{TOTAL_ROUNDS} 轮</span>
          <span>已拿 {coinsEarned} 金币</span>
        </div>
        <div className="h-2 rounded-full bg-white/80 overflow-hidden border border-amber-100">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400 transition-all" style={{ width: `${Math.max(6, (timeLeft / Math.max(1100, 2400 - round * 140)) * 100)}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        {Array.from({ length: 9 }).map((_, index) => {
          const isTarget = index === target;
          return (
            <button
              key={index}
              onClick={() => hit(index)}
              className={`aspect-square rounded-[1.75rem] border-2 transition-all flex items-center justify-center ${
                isTarget
                  ? 'bg-gradient-to-br from-amber-300 to-orange-400 border-amber-400 scale-[1.03] shadow-[0_14px_24px_rgba(251,191,36,0.35)]'
                  : 'bg-white border-slate-200'
              }`}
            >
              <PawPrint size={isTarget ? 30 : 24} className={isTarget ? 'text-white' : 'text-slate-300'} />
            </button>
          );
        })}
      </div>
      <div className="mt-5 text-sm font-bold text-slate-600">当前命中 {hits} 次</div>
      <button onClick={onBack} className="mt-8 w-full max-w-sm py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">返回互动菜单</button>
    </div>
  );
}

function RhythmGame({ copetData, updateCoPet, onBack }: any) {
  const buildSequence = () => Array.from({ length: 7 }, () => (Math.random() > 0.5 ? '左' : '右'));
  const [sequence, setSequence] = useState<string[]>(buildSequence());
  const [progress, setProgress] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(8500);
  const [result, setResult] = useState<{ done: boolean; success: boolean; coins: number; detail: string }>({ done: false, success: false, coins: 0, detail: '' });
  const progressRef = useRef(0);
  const comboRef = useRef(0);

  useEffect(() => {
    progressRef.current = progress;
    comboRef.current = combo;
  }, [combo, progress]);

  useEffect(() => {
    if (result.done) return;
    const startedAt = Date.now();
    const duration = 8500;
    const timer = window.setInterval(() => {
      const remaining = duration - (Date.now() - startedAt);
      if (remaining <= 0) {
        window.clearInterval(timer);
        finish(false, Math.max(4, comboRef.current * 2), `超时了，完成了 ${progressRef.current}/${sequence.length} 个拍点。`);
      } else {
        setTimeLeft(remaining);
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [result.done, sequence.length]);

  const finish = (success: boolean, coins: number, detail: string) => {
    updateCoPet({ ...copetData, coins: (copetData.coins || 0) + coins });
    setResult({ done: true, success, coins, detail });
  };

  const input = (value: string) => {
    if (result.done) return;
    const correct = sequence[progress] === value;
    if (!correct) {
      finish(false, Math.max(6, combo * 2), '节奏断掉了，这次没有跟上全部拍点。');
      return;
    }

    const next = progress + 1;
    const nextCombo = combo + 1;
    setProgress(next);
    setCombo(nextCombo);

    if (next >= sequence.length) {
      const coins = 18 + nextCombo * 3 + Math.floor(timeLeft / 260);
      finish(true, coins, `一口气踩完全部节拍，还剩 ${Math.ceil(timeLeft / 1000)} 秒。`);
    }
  };

  if (result.done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className={`w-full max-w-sm rounded-[2rem] border p-6 text-center shadow-sm ${result.success ? 'bg-sky-50 border-sky-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className={`text-2xl font-black mb-2 ${result.success ? 'text-sky-800' : 'text-rose-800'}`}>{result.success ? '节奏踩准了' : '节奏乱掉了'}</div>
          <div className={`text-sm leading-6 ${result.success ? 'text-sky-700' : 'text-rose-700'}`}>{result.detail}</div>
          <div className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold border border-white/80 text-slate-700">
            本局 +{result.coins} 金币
          </div>
        </div>
        <button onClick={onBack} className="mt-8 w-full max-w-sm py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">返回互动菜单</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center w-full">
      <h2 className="text-2xl font-black text-slate-800 text-center mb-2">节奏踩点</h2>
      <p className="text-center text-slate-500 mb-5 text-sm">按顺序踩左右拍点，越快连完，金币越多。</p>
      <div className="w-full max-w-sm rounded-[2rem] bg-gradient-to-b from-sky-50 to-white border border-sky-100 p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-3">
          <span>连击 {combo}</span>
          <span>{Math.ceil(timeLeft / 1000)} 秒</span>
        </div>
        <div className="h-2 rounded-full bg-white overflow-hidden border border-sky-100 mb-4">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 transition-all" style={{ width: `${Math.max(5, (timeLeft / 8500) * 100)}%` }} />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {sequence.map((step, index) => (
            <div
              key={`${step}_${index}`}
              className={`flex-1 rounded-2xl py-3 text-center font-black text-lg transition-all ${
                index < progress
                  ? 'bg-emerald-100 text-emerald-600'
                  : index === progress
                    ? 'bg-slate-900 text-white scale-[1.03]'
                    : 'bg-white text-slate-300 border border-slate-100'
              }`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        <button onClick={() => input('左')} className="py-6 rounded-[1.75rem] bg-sky-100 text-sky-700 font-black text-lg shadow-sm active:scale-95 transition-transform">左拍</button>
        <button onClick={() => input('右')} className="py-6 rounded-[1.75rem] bg-rose-100 text-rose-700 font-black text-lg shadow-sm active:scale-95 transition-transform">右拍</button>
      </div>
      <button onClick={onBack} className="mt-8 w-full max-w-sm py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">返回互动菜单</button>
    </div>
  );
}

function TrainingGame({ copetData, updateCoPet, onBack }: any) {
  const ACTIONS = [
    { id: 'sit', label: '坐下', color: 'bg-emerald-100 text-emerald-700' },
    { id: 'turn', label: '转圈', color: 'bg-violet-100 text-violet-700' },
    { id: 'paw', label: '握手', color: 'bg-amber-100 text-amber-700' },
    { id: 'jump', label: '跳一下', color: 'bg-rose-100 text-rose-700' },
  ];
  const [round, setRound] = useState(1);
  const [sequence, setSequence] = useState<typeof ACTIONS>([]);
  const [phase, setPhase] = useState<'watch' | 'repeat' | 'result'>('watch');
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(7000);
  const [result, setResult] = useState<{ success: boolean; coins: number; detail: string } | null>(null);

  useEffect(() => {
    if (phase === 'result') return;
    const nextSequence = Array.from({ length: round + 2 }, () => ACTIONS[Math.floor(Math.random() * ACTIONS.length)]);
    setSequence(nextSequence);
    setProgress(0);
    setPhase('watch');
    const watchTimer = window.setTimeout(() => setPhase('repeat'), 1800 + nextSequence.length * 350);
    return () => window.clearTimeout(watchTimer);
  }, [round]);

  useEffect(() => {
    if (phase !== 'repeat') return;
    const duration = 7200;
    const startedAt = Date.now();
    setTimeLeft(duration);
    const timer = window.setInterval(() => {
      const remaining = duration - (Date.now() - startedAt);
      if (remaining <= 0) {
        window.clearInterval(timer);
        finish(false, Math.max(8, round * 4), '超时了，动作模仿还差一点。');
      } else {
        setTimeLeft(remaining);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [phase, round]);

  const finish = (success: boolean, coins: number, detail: string) => {
    updateCoPet({
      ...copetData,
      coins: (copetData.coins || 0) + coins,
      stats: {
        ...copetData.stats,
        intelligence: copetData.stats.intelligence + (success ? 3 : 1),
        affection: copetData.stats.affection + 1
      }
    });
    setPhase('result');
    setResult({ success, coins, detail });
  };

  const chooseAction = (actionId: string) => {
    if (phase !== 'repeat') return;
    const current = sequence[progress];
    if (!current || current.id !== actionId) {
      finish(false, Math.max(8, round * 4), '顺序记错了，这轮模仿失败。');
      return;
    }

    const next = progress + 1;
    setProgress(next);

    if (next >= sequence.length) {
      if (round >= 3) {
        finish(true, 18 + round * 6 + Math.floor(timeLeft / 350), '你把动作顺序完整记住了，宠物也更信任你了。');
      } else {
        setRound(prev => prev + 1);
      }
    }
  };

  if (phase === 'result' && result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className={`w-full max-w-sm rounded-[2rem] border p-6 text-center shadow-sm ${result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className={`text-2xl font-black mb-2 ${result.success ? 'text-emerald-800' : 'text-rose-800'}`}>{result.success ? '训练完成' : '训练中断'}</div>
          <div className={`text-sm leading-6 ${result.success ? 'text-emerald-700' : 'text-rose-700'}`}>{result.detail}</div>
          <div className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold border border-white/80 text-slate-700">
            本局 +{result.coins} 金币
          </div>
        </div>
        <button onClick={onBack} className="mt-8 w-full max-w-sm py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">返回互动菜单</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center w-full">
      <h2 className="text-2xl font-black text-slate-800 text-center mb-2">动作模仿训练</h2>
      <p className="text-center text-slate-500 mb-5 text-sm">先记住动作顺序，再在限时里复现出来。</p>
      <div className="w-full max-w-sm rounded-[2rem] bg-white border border-slate-200 p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-3">
          <span>第 {round}/3 轮</span>
          <span>{phase === 'repeat' ? `${Math.ceil(timeLeft / 1000)} 秒` : '记忆中'}</span>
        </div>
        {phase === 'repeat' && (
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-4">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all" style={{ width: `${Math.max(5, (timeLeft / 7200) * 100)}%` }} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {sequence.map((action, index) => (
            <div
              key={`${action.id}_${index}`}
              className={`rounded-2xl px-3 py-4 text-center font-bold transition-all ${
                phase === 'watch'
                  ? action.color
                  : index < progress
                    ? 'bg-emerald-100 text-emerald-700'
                    : index === progress
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-300'
              }`}
            >
              {phase === 'watch' ? `${index + 1}. ${action.label}` : index < progress ? '完成' : index === progress ? '当前动作' : '待输入'}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            disabled={phase !== 'repeat'}
            onClick={() => chooseAction(action.id)}
            className={`py-5 rounded-[1.75rem] font-black text-base shadow-sm transition-transform ${action.color} disabled:opacity-45 disabled:scale-100 active:scale-95`}
          >
            {action.label}
          </button>
        ))}
      </div>
      <button onClick={onBack} className="mt-8 w-full max-w-sm py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">返回互动菜单</button>
    </div>
  );
}

export default function CoPetApp() {
  const { characters, copetData, updateCoPet, closeApp } = useAppStore();
  
  const [setupStep, setSetupStep] = useState<number>(1);
  const [tempCompanionId, setTempCompanionId] = useState<string>('');
  const [tempPetType, setTempPetType] = useState<string>('');
  const [tempPetName, setTempPetName] = useState<string>('');
  
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Game & Store states
  const [gameMode, setGameMode] = useState<'' | 'menu' | 'coop_adventure' | 'charades' | 'reflex' | 'rhythm' | 'training'>('');
  const [showStore, setShowStore] = useState(false);
  const [adventureState, setAdventureState] = useState<{
     scene: string;
     options: string[];
     result?: string;
     coins?: number;
  } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panState, setPanState] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showThoughtBubble, setShowThoughtBubble] = useState(false);
  const [thoughtText, setThoughtText] = useState('');

  const startCoopAdventure = async () => {
    if (!copetData) return;
    setGameMode('coop_adventure');
    setAdventureState(null);
    setIsAiThinking(true);
    const char = characters[copetData.companionId];
    try {
      const res = await generateAIResponse(`为我和${char?.name}以及宠物${copetData.name}设计一个合作冒险的简短场景开头，以及2个不同的行动选项应对场景危机。按JSON格式返回：{"scene": "场景描述...", "options": ["选项1", "选项2"]}`);
      const data = JSON.parse(res.replace(/```json/g, '').replace(/```/g, ''));
      setAdventureState(data);
      saveInteractionMemory(copetData.companionId, `和${char?.name}以及宠物${copetData.name}一起进行合作冒险`);
      useAppStore.getState().addEmotionEvent({ characterId: copetData.companionId, paDelta: 0.2, naDelta: -0.05, word: '兴奋', valence: 0.5, arousal: 0.6, matchSource: 'free_form', source: 'manual' });
    } catch {
      // AI生成fallback场景
      try {
        const fallbackScene = await generateAIResponse(`设计一个和宠物${copetData.name}以及${char?.name}的简短合作冒险开局，返回JSON：{"scene": "场景描述", "options": ["选项1", "选项2"]}`);
        const fallbackData = JSON.parse(fallbackScene.replace(/```json/g, '').replace(/```/g, ''));
        setAdventureState({ scene: fallbackData.scene, options: fallbackData.options });
      } catch {
        setAdventureState({
          scene: `你们带着${copetData.name}散步时，突然发现草丛里有一个发光的神秘宝箱，上面有一个奇特的锁，似乎需要两个人同时破译。`,
          options: ['试图强行破坏锁', '仔细研究锁上的古老暗号']
        });
      }
    } finally {
      setIsAiThinking(false);
    }
  };

  const submitAdventureChoice = async (choiceText: string) => {
    if (!copetData) return;
    setIsAiThinking(true);
    const char = characters[copetData.companionId];
    try {
      const res = await generateAIResponse(`在刚才的冒险中，我选择了“${choiceText}”。请以${char?.name}的语气和视角，描述ta如何配合我的行动，并简短描述最终的结果（字数控制在60字内）。一定要是合作的结局。`);
      const earned = Math.floor(Math.random() * 50) + 30; // 30-80 coins
      updateCoPet({ ...copetData, coins: (copetData.coins || 0) + earned });
      setAdventureState(prev => prev ? { ...prev, result: res, coins: earned } : null);
      saveInteractionMemory(copetData.companionId, `和${char?.name}以及宠物${copetData.name}在冒险中选择了行动`, choiceText);
      useAppStore.getState().addEmotionEvent({ characterId: copetData.companionId, paDelta: 0.15, naDelta: -0.03, word: '好奇', valence: 0.4, arousal: 0.5, matchSource: 'free_form', source: 'manual' });
    } catch {
      const earned = 50;
      updateCoPet({ ...copetData, coins: (copetData.coins || 0) + earned });
      try {
        const fallbackRes = await generateAIResponse(`用${char?.name}的口吻（50字内）描述ta如何配合你刚才的选择，最终合作成功。`);
        setAdventureState(prev => prev ? { ...prev, result: fallbackRes.replace(/[#*]/g, '').trim(), coins: earned } : null);
      } catch {
        setAdventureState(prev => prev ? { ...prev, result: `${char?.name}配合你的行动，你们成功化解了危机，宠物开心地跳了起来。发现了一些遗留的硬币！`, coins: earned } : null);
      }
    } finally {
      setIsAiThinking(false);
    }
  };

  // Set up states correctly for the stats limits
  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2000);
  };

  const handleCreatePet = () => {
    if (!tempCompanionId || !tempPetType || !tempPetName.trim()) return;
    
    updateCoPet({
      companionId: tempCompanionId,
      petType: tempPetType as any,
      name: tempPetName,
      stage: 'egg',
      stats: {
        affection: 10,
        intelligence: 10,
        strength: 10,
        satiety: 80,
        mood: 80,
        energy: 100
      },
      inventory: [],
      coins: 100,
      furniture: [],
      level: 1,
      exp: 0,
      history: [{ date: Date.now(), event: `终于等到这一天！我们一起把属于我们的${tempPetName}接回家啦。` }]
    });
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    updateCoPet(null);
    setSetupStep(1);
    setTempCompanionId('');
    setTempPetType('');
    setTempPetName('');
    setShowResetConfirm(false);
  };
  
  const performAction = async (actionType: 'feed' | 'play' | 'study' | 'explore' | 'sleep') => {
    if (!copetData) return;
    const char = characters[copetData.companionId];
    if (!char) return;

    // Check limits
    if (actionType !== 'sleep' && copetData.stats.energy < 20) {
      showToast(`${copetData.name} 太累了，先让它休息一下吧！`);
      return;
    }

    setIsAiThinking(true);
    let prompt = `我和你一起养了一只名为“${copetData.name}”的宠物。
你是DC角色：${char.name}。你的性格是：${char.personality}。
前提规则：
1. 你的回答必须完全以【${char.name}】的口吻和性格直接描述你自己的反应、说的话或内心的想法。
2. 呈现出你独特的风格。不要出戏！
3. 用一句简短的话描述当时的场景以及你的直接反应（50字以内）。重点突出你的反应，不要过多提及我。`;
    
    let expGain = 0;
    let statChanges = { affection: 0, intelligence: 0, strength: 0, satiety: 0, mood: 0, energy: 0 };
    let foundItem = '';
    
    if (actionType === 'feed') {
       prompt += `\n情境：刚刚我们给它喂了食物。`;
       expGain = 15;
       statChanges.satiety = 30;
       statChanges.energy = 10;
       statChanges.strength = 1;
       statChanges.affection = 1;
    } else if (actionType === 'play') {
       prompt += `\n情境：刚刚我们陪它玩耍了一会，它看起来很开心。`;
       expGain = 25;
       statChanges.mood = 40;
       statChanges.energy = -20;
       statChanges.satiety = -10;
       statChanges.affection = 3;
    } else if (actionType === 'study') {
       prompt += `\n情境：刚刚我们在对它进行体能/智力上的训练。`;
       expGain = 35;
       statChanges.intelligence = 3;
       statChanges.strength = 2;
       statChanges.energy = -30;
       statChanges.satiety = -20;
       statChanges.mood = -10;
    } else if (actionType === 'explore') {
       const items = ['蝙蝠镖', '闪亮的小石头', '破旧的披风残片', '神秘的发光球体', '猫草', '小丑纸牌'];
       foundItem = items[Math.floor(Math.random() * items.length)];
       prompt += `\n情境：我们带它去外面（比如哥谭）探险了一圈。它还捡回来了一个“${foundItem}”。请在你的反应中顺便吐槽或评价一下这个物品。`;
       expGain = 50;
       statChanges.intelligence = 2;
       statChanges.strength = 3;
       statChanges.energy = -40;
       statChanges.satiety = -30;
       statChanges.mood = 20;
    } else if (actionType === 'sleep') {
       prompt += `\n情境：它玩累了，现在正在我们旁边呼呼大睡。`;
       expGain = 8;
       statChanges.energy = 80;
       statChanges.satiety = -20;
       statChanges.mood = 10;
    }

    let finalRes = '';
    
    try {
      finalRes = await generateAIResponse(prompt);
      saveInteractionMemory(copetData.companionId, `和宠物${copetData.name}一起${actionType === 'feed' ? '喂食' : actionType === 'play' ? '玩耍' : actionType === 'study' ? '训练' : actionType === 'explore' ? '探险' : '休息'}`);
      useAppStore.getState().addEmotionEvent({ characterId: copetData.companionId, paDelta: 0.12, naDelta: -0.02, word: '温暖', valence: 0.4, arousal: 0.3, matchSource: 'free_form', source: 'manual' });
    } catch(e) {
      try {
        finalRes = await generateAIResponse(`用${char?.name}的口吻（20字内）描述ta对宠物${copetData.name}此刻状态的简短反应。`);
        finalRes = finalRes.replace(/[#*]/g, '').trim();
      } catch {
        finalRes = `（${char.name} 微笑着看了一眼，没有多说什么。）`;
      }
    }

    const newExp = copetData.exp + expGain;
    let newLevel = copetData.level;
    let newStage = copetData.stage;
    
    if (newExp >= 100) {
       newLevel += 1;
       if (newLevel >= 3 && newStage === 'egg') newStage = 'baby';
       if (newLevel >= 8 && newStage === 'baby') newStage = 'child';
       if (newLevel >= 15 && newStage === 'child') newStage = 'adult';
    }
    
    const newInventory = foundItem && !copetData.inventory.includes(foundItem) 
        ? [...copetData.inventory, foundItem]
        : copetData.inventory;

    updateCoPet({
      ...copetData,
      level: newLevel,
      exp: newExp >= 100 ? newExp - 100 : newExp,
      stage: newStage,
      inventory: newInventory,
      stats: {
        affection: typeof copetData.stats.affection === 'number' ? copetData.stats.affection + statChanges.affection : 10 + statChanges.affection,
        intelligence: typeof copetData.stats.intelligence === 'number' ? copetData.stats.intelligence + statChanges.intelligence : 10 + statChanges.intelligence,
        strength: typeof copetData.stats.strength === 'number' ? copetData.stats.strength + statChanges.strength : 10 + statChanges.strength,
        satiety: clamp((typeof copetData.stats.satiety === 'number' ? copetData.stats.satiety : 80) + statChanges.satiety, 0, 100),
        mood: clamp((typeof copetData.stats.mood === 'number' ? copetData.stats.mood : 80) + statChanges.mood, 0, 100),
        energy: clamp((typeof copetData.stats.energy === 'number' ? copetData.stats.energy : 100) + statChanges.energy, 0, 100),
      },
      history: [{ date: Date.now(), event: finalRes }, ...copetData.history]
    });
    
    setIsAiThinking(false);
  };

  if (!copetData) {
    return (
      <div className="h-full w-full bg-orange-50 flex flex-col pb-safe">
        <div className="pt-14 px-6 pb-4 flex items-center shrink-0">
          <button onClick={closeApp} className="w-10 h-10 flex text-slate-800 -ml-2 items-center"><ChevronLeft size={28} /></button>
          <div className="flex-1 text-center font-bold text-lg text-slate-900 pr-8">领养宠物</div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 pb-20 min-h-0">
          {setupStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold text-slate-800">1. 选择一位陪伴者</h2>
              <div className="space-y-3">
                {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(char => (
                  <div 
                    key={char.id}
                    onClick={() => { setTempCompanionId(char.id); setSetupStep(2); }}
                    className="p-4 bg-white rounded-2xl flex items-center gap-4 border-2 border-transparent active:border-orange-200 transition-colors cursor-pointer shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ background: char.avatar.startsWith('#') ? char.avatar : char.background }}>
                       {!char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="font-bold text-slate-800 flex-1">{char.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {setupStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <button className="text-sm font-bold text-orange-500 mb-2 flex items-center gap-1" onClick={() => setSetupStep(1)}>
                <ChevronLeft size={16}/> 重新选择陪伴者
              </button>
              <h2 className="text-xl font-bold text-slate-800">2. 想领养什么宠物？</h2>
              <div className="grid grid-cols-2 gap-4">
                 {PET_TYPES.map(type => (
                   <div 
                     key={type.id}
                     onClick={() => { setTempPetType(type.id); setSetupStep(3); }}
                     className="bg-white p-6 rounded-3xl flex flex-col items-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer border border-slate-100"
                   >
                     <div className="scale-[0.7]"><PetFigure petType={type.id} stage="baby" /></div>
                     <div className="font-bold text-slate-700">{type.name}</div>
                   </div>
                 ))}
              </div>
            </div>
          )}

          {setupStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <button className="text-sm font-bold text-orange-500 mb-2 flex items-center gap-1" onClick={() => setSetupStep(2)}>
                <ChevronLeft size={16}/> 重新选择宠物
              </button>
              <h2 className="text-xl font-bold text-slate-800">3. 给它起个名字</h2>
              
              <div className="flex justify-center my-8">
                 {tempPetType && <PetFigure petType={tempPetType} stage="baby" />}
              </div>

              <input
                type="text"
                placeholder="在此输入名字..."
                value={tempPetName}
                onChange={e => setTempPetName(e.target.value)}
                className="w-full bg-white px-5 py-4 rounded-2xl font-bold text-lg outline-none text-center shadow-sm"
              />

              <button 
                onClick={handleCreatePet}
                disabled={!tempPetName.trim()}
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg disabled:opacity-50 mt-4 shadow-xl shadow-orange-500/30 active:scale-95 transition-transform"
              >
                确认领养
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const char = characters[copetData.companionId];
  if (!char) return null; // safety check

  const getStageName = (stage: string) => {
    switch(stage) {
      case 'egg': return '蛋';
      case 'baby': return '幼年期';
      case 'child': return '成长期';
      case 'adult': return '成熟期';
      default: return stage;
    }
  };

const handlePetClick = async () => {
    if (isAiThinking || copetData.stage === 'egg') return;
    setIsAiThinking(true);
    setThoughtText('...');
    setShowThoughtBubble(true);
    try {
      const char = characters[copetData.companionId];
      const baseThought = PET_THOUGHTS[copetData.petType as keyof typeof PET_THOUGHTS] || PET_THOUGHTS.dog;
      const res = await generateAIResponse(`你是DC角色${char?.name}，我们养的宠物刚被我点了一下。请结合宠物类型“${copetData.petType}”和当前状态（心情${copetData.stats.mood}，体力${copetData.stats.energy}），输出一句10字以内的宠物内心想法，不要用emoji，不要加引号。可参考语气：${baseThought.join('、')}`);
      setThoughtText(res.replace(/[#*]/g, '').trim());
      setTimeout(() => setShowThoughtBubble(false), 3000);
      saveInteractionMemory(copetData.companionId, `和宠物${copetData.name}互动`, res);
      useAppStore.getState().addEmotionEvent({ characterId: copetData.companionId, paDelta: 0.1, naDelta: -0.02, word: '喜爱', valence: 0.35, arousal: 0.3, matchSource: 'free_form', source: 'manual' });
    } catch {
      // AI生成fallback
      try {
        const fallbackRes = await generateAIResponse(`请用一句话（10字以内）模拟宠物${copetData.petType}被摸头时的内心反应，不要加引号和emoji。`);
        setThoughtText(fallbackRes.replace(/[#*""]/g, '').trim());
      } catch {
        setThoughtText('蹭了蹭你的手心。');
      }
      setTimeout(() => setShowThoughtBubble(false), 3000);
    } finally {
      setIsAiThinking(false);
    }
  };

  const petData = PET_TYPES.find(p => p.id === copetData.petType);
  const petIcon = petData ? <PetFigure petType={petData.id} stage={copetData.stage} /> : <PetFigure petType="dog" stage={copetData.stage} />;

  // Safe defaults for older state formats
  const satiety = typeof copetData.stats.satiety === 'number' ? copetData.stats.satiety : 80;
  const mood = typeof copetData.stats.mood === 'number' ? copetData.stats.mood : 80;
  const energy = typeof copetData.stats.energy === 'number' ? copetData.stats.energy : 100;

  const INS_BG = 'bg-[#f8f8fa] dark:bg-[#0f0f12]';
  const INS_CARD = 'bg-white/50 dark:bg-white/8 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl';
  const INS_TEXT = 'text-slate-800 dark:text-slate-200';
  const INS_MUTED = 'text-slate-400 dark:text-slate-500';

  return (
    <div className={`h-full w-full flex flex-col ${INS_BG} pb-safe ${isFullscreen ? 'absolute inset-0 z-[100] bg-[#c3e3f0]' : 'relative'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full text-sm font-bold shadow-xl z-[110] animate-fade-in whitespace-nowrap">
          {toastMessage}
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="absolute inset-0 bg-black/60 z-[110] flex items-center justify-center p-6 animate-fade-in">
           <div className="bg-white rounded-3xl p-6 w-full max-w-[320px] shadow-2xl">
              <h3 className="text-xl font-bold text-slate-800 mb-2">确定要放生吗？</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                放弃当前的共养关系后，宠物将被放生，你们过去的所有回忆都无法找回。
              </p>
              <div className="flex gap-3">
                 <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 active:scale-95 transition-transform">
                   我再想想
                 </button>
                 <button onClick={confirmReset} className="flex-1 py-3 rounded-xl font-bold bg-rose-500 text-white active:scale-95 transition-transform shadow-lg shadow-rose-500/30">
                   狠心放生
                 </button>
              </div>
           </div>
        </div>
      )}

      {!isFullscreen && (
      <>
      <div className="pt-14 px-5 pb-2 flex items-center justify-between shrink-0 z-10">
          <button onClick={closeApp} className="w-10 h-10 flex text-slate-500 dark:text-slate-400 -ml-2 items-center"><ChevronLeft size={28} /></button>
          <div className={`${INS_CARD} flex items-center gap-2 px-3 py-1.5`}>
             <div className="w-7 h-7 rounded-full overflow-hidden" style={{ background: char.avatar.startsWith('#') ? char.avatar : '#fff' }}>
               {!char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full object-cover" alt="" />}
             </div>
             <span className={`font-semibold ${INS_TEXT} text-sm`}>与 {char.name} 共养</span>
          </div>
          <button onClick={handleReset} className="px-3 py-1.5 text-rose-400 rounded-full bg-rose-50/50 dark:bg-rose-950/30 active:scale-95 transition-transform text-xs font-medium" title="放生">
             放生
          </button>
      </div>

      <div className="flex items-center justify-center gap-4 pb-2 z-10 px-5">
          <div className={`flex items-center gap-1.5 ${INS_MUTED} text-xs font-medium`}>
             <CircleDollarSign size={14} className="text-amber-400" /> {(copetData.coins || 0)} 金币
          </div>
      </div>
      </>
      )}

      <div className={`flex-1 flex flex-col ${isFullscreen ? '' : 'px-6 pb-6 overflow-y-auto min-h-0'}`}>
        <div 
          className={`w-full bg-[#c3e3f0] relative overflow-hidden shadow-inner shrink-0 mt-2 isolate ${isFullscreen ? 'h-full border-none rounded-none' : 'aspect-[4/3] rounded-3xl mb-6 border-4 border-white'}`}
          onPointerDown={(e) => {
             // Let draggable furniture ignore this pan logic by intercepting in furniture component
             setIsPanning(true);
             const startX = e.clientX - panState.x;
             const startY = e.clientY - panState.y;
             const moveFn = (moveEv: PointerEvent) => {
               setPanState({ x: moveEv.clientX - startX, y: moveEv.clientY - startY });
             };
             const upFn = () => { setIsPanning(false); window.removeEventListener('pointermove', moveFn); window.removeEventListener('pointerup', upFn); };
             window.addEventListener('pointermove', moveFn);
             window.addEventListener('pointerup', upFn);
          }}
        >
           <button onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-4 right-4 z-50 bg-white/70 p-2 rounded-full text-slate-800 drop-shadow-sm font-bold flex items-center justify-center">
             {isFullscreen ? <ChevronLeft size={20} /> : <Compass size={20} />}
           </button>
           <div className="absolute top-4 left-4 z-40 bg-white/70 rounded-full flex divide-x overflow-hidden shadow-sm">
             <button className="px-3 py-1 font-bold text-slate-600 hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.5, z - 0.2)); }}>-</button>
             <button className="px-3 py-1 font-bold text-slate-600 hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(3, z + 0.2)); }}>+</button>
           </div>
           
           <div className="w-full h-full absolute left-0 top-0 transition-transform select-none touch-none" style={{ transform: `scale(${zoom}) translate(${panState.x / zoom}px, ${panState.y / zoom}px)`, transformOrigin: 'center center' }}>
             {/* 3D Walls (Left, Right, Base) */}
             <div className="absolute inset-x-0 bottom-0 h-[65%] bg-[#ecd4ad] border-t border-amber-800/10" style={{ transform: 'perspective(1000px) rotateX(45deg)', transformOrigin: 'top' }}>
                <div className="w-full h-full opacity-10" style={{ backgroundImage: 'linear-gradient(90deg, transparent 49px, rgba(0,0,0,0.5) 50px), linear-gradient(0deg, transparent 49px, rgba(0,0,0,0.5) 50px)', backgroundSize: '50px 50px' }}></div>
             </div>
             
             {copetData.furniture?.map((item, i) => (
                <DraggableFurniture key={i} item={item} onPositionChange={(x, y) => {
                   const newFurn = [...copetData.furniture];
                   newFurn[i] = { ...newFurn[i], x, y };
                   updateCoPet({ ...copetData, furniture: newFurn });
                }} />
             ))}

             <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_15px_15px_rgba(0,0,0,0.3)] hover:-translate-y-2 transition-transform cursor-pointer group" onClick={(e) => { e.stopPropagation(); handlePetClick(); }}>
                {copetData.stage === 'egg' ? (
                   <div className="w-20 h-24 rounded-[45%] bg-gradient-to-b from-white to-amber-100 border border-amber-200 shadow-xl" />
                ) : (
                   <div className="scale-100 transform origin-bottom">
                      {petIcon}
                   </div>
                )}
                {showThoughtBubble && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-white px-4 py-2 rounded-2xl shadow-lg border border-gray-100 text-sm font-bold text-slate-700 whitespace-nowrap animate-fade-in z-50">
                     {thoughtText}
                     <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[8px] border-t-white border-x-transparent border-b-transparent"></div>
                  </div>
                )}
             </div>
           </div>
        </div>

        {!isFullscreen && (
        <>
          <div className={`${INS_CARD} p-5 flex flex-col items-center mb-5`}>
           <h1 className={`text-2xl font-bold ${INS_TEXT} mb-1`}>{copetData.name}</h1>
           <div className={`text-xs ${INS_MUTED} mb-4`}>
             Lv.{copetData.level} · {getStageName(copetData.stage)}
           </div>

           {/* Vital Stats (Progress bars) - more compact */}
           <div className="w-full space-y-2.5 mb-4">
              <div className="flex items-center gap-2.5">
                 <Pizza size={14} className="text-orange-400 shrink-0"/>
                 <div className="flex-1 h-1.5 bg-slate-200/50 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400/70 transition-all rounded-full" style={{width: `${satiety}%`}}></div>
                 </div>
              </div>
              <div className="flex items-center gap-2.5">
                 <Smile size={14} className="text-rose-400 shrink-0"/>
                 <div className="flex-1 h-1.5 bg-slate-200/50 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400/70 transition-all rounded-full" style={{width: `${mood}%`}}></div>
                 </div>
              </div>
              <div className="flex items-center gap-2.5">
                 <Zap size={14} className="text-blue-400 shrink-0"/>
                 <div className="flex-1 h-1.5 bg-slate-200/50 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400/70 transition-all rounded-full" style={{width: `${energy}%`}}></div>
                 </div>
              </div>
           </div>

           {/* Core Stats - cleaner grid */}
           <div className="w-full grid grid-cols-3 gap-2 mb-3">
              <div className="flex flex-col items-center bg-rose-50/40 dark:bg-white/5 py-2 rounded-xl">
                 <Heart size={14} className="text-rose-400 mb-0.5" />
                 <span className={`font-semibold ${INS_TEXT} text-sm`}>{copetData.stats.affection}</span>
              </div>
              <div className="flex flex-col items-center bg-blue-50/40 dark:bg-white/5 py-2 rounded-xl">
                 <Brain size={14} className="text-blue-400 mb-0.5" />
                 <span className={`font-semibold ${INS_TEXT} text-sm`}>{copetData.stats.intelligence}</span>
              </div>
              <div className="flex flex-col items-center bg-orange-50/40 dark:bg-white/5 py-2 rounded-xl">
                 <Dumbbell size={14} className="text-orange-400 mb-0.5" />
                 <span className={`font-semibold ${INS_TEXT} text-sm`}>{copetData.stats.strength}</span>
              </div>
           </div>

           {/* EXP Bar */}
           <div className="w-full">
             <div className="flex justify-between text-[10px] ${INS_MUTED} mb-1">
               <span>经验值</span>
               <span>{copetData.exp}/100</span>
             </div>
             <div className="h-1 w-full bg-slate-200/50 dark:bg-white/10 rounded-full overflow-hidden">
               <div className="h-full bg-amber-400/70 transition-all duration-500 rounded-full" style={{ width: `${copetData.exp}%` }}></div>
             </div>
           </div>
        </div>

        {/* Actions Grid - glass style */}
        <div className="grid grid-cols-4 gap-2.5 mb-4 shrink-0">
           <button onClick={() => performAction('feed')} disabled={isAiThinking} className={`${INS_CARD} py-3.5 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40`}>
              <Pizza size={20} className="text-orange-400" />
              <span className={`text-[10px] font-medium ${INS_MUTED}`}>喂食</span>
           </button>
           <button onClick={() => performAction('play')} disabled={isAiThinking} className={`${INS_CARD} py-3.5 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40`}>
              <Hand size={20} className="text-rose-400" />
              <span className={`text-[10px] font-medium ${INS_MUTED}`}>互动</span>
           </button>
           <button onClick={() => performAction('study')} disabled={isAiThinking} className={`${INS_CARD} py-3.5 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40`}>
              <BookOpen size={20} className="text-blue-400" />
              <span className={`text-[10px] font-medium ${INS_MUTED}`}>训练</span>
           </button>
           <button onClick={() => performAction('sleep')} disabled={isAiThinking} className={`${INS_CARD} py-3.5 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40`}>
              <Battery size={20} className="text-indigo-400" />
              <span className={`text-[10px] font-medium ${INS_MUTED}`}>休息</span>
           </button>
           <button onClick={() => performAction('explore')} disabled={isAiThinking} className={`${INS_CARD} col-span-2 py-3.5 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40`}>
              <Compass size={20} className="text-emerald-400" />
              <span className={`text-[10px] font-medium ${INS_MUTED}`}>外出探险</span>
           </button>
           <button onClick={() => setGameMode('menu')} className="bg-slate-800/80 dark:bg-white/80 text-white dark:text-slate-800 py-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-sm">
              <Gamepad2 size={20} />
              <span className="text-[10px] font-medium">做任务</span>
           </button>
           <button onClick={() => setShowStore(true)} className="bg-slate-800/80 dark:bg-white/80 text-white dark:text-slate-800 py-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-sm">
              <Store size={20} />
              <span className="text-[10px] font-medium">去商城</span>
           </button>
        </div>

        {/* Inventory / History - glass card */}
        <div className={`${INS_CARD} p-5 flex flex-col shrink-0 mb-4`}>

           {copetData.inventory && copetData.inventory.length > 0 && (
             <div className="mb-4 pb-4 border-b border-slate-200/50 dark:border-white/10 shrink-0">
               <div className={`text-[10px] ${INS_MUTED} font-semibold uppercase pl-1 mb-2 tracking-wider`}>百宝袋</div>
               <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                 {copetData.inventory.map((item, i) => (
                    <div key={i} className="bg-white/40 dark:bg-white/5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap border border-slate-200/30 dark:border-white/10 flex items-center gap-1.5">
                      <Briefcase size={12} className="text-slate-400"/>
                      {item}
                    </div>
                 ))}
               </div>
             </div>
           )}

           <div className={`text-[10px] ${INS_MUTED} font-semibold uppercase pl-1 mb-3 shrink-0 tracking-wider`}>成长日记</div>
           <div className="flex flex-col space-y-3 pr-1">
              {isAiThinking && (
                 <div className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 shrink-0"></div>
                 </div>
              )}
              {copetData.history.map((item, idx) => (
                 <div key={idx} className="flex gap-3 items-start animate-fade-in">
                   <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-200/50 dark:border-white/10" style={{ background: char && char.avatar.startsWith('#') ? char.avatar : '#f1f5f9' }}>
                     {char && !char.avatar.startsWith('#') ? <img src={char.avatar} className="w-full h-full object-cover" alt="" /> : (char && char.avatar.startsWith('#') ? null : <User size={16} className="m-2 text-slate-400" />)}
                   </div>
                   <div className="flex-1 pt-1">
                      <div className={`text-sm ${INS_TEXT} leading-relaxed ${INS_CARD} p-2.5 rounded-xl rounded-tl-none inline-block`}>
                         {item.event}
                      </div>
                      <div className={`text-[10px] ${INS_MUTED} mt-1 pl-1`}>
                         {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                   </div>
                 </div>
              ))}
            </div>
         </div>
        </>
      )}
      </div>

      {/* Game Screen Overlay */}
      {gameMode && (
        <div className="absolute inset-0 z-[60] bg-white flex flex-col p-6 animate-fade-in overflow-y-auto">
          <button onClick={() => {
             if (gameMode === 'menu') setGameMode('');
             else { setGameMode('menu'); }
          }} className="text-slate-500 mb-6 flex items-center">
            <ChevronLeft size={24}/> 返回
          </button>
          
          {gameMode === 'menu' && (
             <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full">
                <h2 className="text-2xl font-black text-slate-800 text-center mb-8">互动任务</h2>
                <button onClick={startCoopAdventure} className="w-full max-w-[280px] bg-emerald-50 p-6 rounded-[2rem] border-2 border-emerald-100 flex flex-col items-center gap-3 active:scale-95 transition-transform shadow-sm">
                   <div className="w-16 h-16 bg-emerald-500 rounded-full text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <Compass size={32} />
                   </div>
                   <div className="text-center">
                     <div className="font-bold text-emerald-800 text-lg mb-1">双人奇遇探险</div>
                     <div className="text-xs text-emerald-600/80 font-medium">一起解决突发事件，培养默契</div>
                   </div>
                </button>
{/* You Draw I Guess Block */}
                <button onClick={() => setGameMode('charades')} className="w-full max-w-[280px] bg-purple-50 p-6 rounded-[2rem] border-2 border-purple-100 flex flex-col items-center gap-3 active:scale-95 transition-transform shadow-sm">
                   <div className="w-16 h-16 bg-purple-500 rounded-full text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <Brain size={32} />
                   </div>
                   <div className="text-center">
                     <div className="font-bold text-purple-800 text-lg mb-1">心有灵犀·猜词</div>
                     <div className="text-xs text-purple-600/80 font-medium">{char.name} 来描述，你来猜！</div>
                   </div>
                </button>
                <button onClick={() => setGameMode('reflex')} className="w-full max-w-[280px] bg-amber-50 p-6 rounded-[2rem] border-2 border-amber-100 flex flex-col items-center gap-3 active:scale-95 transition-transform shadow-sm">
                   <div className="w-16 h-16 bg-amber-500 rounded-full text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <Target size={32} />
                   </div>
                   <div className="text-center">
                     <div className="font-bold text-amber-800 text-lg mb-1">拍拍爪反应赛</div>
                     <div className="text-xs text-amber-600/80 font-medium">拍中发光格子，考验反应和配合</div>
                   </div>
                </button>
                <button onClick={() => setGameMode('rhythm')} className="w-full max-w-[280px] bg-sky-50 p-6 rounded-[2rem] border-2 border-sky-100 flex flex-col items-center gap-3 active:scale-95 transition-transform shadow-sm">
                   <div className="w-16 h-16 bg-sky-500 rounded-full text-white flex items-center justify-center shadow-lg shadow-sky-500/30">
                      <Sparkles size={32} />
                   </div>
                   <div className="text-center">
                     <div className="font-bold text-sky-800 text-lg mb-1">节奏踩点</div>
                     <div className="text-xs text-sky-600/80 font-medium">限时踩拍，速度越快拿币越多</div>
                   </div>
                </button>
                <button onClick={() => setGameMode('training')} className="w-full max-w-[280px] bg-rose-50 p-6 rounded-[2rem] border-2 border-rose-100 flex flex-col items-center gap-3 active:scale-95 transition-transform shadow-sm">
                   <div className="w-16 h-16 bg-rose-500 rounded-full text-white flex items-center justify-center shadow-lg shadow-rose-500/30">
                      <Trophy size={32} />
                   </div>
                   <div className="text-center">
                     <div className="font-bold text-rose-800 text-lg mb-1">动作模仿训练</div>
                     <div className="text-xs text-rose-600/80 font-medium">先记动作顺序，再限时复现出来</div>
                   </div>
                </button>
             </div>
          )}

          {gameMode === 'charades' && <CharadesGame copetData={copetData} char={char} updateCoPet={updateCoPet} onBack={() => setGameMode('menu')} />}
          {gameMode === 'reflex' && <ReflexGame copetData={copetData} updateCoPet={updateCoPet} onBack={() => setGameMode('menu')} />}
          {gameMode === 'rhythm' && <RhythmGame copetData={copetData} updateCoPet={updateCoPet} onBack={() => setGameMode('menu')} />}
          {gameMode === 'training' && <TrainingGame copetData={copetData} updateCoPet={updateCoPet} onBack={() => setGameMode('menu')} />}

          {gameMode === 'coop_adventure' && (
             <div className="flex-1 flex flex-col items-center w-full">
                <h2 className="text-2xl font-black text-slate-800 text-center mb-2">双人奇遇探险</h2>
                <p className="text-center text-slate-500 mb-6 text-sm">与 {char.name} 一起面对未知的挑战！</p>
                
                <div className="flex-1 flex flex-col justify-center w-full max-w-sm">
                   {isAiThinking && !adventureState ? (
                     <div className="flex flex-col items-center justify-center space-y-4 h-64">
                       <span className="text-4xl animate-bounce">🎲</span>
                       <p className="font-bold text-slate-500 animate-pulse">正在为你生成专属随机探险剧本...</p>
                     </div>
                   ) : adventureState ? (
                     <div className="animate-fade-in flex-1 flex flex-col items-center overflow-y-auto w-full">
                       <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 shadow-sm mb-6 w-full relative">
                         <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-bold px-4 py-1 rounded-full text-xs shadow-sm shadow-emerald-500/30">当前情境</div>
                         <p className="font-bold text-slate-700 text-sm leading-relaxed mt-2">{adventureState.scene}</p>
                       </div>
                       
                       {!adventureState.result && !isAiThinking ? (
                         <div className="space-y-4 w-full pb-8">
                           <p className="text-center font-bold text-slate-400 text-xs mb-2">你打算怎么做？</p>
                           {adventureState.options.map((opt, i) => (
                             <button key={i} onClick={() => submitAdventureChoice(opt)} className="w-full py-4 px-6 text-left rounded-2xl bg-white border-2 border-emerald-200 text-emerald-700 font-bold active:scale-95 transition-transform hover:bg-emerald-50">
                               {String.fromCharCode(65+i)}. {opt}
                             </button>
                           ))}
                         </div>
                       ) : adventureState.result ? (
                         <div className="animate-bounce-in w-full flex flex-col items-center mt-4">
                           <div className="text-center w-16 h-16 rounded-full overflow-hidden border-4 border-slate-100 mb-4 shadow-sm" style={{ background: char.avatar.startsWith('#') ? char.avatar : undefined }}>
                             {!char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full object-cover" alt="" />}
                           </div>
                           <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100 mb-6 text-center">
                             <p className="text-slate-700 font-bold text-sm leading-relaxed">{adventureState.result}</p>
                           </div>
                           {adventureState.coins && (
                           <div className="text-amber-500 font-bold mb-8 text-lg bg-amber-50 px-6 py-2 rounded-full border border-amber-200 text-center">
                              你们配合默契，获得了 {adventureState.coins} 金币！
                             </div>
                           )}
                           <button onClick={startCoopAdventure} className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-bold active:scale-95 transition-transform shadow-lg shadow-emerald-500/30 w-full mb-4">
                             继续下一场探险
                           </button>
                         </div>
                       ) : isAiThinking ? (
                         <div className="flex flex-col items-center justify-center space-y-4 h-32 w-full">
                           <div className="flex gap-2 text-emerald-500">
                             <div className="w-3 h-3 rounded-full bg-current animate-bounce" style={{animationDelay: '0ms'}}></div>
                             <div className="w-3 h-3 rounded-full bg-current animate-bounce" style={{animationDelay: '150ms'}}></div>
                           </div>
                           <p className="font-bold text-slate-500 text-xs">{char.name} 正在配合你的行动...</p>
                         </div>
                       ) : null}
                     </div>
                   ) : null}
                </div>
             </div>
          )}
        </div>
      )}

      {/* Store Overlay */}
      {showStore && (
        <div className="absolute inset-0 z-[60] bg-zinc-50 flex flex-col p-6 animate-fade-in overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <button onClick={() => setShowStore(false)} className="text-slate-500 flex items-center shrink-0">
              <ChevronLeft size={24}/> 返回
            </button>
            <div className="font-bold text-lg text-slate-800">家具铺</div>
            <div className="flex items-center gap-1 font-bold text-amber-500 shrink-0">
              <CircleDollarSign size={18} /> {copetData.coins || 0}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pb-20">
             {FURNITURES.map(f => {
               const isOwned = copetData.furniture?.some(item => (item.fId || item.id) === f.id);
               return (
                 <div key={f.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center relative gap-2 shrink-0">
                   <div className="w-16 h-16 my-2 rounded-xl overflow-hidden shrink-0">
                     <FurnitureFigure style={f.style} />
                   </div>
                   <div className="font-bold text-slate-700 text-sm text-center line-clamp-1">{f.name}</div>
                   
                   {isOwned ? (
                     <button disabled className="mt-2 text-xs font-bold bg-slate-100 text-slate-400 py-2 w-full rounded-xl">
                       已放置
                     </button>
                   ) : (
                     <button 
                       onClick={() => {
                         if ((copetData.coins || 0) < f.price) {
                           showToast('金币不足，快跟角色做任务赚币吧！');
                           return;
                         }
                         const newFurn = { id: `item_${Date.now()}_${Math.random()}`, fId: f.id, name: f.name, x: 20 + Math.random() * 60, y: 20 + Math.random() * 60 };
                         updateCoPet({
                           ...copetData,
                           coins: (copetData.coins || 0) - f.price,
                           furniture: [...(copetData.furniture || []), newFurn]
                         });
                         showToast(`购买成功！【${f.name}】已放入小屋。`);
                       }}
                       className={`mt-2 text-xs font-bold py-2 w-full rounded-xl flex items-center justify-center gap-1 transition-transform active:scale-95 ${
                         (copetData.coins || 0) >= f.price 
                           ? 'bg-amber-100 text-amber-600' 
                           : 'bg-slate-50 text-slate-400'
                       }`}
                     >
                       <CircleDollarSign size={14}/> {f.price}
                     </button>
                   )}
                 </div>
               );
             })}
          </div>
        </div>
      )}

    </div>
  );
}
