import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Wine, Skull, Star, Moon, Sun, Eye, LogOut, Send } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';

type CardRank = '太阳' | '月亮' | '星星';
type GamePhase = 'setup' | 'playing' | 'gameover';

interface Player {
  id: string;
  name: string;
  avatar: string;
  background?: string;
  isUser: boolean;
  lives: number;
  maxLives: number;
  hand: CardRank[];
}

interface PlayAction {
  playerId: string;
  declaredRank: CardRank;
  playedCards: CardRank[]; // always 1 card
  count: number; // always 1
  isLastCard: boolean;
}

interface ChatMsg {
  id: string;
  playerId: string;
  name: string;
  text: string;
  isSystem?: boolean;
}

interface GameMemory {
  roundLog: string[];
  loserInfo: { playerId: string; round: number }[];
  winnerId: string | null;
}

const RANKS: CardRank[] = ['太阳', '月亮', '星星'];
const STARTING_LIVES = 3;
const HAND_SIZE = 5;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const getCardIcon = (rank: CardRank | string, size = 28) => {
  if (rank === '太阳') return <Sun className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" size={size} />;
  if (rank === '月亮') return <Moon className="text-blue-300 drop-shadow-[0_0_8px_rgba(147,197,253,0.8)]" size={size} />;
  return <Star className="text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]" size={size} />;
};

function CardBack({ small = false }: { small?: boolean }) {
  return (
    <div className={`${small ? 'w-9 h-14 rounded-lg' : 'w-14 h-20 rounded-xl'} bg-gradient-to-b from-[#203044] via-[#132030] to-[#0a1320] border border-blue-700/50 shadow-[0_10px_18px_rgba(0,0,0,0.35)] flex items-center justify-center relative overflow-hidden`}>
      <div className="absolute inset-[6px] rounded-[10px] border border-blue-300/20" />
      <div className={`${small ? 'w-4 h-4' : 'w-6 h-6'} rounded-full border border-blue-300/40 bg-blue-400/10`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.12),transparent_60%)]" />
    </div>
  );
}

function FaceCard({ rank, selectable = false, selected = false, onClick, hidden = false, small = false }: { key?: React.Key; rank: CardRank; selectable?: boolean; selected?: boolean; onClick?: () => void; hidden?: boolean; small?: boolean }) {
  if (hidden) return <CardBack small={small} />;
  const s = small ? 'w-9 h-14 rounded-lg text-[10px]' : 'w-14 h-20 rounded-xl';
  const iconSize = small ? 18 : 24;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${s} border-2 flex flex-col items-center justify-center transition-all bg-gradient-to-b from-[#1a202c] to-[#0f172a] ${selectable ? 'cursor-pointer' : 'cursor-default'} ${selected ? 'border-blue-400 -translate-y-3 shadow-[0_0_20px_rgba(96,165,250,0.45)]' : 'border-blue-900/50'}`}
    >
      <div className="mb-0.5">{getCardIcon(rank, iconSize)}</div>
      <span className="text-[11px] text-blue-200">{rank}</span>
    </button>
  );
}

export default function LiarsBarApp() {
  const { closeApp, characters, addActivityLog } = useAppStore();
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);

  // Game state
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [currentSuit, setCurrentSuit] = useState<CardRank>('太阳');
  const [roundPlayedIds, setRoundPlayedIds] = useState<Set<string>>(new Set());
  const [lastPlay, setLastPlay] = useState<PlayAction | null>(null);
  const [lastPlayRevealed, setLastPlayRevealed] = useState(false);
  const [isChallengePhase, setIsChallengePhase] = useState(false);
  const [roundCount, setRoundCount] = useState(0);

  // UI state
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [spectating, setSpectating] = useState(false);

  // Chat
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Memory
  const [gameMemory, setGameMemory] = useState<GameMemory | null>(null);

  // Helpers
  const alivePlayers = useMemo(() => players.filter(p => p.lives > 0), [players]);
  const userPlayer = useMemo(() => players.find(p => p.isUser) ?? null, [players]);
  const currentPlayer = useMemo(() => players[currentPlayerIdx] ?? null, [players, currentPlayerIdx]);
  const isUserTurn = currentPlayer?.isUser ?? false;
  const isUserAlive = players.some(p => p.isUser && p.lives > 0);

  const nextAliveIndex = (fromIdx: number) => {
    let idx = fromIdx;
    for (let i = 0; i < players.length; i++) {
      idx = (idx + 1) % players.length;
      if (players[idx].lives > 0) return idx;
    }
    return fromIdx;
  };

  const getCharData = (playerId: string) => {
    const base = characters[playerId];
    return {
      name: base?.name || '未知',
      personality: base?.personality || '普通',
      relationship: base?.relationship || '',
    };
  };

  const addChat = (playerId: string, name: string, text: string, isSystem = false) => {
    setChatLog(prev => [...prev, { id: `${Date.now()}_${Math.random()}`, playerId, name, text, isSystem }]);
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatLog]);

  // ========== CORE GAME LOGIC ==========

  const buildHand = () => Array.from({ length: HAND_SIZE }, () => randomItem(RANKS));

  const removeLife = (playerId: string, playersState: Player[]): Player[] => {
    return playersState.map(p =>
      p.id === playerId ? { ...p, lives: Math.max(0, p.lives - 1) } : p
    );
  };

  const resolveGameOver = (playersState: Player[], winnerId: string | null) => {
    setGamePhase('gameover');
    setLastPlay(null);
    setLastPlayRevealed(false);
    setGameMemory(prev => prev ? { ...prev, winnerId } : prev);
    if (winnerId) {
      const winner = playersState.find(p => p.id === winnerId);
      addChat('system', '', `🏆 ${winner?.name || '某人'} 赢下了酒局！`, true);
      addActivityLog({
        id: `${Date.now()}_liarsbar`,
        title: '骗子酒馆',
        detail: `胜者是 ${winner?.name || '某人'}`,
        timestamp: Date.now(),
        relatedCharacterIds: playersState.filter(p => !p.isUser).map(p => p.id),
      });
    } else {
      addChat('system', '', '酒局结束，无人胜出。', true);
    }
  };

  const startNewRound = (playersState: Player[], lastPlayerId?: string) => {
    const suit = randomItem(RANKS);
    const newRoundCount = roundCount + 1;
    setRoundCount(newRoundCount);
    setCurrentSuit(suit);

    let startIdx: number;
    if (lastPlayerId) {
      // Next alive clockwise from the last player
      const lastIdx = playersState.findIndex(p => p.id === lastPlayerId);
      startIdx = nextAliveIndex(lastIdx);
    } else {
      // First round: random alive player
      const alive = playersState.filter(p => p.lives > 0);
      if (alive.length === 0) { resolveGameOver(playersState, null); return; }
      startIdx = playersState.findIndex(p => p.id === randomItem(alive).id);
    }

    setCurrentPlayerIdx(startIdx);
    setRoundPlayedIds(new Set());
    setLastPlay(null);
    setLastPlayRevealed(false);
    setIsChallengePhase(false);
    setSelectedCards([]);
    addChat('system', '', `🎴 第 ${newRoundCount} 轮：花色 ${suit}，${playersState[startIdx]?.name || '?'} 先出牌`, true);
  };

  const advanceAfterPlay = async (playersState: Player[], playerId: string) => {
    const p = playersState.find(pp => pp.id === playerId);
    const isAlive = p && p.lives > 0;
    const hasCards = p && p.hand.length > 0;

    let newPlayedIds = roundPlayedIds;
    if (isAlive && hasCards) {
      newPlayedIds = new Set(roundPlayedIds);
      newPlayedIds.add(playerId);
      setRoundPlayedIds(newPlayedIds);
    }

    // Check game over
    const aliveList = playersState.filter(pp => pp.lives > 0);
    if (aliveList.length <= 1) {
      resolveGameOver(playersState, aliveList[0]?.id || null);
      return;
    }

    // Find next alive player who hasn't played this round
    const currentIdx = playersState.findIndex(pp => pp.id === playerId);
    let idx = currentIdx;
    for (let i = 0; i < playersState.length; i++) {
      idx = (idx + 1) % playersState.length;
      if (playersState[idx].lives > 0 && !newPlayedIds.has(playersState[idx].id)) {
        setCurrentPlayerIdx(idx);
        setLastPlay(null);
        setLastPlayRevealed(false);
        setIsChallengePhase(false);
        setSelectedCards([]);
        return;
      }
    }

    // All alive players have played → new round
    startNewRound(playersState, playerId);
  };

  const resolveChallenge = async (challengerId: string, play: PlayAction, playersState: Player[]) => {
    const actor = playersState.find(p => p.id === play.playerId)!;
    const challenger = playersState.find(p => p.id === challengerId)!;
    const isBluff = play.playedCards[0] !== play.declaredRank;

    setLastPlayRevealed(true);
    addChat('system', '', `🔍 ${challenger.name} 质询了 ${actor.name}！翻开牌：${play.playedCards[0]}`, true);
    await sleep(800);

    if (isBluff) {
      // Caught bluffing
      if (play.isLastCard) {
        // Last card bluff → eliminated on the spot!
        addChat('system', '', `💀 ${actor.name} 最后一张牌吹牛被抓住，当场淘汰！`, true);
        const newPlayers = playersState.map(p =>
          p.id === actor.id ? { ...p, lives: 0 } : p
        );
        setPlayers(newPlayers);
        setGameMemory(prev => prev ? {
          ...prev,
          roundLog: [...prev.roundLog, `${actor.name} 最后一张牌吹牛被${challenger.name}抓，淘汰`],
          loserInfo: [...prev.loserInfo, { playerId: actor.id, round: prev.roundLog.length + 1 }],
        } : prev);
        if (actor.id === 'user') { addChat('system', '', '你已被淘汰，可继续观战。', true); setSpectating(true); }
        await sleep(500);
        await advanceAfterPlay(newPlayers, actor.id);
      } else {
        addChat('system', '', `❌ ${actor.name} 在说谎，失去一条命！`, true);
        const newPlayers = removeLife(actor.id, playersState);
        setPlayers(newPlayers);
        setGameMemory(prev => prev ? {
          ...prev,
          roundLog: [...prev.roundLog, `${actor.name} 吹牛被${challenger.name}抓，扣1命`],
          loserInfo: [...prev.loserInfo, { playerId: actor.id, round: prev.roundLog.length + 1 }],
        } : prev);
        if (actor.id === 'user' && newPlayers.find(p => p.isUser)?.lives === 0) {
          addChat('system', '', '你已出局，可继续观战。', true);
          setSpectating(true);
        }
        await sleep(500);
        await advanceAfterPlay(newPlayers, play.playerId);
      }
    } else {
      // Challenger was wrong
      addChat('system', '', `✅ ${actor.name} 没说谎，${challenger.name} 质询失败失去一条命！`, true);
      const newPlayers = removeLife(challenger.id, playersState);
      setPlayers(newPlayers);
      setGameMemory(prev => prev ? {
        ...prev,
        roundLog: [...prev.roundLog, `${challenger.name} 质询${actor.name}失败，扣1命`],
        loserInfo: [...prev.loserInfo, { playerId: challenger.id, round: prev.roundLog.length + 1 }],
      } : prev);
      if (challenger.id === 'user' && newPlayers.find(p => p.isUser)?.lives === 0) {
        addChat('system', '', '你已出局，可继续观战。', true);
        setSpectating(true);
      }
      await sleep(500);
      await advanceAfterPlay(newPlayers, play.playerId);
    }
  };

  const acceptPlay = async (play: PlayAction, playersState: Player[]) => {
    const actor = playersState.find(p => p.id === play.playerId)!;
    addChat('system', '', `✅ 无人质疑，${actor.name} 的牌被通过。`, true);

    const newPlayers = playersState.map(p => {
      if (p.id === play.playerId) {
        const newHand = [...p.hand];
        const idx = newHand.indexOf(play.playedCards[0]);
        if (idx > -1) newHand.splice(idx, 1);
        return { ...p, hand: newHand };
      }
      return p;
    });

    const actorUpdated = newPlayers.find(p => p.id === play.playerId)!;
    if (actorUpdated.hand.length === 0 && actorUpdated.lives > 0) {
      resolveGameOver(newPlayers, actorUpdated.id);
      return;
    }

    setPlayers(newPlayers);
    await advanceAfterPlay(newPlayers, play.playerId);
  };

  // ========== CHALLENGE PHASE ==========

  const handleChallengePhase = async (play: PlayAction, playersState: Player[]) => {
    // AI observers decide whether to challenge
    const observers = playersState.filter(p => p.id !== play.playerId && p.lives > 0 && !p.isUser);
    const isBluff = play.playedCards[0] !== play.declaredRank;
    let aiChallenger: Player | null = null;

    for (const obs of observers) {
      let chance = 0.18;
      if (isBluff) chance += 0.25;
      if (obs.hand.filter(c => c === play.declaredRank).length >= 2) chance += 0.15;
      if (play.isLastCard) chance += 0.25;
      if (obs.lives === 1) chance -= 0.08;
      if (Math.random() < chance) { aiChallenger = obs; break; }
    }

    if (aiChallenger) {
      setIsAiThinking(true);
      const speech = await generateChallengeSpeech(aiChallenger.id, play.playerId, play.declaredRank);
      setIsAiThinking(false);
      addChat(aiChallenger.id, aiChallenger.name, speech || `${aiChallenger.name}: 我不信！`);
      await sleep(500);
      await resolveChallenge(aiChallenger.id, play, playersState);
    } else if (play.playerId !== 'user' && playersState.some(p => p.isUser && p.lives > 0)) {
      // Wait for user to decide
      setIsChallengePhase(true);
    } else {
      await acceptPlay(play, playersState);
    }
  };

  // ========== AI TURN ==========

  const handleAIPlayTurn = async (player: Player, playersState: Player[], suit: CardRank) => {
    setIsAiThinking(true);

    // Decide which card to play
    const validCards = player.hand.filter(c => c === suit);
    let cardToPlay: CardRank;
    if (validCards.length > 0 && (validCards.length === player.hand.length || Math.random() > 0.35)) {
      // Play honestly (if all cards match, or 65% chance)
      cardToPlay = validCards[0];
    } else {
      // Bluff
      const bluffs = player.hand.filter(c => c !== suit);
      cardToPlay = randomItem(bluffs.length > 0 ? bluffs : player.hand);
    }

    const isLastCard = player.hand.length === 1;

    // Generate speech
    const speech = await generateAIPlaySpeech(player, suit);
    setIsAiThinking(false);

    addChat(speech ? player.id : 'system', speech ? player.name : '', speech || `${player.name} 打出了一张牌。`, !speech);

    // Remove card from hand
    const newPlayers = playersState.map(p => {
      if (p.id === player.id) {
        const newHand = [...p.hand];
        const idx = newHand.indexOf(cardToPlay);
        if (idx > -1) newHand.splice(idx, 1);
        return { ...p, hand: newHand };
      }
      return p;
    });

    setPlayers(newPlayers);

    const playAction: PlayAction = {
      playerId: player.id,
      declaredRank: suit,
      playedCards: [cardToPlay],
      count: 1,
      isLastCard,
    };

    setLastPlay(playAction);
    setLastPlayRevealed(false);

    await sleep(500);

    await handleChallengePhase(playAction, newPlayers);
  };

  // ========== AI SPEECH GENERATION ==========

  const generateAIPlaySpeech = async (player: Player, suit: CardRank) => {
    const data = getCharData(player.id);
    try {
      return await generateAIResponse(
        `你在玩骗子酒馆（Liar's Bar），轮到你出牌。当前花色是 ${suit}。
你是 ${data.name}，性格：${data.personality}，关系：${data.relationship}。
请说一句非常短的台词（不超过15字），表现你出牌时的态度——可以是虚张声势、淡定、挑衅等。
必须贴合角色性格，不要解释，不要括号动作描写。`
      );
    } catch { return ''; }
  };

  const generateChallengeSpeech = async (challengerId: string, targetId: string, suit: CardRank) => {
    const data = getCharData(challengerId);
    const target = players.find(p => p.id === targetId);
    try {
      const text = await generateAIResponse(
        `你在玩骗子酒馆。${target?.name || '某人'} 刚声称打出了 ${suit}，但你怀疑他在说谎。
你是 ${data.name}，性格：${data.personality}。
请说一句简短的台词（不超过15字）表达你要质询他，必须符合角色性格，不要解释。`
      );
      return `${data.name}: ${text}`;
    } catch { return null; }
  };

  const generateAIChatter = async (speakerId: string, playersState: Player[]) => {
    const data = getCharData(speakerId);
    const summary = playersState.map(p => `${p.name}(${p.lives}命/${p.hand.length}张)`).join('，');
    try {
      return await generateAIResponse(
        `我们在玩骗子酒馆，局势：${summary}。
你是 ${data.name}，性格：${data.personality}。
请说一句简短吐槽或评价（不超过15字），关于当前局势，必须符合角色性格。`
      );
    } catch { return null; }
  };

  const handleAIProactiveChat = async () => {
    const speakers = players.filter(p => !p.isUser && p.lives > 0);
    if (speakers.length === 0 || Math.random() > 0.25) return;
    const speaker: Player = randomItem(speakers);
    const data = getCharData(speaker.id);
    try {
      const summary = players.map(p => `${p.name}(${p.lives}命/${p.hand.length}张)`).join('，');
      const text = await generateAIResponse(
        `我们在玩骗子酒馆游戏，当前局势：${summary}，第 ${roundCount} 轮。
你是 ${data.name}，性格：${data.personality}。
请说一句简短的台词（不超过18字），关于当前局势的评论或闲聊，不要动作描写，要贴合角色性格。`
      );
      if (text) addChat(speaker.id, data.name, `${data.name}: ${text}`);
    } catch {}
  };

  // ========== USER ACTIONS ==========

  const handleUserPlay = async () => {
    if (!userPlayer || !isUserTurn || selectedCards.length === 0 || isAiThinking || lastPlay !== null) return;
    setIsAiThinking(true);
    const cardIndex = selectedCards[0];
    const cardToPlay = userPlayer.hand[cardIndex];
    const isLastCard = userPlayer.hand.length === 1;

    const playAction: PlayAction = {
      playerId: 'user',
      declaredRank: currentSuit,
      playedCards: [cardToPlay],
      count: 1,
      isLastCard,
    };

    const newPlayers = players.map(p => {
      if (p.isUser) {
        const newHand = [...p.hand];
        newHand.splice(cardIndex, 1);
        return { ...p, hand: newHand };
      }
      return p;
    });

    setPlayers(newPlayers);
    setLastPlay(playAction);
    setLastPlayRevealed(false);
    setSelectedCards([]);
    setIsAiThinking(false);
    addChat('system', '', `你打出了 1 张牌，声称是 ${currentSuit}。`, true);

    await sleep(400);
    await handleChallengePhase(playAction, newPlayers);
  };

  const handleUserChallenge = async () => {
    if (!lastPlay || !isChallengePhase || isAiThinking) return;
    setIsChallengePhase(false);
    setIsAiThinking(true);
    addChat('system', '', '你决定质询！', true);
    await sleep(300);
    setIsAiThinking(false);
    await resolveChallenge('user', lastPlay, players);
  };

  const handleUserPass = async () => {
    if (!lastPlay || !isChallengePhase || isAiThinking) return;
    setIsChallengePhase(false);
    setIsAiThinking(true);
    addChat('system', '', '你选择放行。', true);
    await sleep(300);
    setIsAiThinking(false);
    await acceptPlay(lastPlay, players);
  };

  // ========== CHAT ==========

  const handleUserChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiThinking) return;
    const msg = chatInput.trim();
    setChatInput('');
    addChat('user', '我', `我: ${msg}`);

    setIsAiThinking(true);
    const responders = players.filter(p => !p.isUser && p.lives > 0);
    if (responders.length > 0) {
      const responses = await Promise.all(responders.map(async player => {
        const data = getCharData(player.id);
        try {
          const context = lastPlay
            ? `当前 ${players.find(p => p.id === lastPlay.playerId)?.name} 出了牌`
            : `当前轮到你出牌，花色是 ${currentSuit}`;
          const reply = await generateAIResponse(
            `我们在玩骗子酒馆游戏。${context}。第 ${roundCount} 轮。
我刚才说：“${msg}”。
你是 ${data.name}，性格：${data.personality}，关系：${data.relationship}。
请用一句简短的微信消息回复我（不超过20字），要贴合角色性格，不要括号动作描写。`
          );
          return reply ? { playerId: player.id, name: data.name, text: `${data.name}: ${reply}` } : null;
        } catch { return null; }
      }));
      responses.filter(Boolean).forEach(r => {
        if (r) addChat(r.playerId, r.name, r.text);
      });
    }
    setIsAiThinking(false);

    await sleep(300);
    await handleAIProactiveChat();
  };

  // ========== EFFECTS ==========

  // AI turn trigger
  useEffect(() => {
    if (gamePhase !== 'playing' || isAiThinking) return;
    if (!currentPlayer || currentPlayer.isUser) return;
    // Only trigger if no pending play (not waiting for challenge resolution)
    if (lastPlay !== null) return;

    const runAITurn = async () => {
      setIsAiThinking(true);
      await sleep(600);
      await handleAIPlayTurn(currentPlayer, players, currentSuit);
    };
    runAITurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, currentPlayerIdx, lastPlay, isAiThinking]);

  // Proactive AI chat timer
  useEffect(() => {
    if (gamePhase !== 'playing') return;
    const timer = setInterval(() => {
      if (!isAiThinking) handleAIProactiveChat();
    }, 8000 + Math.random() * 7000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, players, roundCount]);

  // ========== GAME START ==========

  const startGame = () => {
    if (selectedCharIds.length !== 3) return;

    const initialPlayers: Player[] = [
      { id: 'user', name: '我', avatar: '', isUser: true, lives: STARTING_LIVES, maxLives: STARTING_LIVES, hand: buildHand() },
      ...selectedCharIds.map(id => ({
        id,
        name: characters[id]?.name || id,
        avatar: characters[id]?.avatar || '',
        background: characters[id]?.background,
        isUser: false,
        lives: STARTING_LIVES,
        maxLives: STARTING_LIVES,
        hand: buildHand(),
      })),
    ];

    setPlayers(initialPlayers);
    setChatInput('');
    setSpectating(false);
    setGameMemory({ roundLog: [], loserInfo: [], winnerId: null });
    setChatLog([{ id: `${Date.now()}`, playerId: 'system', name: '', text: '酒局开始！每人5张牌，3条命。每轮随机花色，依次出牌，可以吹牛！', isSystem: true }]);
    setGamePhase('playing');
    setRoundCount(0);
    setRoundPlayedIds(new Set());

    // Start first round
    const alive = initialPlayers.filter(p => p.lives > 0);
    const starter = randomItem(alive);
    const startIdx = initialPlayers.findIndex(p => p.id === starter.id);
    const suit = randomItem(RANKS);
    setCurrentSuit(suit);
    setCurrentPlayerIdx(startIdx);
    setLastPlay(null);
    setLastPlayRevealed(false);
    setIsChallengePhase(false);
    setSelectedCards([]);
    addChat('system', '', `🎴 第 1 轮：花色 ${suit}，${starter.name} 先出牌`, true);
  };

  const toggleCharSelection = (id: string) => {
    setSelectedCharIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const toggleCardSelection = (index: number) => {
    if (!isUserTurn || lastPlay !== null || isAiThinking) return;
    setSelectedCards(prev => prev.includes(index) ? [] : [index]);
  };

  // ========== RENDER ==========

  const visiblePlayers = gamePhase === 'setup' ? [] : players.filter(p => !p.isUser);

  // Setup screen
  if (gamePhase === 'setup') {
    return (
      <div className="h-full flex flex-col bg-[#0a0f1a] text-blue-100 font-serif relative overflow-hidden">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")' }} />
        <div className="px-4 pt-12 pb-4 flex items-center justify-between relative z-10 border-b border-blue-900/50">
          <button onClick={closeApp} className="w-8"><ChevronLeft size={28} /></button>
          <h1 className="text-lg tracking-widest flex items-center gap-2"><Wine size={20} /> 骗子酒馆</h1>
          <div className="w-8" />
        </div>

        <div className="flex-1 p-6 relative z-10 overflow-y-auto">
          <h2 className="text-xl text-center mb-2 text-blue-400">邀请酒客</h2>
          <p className="text-xs text-center text-blue-300/60 mb-8">选择三位角色入局。每人5张牌3条命，轮流出牌可以吹牛，被抓住就扣命！</p>

          <div className="grid grid-cols-2 gap-4">
            {Object.values(characters).filter(char => (char as any).isDisabled !== true).map(char => (
              <div
                key={char.id}
                onClick={() => toggleCharSelection(char.id)}
                className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-all ${selectedCharIds.includes(char.id) ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-black/40 border-blue-900/30 hover:border-blue-700/50'}`}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden" style={{ background: char.background }}>
                  {char.avatar.startsWith('#') ? null : <img src={char.avatar} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{char.name}</div>
                  <div className="text-[10px] text-blue-400/60 truncate">{char.personality}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 relative z-10 bg-[#0a0f1a]/80 backdrop-blur border-t border-blue-900/50 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <button
            onClick={startGame}
            disabled={selectedCharIds.length !== 3}
            className={`w-full py-3 rounded-lg font-bold tracking-widest transition-all ${selectedCharIds.length === 3 ? 'bg-blue-700 hover:bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 'bg-blue-900/20 text-blue-500/30 cursor-not-allowed'}`}
          >
            进入酒吧 ({selectedCharIds.length}/3)
          </button>
        </div>
      </div>
    );
  }

  // Game over screen
  if (gamePhase === 'gameover') {
    const winner = players.find(p => p.lives > 0);
    const winnerName = winner?.name || '无人';
    return (
      <div className="h-full flex flex-col bg-[#050a0f] text-blue-100 font-serif relative overflow-hidden">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")' }} />
        <div className="px-4 pt-12 pb-2 flex items-center justify-between relative z-10 shrink-0">
          <button onClick={closeApp}><ChevronLeft size={28} /></button>
          <div className="text-sm tracking-widest text-blue-400">Game Over</div>
          <div className="w-7" />
        </div>

        <div className="flex-1 relative z-10 overflow-y-auto p-6 space-y-6">
          <div className="text-center">
            <div className="text-2xl text-amber-400 font-bold mb-2">{winnerName} 赢下了酒局！</div>
            {winner?.id !== 'user' && (() => {
              const w = players.find(p => p.id === winner?.id);
              const data = w ? getCharData(w.id) : null;
              return data ? <div className="text-sm text-blue-300/70">{data.name}：{data.personality}</div> : null;
            })()}
          </div>

          <div className="rounded-xl border border-blue-800/40 bg-black/40 p-4">
            <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2"><Skull size={16} /> 最终排名</h3>
            <div className="space-y-2">
              {[...players].sort((a, b) => b.lives - a.lives).map((p, i) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.isUser ? '你' : p.name}</span>
                  <span className="text-blue-300">
                    {Array.from({ length: p.maxLives }).map((_, j) => (
                      <span key={j} className={j < p.lives ? 'text-red-400' : 'text-slate-700'}>{j < p.lives ? '♥' : '♡'}</span>
                    ))} {p.lives}/{p.maxLives} | {p.hand.length}张牌
                  </span>
                </div>
              ))}
            </div>
          </div>

          {gameMemory && (
            <div className="rounded-xl border border-blue-800/40 bg-black/40 p-4">
              <h3 className="text-blue-400 font-bold mb-3">战况回顾</h3>
              <div className="space-y-1 text-xs text-blue-200/70">
                {gameMemory.roundLog.map((log, i) => (
                  <div key={i}>· {log}</div>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const aiPlayers = players.filter(p => !p.isUser);
            const [impressions, setImpressions] = useState<string[]>([]);
            useEffect(() => {
              if (impressions.length > 0) return;
              const generate = async () => {
                const results = await Promise.all(aiPlayers.map(async p => {
                  const data = getCharData(p.id);
                  const wn = players.find(pp => pp.lives > 0)?.name || '无人';
                  try {
                    const text = await generateAIResponse(
                      `你刚刚结束了一局骗子酒馆游戏。最终 ${wn} 获胜。你的最终状态是 ${p.lives}/${p.maxLives} 条命，剩余 ${p.hand.length} 张牌。
你是 ${data.name}，性格：${data.personality}。
请用一句简短的感言（不超过20字）评价这场游戏，贴合你的性格。`
                    );
                    return `${data.name}: ${text || '有意思的一局。'}`;
                  } catch { return `${data.name}: 有意思的一局。`; }
                }));
                setImpressions(results);
              };
              generate();
            }, []);
            if (impressions.length > 0) {
              return (
                <div className="rounded-xl border border-blue-800/40 bg-black/40 p-4">
                  <h3 className="text-blue-400 font-bold mb-3">角色感言</h3>
                  <div className="space-y-2 text-sm">
                    {impressions.map((txt, i) => (
                      <div key={i} className="text-blue-100">{txt}</div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <button onClick={() => setGamePhase('setup')} className="w-full py-3 bg-blue-700 rounded-lg text-white font-bold">
            再来一局
          </button>
        </div>
      </div>
    );
  }

  // ========== PLAYING UI ==========

  return (
    <div className="h-full flex flex-col bg-[#050a0f] text-blue-100 font-serif relative overflow-hidden">
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-900/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="px-4 pt-12 pb-2 flex items-center justify-between relative z-10 shrink-0">
        <button onClick={() => setGamePhase('setup')}><ChevronLeft size={28} /></button>
        <div className="text-center">
          <div className="text-sm tracking-widest text-blue-400">Liar's Bar</div>
          <div className="text-[10px] text-blue-300/50">第 {roundCount} 轮 | 花色：{currentSuit}</div>
        </div>
        <div className="w-7" />
      </div>

      {/* Player avatars row */}
      <div className="px-4 pt-2 pb-3 relative z-10 shrink-0">
        <div className="flex justify-around items-start gap-2">
          {visiblePlayers.map(player => {
            const isCurrent = currentPlayerIdx === players.findIndex(p => p.id === player.id);
            const needToPlay = player.lives > 0 && !roundPlayedIds.has(player.id);
            return (
              <div key={player.id} className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-105 drop-shadow-[0_0_10px_rgba(59,130,246,0.75)]' : 'opacity-70'}`}>
                <div className="relative">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-900/50" style={{ background: characters[player.id]?.background || '#333' }}>
                    {player.avatar && !player.avatar.startsWith('#') && <img src={player.avatar} alt="" className="w-full h-full object-cover" />}
                  </div>
                  {player.lives <= 0 && (
                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center rounded-full">
                      <Skull size={20} className="text-red-500" />
                    </div>
                  )}
                </div>
                <div className="text-[10px] mt-1 max-w-[66px] truncate text-center">{player.name}</div>
                {needToPlay && !isCurrent && <div className="text-[8px] text-blue-400/60 mt-0.5">待出牌</div>}
                <div className="flex gap-1 mt-1">
                  {Array.from({ length: player.maxLives }).map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < player.lives ? 'bg-red-500' : 'bg-slate-800'}`} />
                  ))}
                </div>
                <div className="text-[10px] text-blue-400 mt-0.5">{player.hand.length}张</div>
                {/* Show cards if spectating or player is eliminated */}
                {(!isUserAlive || player.lives <= 0) && player.lives > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[84px]">
                    {player.hand.map((card, idx) => (
                      <div key={idx} className="scale-[0.55] origin-top -mr-2 last:mr-0"><FaceCard rank={card} small /></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* User player */}
          {(() => {
            const userP = players.find(p => p.isUser);
            if (!userP) return null;
            const isCurrent = currentPlayerIdx === players.findIndex(p => p.isUser);
            return (
              <div key="user" className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-105 drop-shadow-[0_0_10px_rgba(59,130,246,0.75)]' : 'opacity-60'}`}>
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-900/50 bg-blue-800 flex items-center justify-center text-lg font-bold">
                  我
                </div>
                <div className="text-[10px] mt-1">你</div>
                <div className="flex gap-1 mt-1">
                  {Array.from({ length: userP.maxLives }).map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < userP.lives ? 'bg-red-500' : 'bg-slate-800'}`} />
                  ))}
                </div>
                <div className="text-[10px] text-blue-400 mt-0.5">{userP.hand.length}张</div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 relative z-10 px-4 pb-2 flex flex-col gap-2">

        {/* Round info card */}
        <div className="rounded-[1.5rem] border border-blue-900/40 bg-black/40 backdrop-blur-sm p-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getCardIcon(currentSuit, 20)}
              <span className="text-sm font-bold text-blue-300">{currentSuit}</span>
              <span className="text-[10px] text-blue-300/50 ml-1">
                当前：{currentPlayer?.name || '—'}
                {currentPlayer?.isUser ? ' (你)' : ''}
              </span>
            </div>
            <div className="text-[10px] text-blue-300/60">
              出牌：{roundPlayedIds.size}/{alivePlayers.length}
            </div>
          </div>
          {lastPlay && (
            <div className="flex items-center gap-2 mt-2">
              <div className="text-xs text-blue-200">
                {players.find(p => p.id === lastPlay.playerId)?.name} 声称：1张{lastPlay.declaredRank}
                {lastPlay.isLastCard && <span className="text-yellow-400 ml-1">(最后一张!)</span>}
              </div>
              <div className="flex gap-1 ml-2">
                {lastPlay.playedCards.map((card, idx) => (
                  <div key={idx} className="scale-[0.6] origin-left -ml-2 first:ml-0">
                    {lastPlayRevealed ? <FaceCard rank={card} small /> : <CardBack small />}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Challenge prompt for user */}
          {isChallengePhase && isUserAlive && lastPlay && !lastPlayRevealed && (
            <div className="mt-2 pt-2 border-t border-blue-900/30">
              <div className="text-xs text-yellow-300/80 mb-2 flex items-center gap-1">
                <Eye size={12} />
                是否质疑 {players.find(p => p.id === lastPlay.playerId)?.name}？
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleUserChallenge}
                  disabled={isAiThinking}
                  className="flex-1 py-2 rounded-lg border border-red-700 bg-red-900/20 text-red-300 font-bold text-xs disabled:opacity-40 hover:bg-red-900/40 transition-all"
                >
                  质疑！
                </button>
                <button
                  onClick={handleUserPass}
                  disabled={isAiThinking}
                  className="flex-1 py-2 rounded-lg bg-blue-700/50 text-white font-bold text-xs disabled:opacity-40 hover:bg-blue-700 transition-all"
                >
                  放行
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 min-h-0 rounded-[1.5rem] border border-blue-900/30 bg-black/35 p-3 overflow-y-auto flex flex-col gap-1.5">
          {chatLog.map(entry => (
            <div key={entry.id} className={`text-xs leading-relaxed ${
              entry.isSystem ? 'text-blue-400 text-center font-bold my-1' :
              entry.playerId === 'user' ? 'text-blue-200 text-right' :
              'text-blue-100/85'
            }`}>
              {entry.text}
            </div>
          ))}
          {isAiThinking && <div className="text-blue-500/60 animate-pulse text-xs text-center">思考中...</div>}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Bottom action area */}
      <div className="relative z-10 shrink-0 bg-gradient-to-t from-[#050a0f] via-black/90 to-[#050a0f]/80 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] space-y-3">

        {/* Spectator message */}
        {!isUserAlive && (
          <div className="text-center text-xs text-blue-300/70 py-1 flex items-center justify-center gap-2">
            <Eye size={14} /> 你已出局，正在观战（可看到所有玩家手牌）
          </div>
        )}

        {/* User's hand - show during user's play turn */}
        {isUserTurn && lastPlay === null && isUserAlive && (
          <div className="flex justify-center gap-1.5 flex-wrap">
            {userPlayer?.hand.map((card, idx) => (
              <FaceCard
                key={idx}
                rank={card}
                selectable
                selected={selectedCards.includes(idx)}
                onClick={() => toggleCardSelection(idx)}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        {isUserAlive && (
          <>
            {/* User's turn to play */}
            {isUserTurn && lastPlay === null && (
              <button
                onClick={handleUserPlay}
                disabled={selectedCards.length === 0 || isAiThinking}
                className="w-full py-3 rounded-lg bg-blue-700 text-white font-bold text-sm disabled:opacity-30 hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              >
                出牌 ({selectedCards.length}/1)
              </button>
            )}

            {/* Chat input - always available for alive user */}
            <form onSubmit={handleUserChat} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                className="flex-1 bg-black/40 border border-blue-900/50 rounded-lg px-3 py-2.5 text-sm text-blue-100 placeholder-blue-800 outline-none focus:border-blue-500"
                placeholder="和角色们聊天..."
                disabled={isAiThinking}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isAiThinking}
                className="px-4 bg-blue-800 text-white rounded-lg font-bold text-sm disabled:opacity-50 flex items-center gap-1"
              >
                <Send size={16} /> 发送
              </button>
            </form>
          </>
        )}

        {/* Spectator options */}
        {!isUserAlive && (
          <>
            {/* Show all hands for spectator */}
            <div className="flex flex-wrap gap-2 justify-center">
              {players.filter(p => p.lives > 0).map(p => (
                <div key={p.id} className="text-center">
                  <div className="text-[10px] text-blue-400 mb-1">{p.name}的手牌</div>
                  <div className="flex gap-0.5 justify-center">
                    {p.hand.map((card, idx) => (
                      <div key={idx}><FaceCard rank={card} small /></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setGamePhase('setup')} className="w-full py-3 rounded-lg border border-blue-700 text-blue-300 font-bold text-sm">
              退出观战
            </button>
          </>
        )}
      </div>
    </div>
  );
}
