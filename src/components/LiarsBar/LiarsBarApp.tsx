import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Wine, Skull, Star, Moon, Sun, Eye, LogOut } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';

type GameState = 'setup' | 'playing' | 'gameover';
type CardRank = '太阳' | '月亮' | '星星';
type ReactionType = 'accept' | 'challenge' | 'taunt';

interface Player {
  id: string;
  name: string;
  avatar: string;
  isUser: boolean;
  lives: number;
  hand: CardRank[];
}

interface LogEntry {
  id: string;
  text: string;
  isSystem?: boolean;
}

interface ReactionEntry {
  playerId: string;
  type: ReactionType;
  text: string;
  willChallenge: boolean;
}

interface PendingPlay {
  actorId: string;
  declaredRank: CardRank;
  actualCards: CardRank[];
  revealed: boolean;
  acceptedWithoutChallenge: boolean;
}

const RANKS: CardRank[] = ['太阳', '月亮', '星星'];
const HAND_SIZE = 6;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const randomItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const getCardIcon = (rank: CardRank, size = 28) => {
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

function FaceCard({ rank, selectable = false, selected = false, onClick, hidden = false }: { key?: React.Key; rank: CardRank; selectable?: boolean; selected?: boolean; onClick?: () => void; hidden?: boolean }) {
  if (hidden) return <CardBack />;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-14 h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all bg-gradient-to-b from-[#1a202c] to-[#0f172a] ${selectable ? 'cursor-pointer' : 'cursor-default'} ${selected ? 'border-blue-400 -translate-y-3 shadow-[0_0_20px_rgba(96,165,250,0.45)]' : 'border-blue-900/50'}`}
    >
      <div className="mb-1">{getCardIcon(rank, 24)}</div>
      <span className="text-[11px] text-blue-200">{rank}</span>
    </button>
  );
}

export default function LiarsBarApp() {
  const { closeApp, characters, worldSettings, addActivityLog } = useAppStore();
  const [gameState, setGameState] = useState<GameState>('setup');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentActorId, setCurrentActorId] = useState<string | null>(null);
  const [currentRank, setCurrentRank] = useState<CardRank>('太阳');
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null);
  const [reactions, setReactions] = useState<ReactionEntry[]>([]);
  const [gameLog, setGameLog] = useState<LogEntry[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [spectating, setSpectating] = useState(false);
  const [showSpectatePrompt, setShowSpectatePrompt] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [turnCounter, setTurnCounter] = useState(1);

  const userPlayer = useMemo(() => players.find(p => p.isUser) || null, [players]);
  const currentActor = useMemo(() => players.find(p => p.id === currentActorId) || null, [players, currentActorId]);

  const getAlivePlayers = (source: Player[] = players): Player[] => source.filter(player => player.lives > 0);
  const getEligiblePlayers = (source: Player[] = players): Player[] => source.filter(player => player.lives > 0 && player.hand.length > 0);
  const isUserAlive = (source = players) => Boolean(source.find(player => player.isUser && player.lives > 0));

  const appendLog = (text: string, isSystem = false) => {
    setGameLog(prev => [...prev, { id: `${Date.now()}_${Math.random()}`, text, isSystem }]);
  };

  const getCharacterPersona = (playerId: string) => {
    const base = characters[playerId];
    let card = null as any;
    for (const ws of worldSettings) {
      const found = ws.characters.find(character => character.id === playerId);
      if (found) {
        card = found;
        break;
      }
    }

    return {
      name: base?.name || '未知角色',
      personality: card?.personality || base?.personality || '',
      relationship: card?.relationship || base?.relationship || '',
      experience: card?.experience || '',
      viewOnMe: card?.viewOnMe || '',
      interactionMode: card?.interactionMode || base?.interactionMode || '',
    };
  };

  const buildHands = () =>
    Array.from({ length: HAND_SIZE }, () => randomItem(RANKS));

  const getRandomNextActorId = (source: Player[], excludeId?: string) => {
    const eligible = getEligiblePlayers(source).filter(player => player.id !== excludeId);
    if (eligible.length > 0) return randomItem(eligible).id;
    const fallback = getEligiblePlayers(source);
    return fallback.length > 0 ? randomItem(fallback).id : null;
  };

  const finishGame = (playersState: Player[], winner?: string | null) => {
    const alive = getAlivePlayers(playersState);
    const resolvedWinner = winner || alive[0]?.id || null;
    setPlayers(playersState);
    setWinnerId(resolvedWinner);
    setPendingPlay(null);
    setReactions([]);
    setCurrentActorId(null);
    setGameState('gameover');
    if (resolvedWinner) {
      const winnerName = playersState.find(player => player.id === resolvedWinner)?.name || '未知玩家';
      appendLog(`游戏结束，${winnerName} 获胜。`, true);
      addActivityLog({
        id: `${Date.now()}_liarsbar`,
        title: '骗子酒吧结局',
        detail: `胜者是 ${winnerName}`,
        timestamp: Date.now(),
        relatedCharacterIds: playersState.filter(player => !player.isUser).map(player => player.id)
      });
    } else {
      appendLog('游戏结束。', true);
    }
  };

  const prepareNextTurn = (playersState: Player[], excludeActorId?: string) => {
    const alive = getAlivePlayers(playersState);
    if (alive.length <= 1) {
      finishGame(playersState, alive[0]?.id || null);
      return;
    }

    const nextActorId = getRandomNextActorId(playersState, excludeActorId);
    if (!nextActorId) {
      const survivor = alive.sort((a, b) => b.lives - a.lives || a.hand.length - b.hand.length)[0];
      finishGame(playersState, survivor?.id || null);
      return;
    }

    const nextRank = randomItem(RANKS);
    setPlayers(playersState);
    setPendingPlay(null);
    setReactions([]);
    setSelectedCards([]);
    setCurrentActorId(nextActorId);
    setCurrentRank(nextRank);
    setTurnCounter(prev => prev + 1);
    appendLog(`新回合开始，主题花色是 ${nextRank}。`, true);
  };

  const buildReactionPrompt = (speakerId: string, actorId: string, cardCount: number, declaredRank: CardRank, type: ReactionType) => {
    const speaker = getCharacterPersona(speakerId);
    const actorName = players.find(player => player.id === actorId)?.name || '某人';
    const actionHint =
      type === 'challenge'
        ? '你倾向于质询对方'
        : type === 'accept'
          ? '你倾向于认同并放行'
          : '你想冷嘲热讽一下';

    return `你正在玩骗子酒馆。现在 ${actorName} 刚打出 ${cardCount} 张牌，声称它们都是 ${declaredRank}。
你是 ${speaker.name}。
你的性格：${speaker.personality}。
你的经历：${speaker.experience}。
你和用户的关系：${speaker.relationship}。
 你的说话方式：${speaker.interactionMode || '自然'}。
 你对用户的态度：${speaker.viewOnMe}。
${actionHint}。
请只说一句非常短的话，不超过18个字，语气必须明显符合角色人设和说话方式，不要解释规则，不要带括号动作描写。`;
  };

  const buildTalkbackPrompt = (speakerId: string, userText: string) => {
    const speaker = getCharacterPersona(speakerId);
    const actorName = players.find(player => player.id === pendingPlay?.actorId)?.name || '某人';
    return `我们正在骗子酒馆的质询阶段。当前出牌的人是 ${actorName}，主题花色是 ${pendingPlay?.declaredRank}。
我刚才说：“${userText}”。
你是 ${speaker.name}。
你的性格：${speaker.personality}。
你的经历：${speaker.experience}。
 你的说话方式：${speaker.interactionMode || '自然'}。
 你对用户的态度：${speaker.viewOnMe}。
请用一句短话回复我，必须明显符合角色人设，不要带括号动作描写。`;
  };

  const pickChallengeIntent = (observer: Player, actor: Player, actualCards: CardRank[]) => {
    const isBluff = actualCards.some(card => card !== currentRank);
    let chance = 0.16 + actualCards.length * 0.08;
    if (isBluff) chance += 0.18;
    if (actor.hand.length <= actualCards.length) chance += 0.12;
    if (observer.lives === 1) chance -= 0.07;
    chance += Math.random() * 0.12;
    return Math.random() < chance;
  };

  const collectAIReactions = async (playersState: Player[], actorId: string, actualCards: CardRank[]) => {
    const actor = playersState.find(player => player.id === actorId);
    if (!actor) return [];

    const observers = playersState.filter(player => player.id !== actorId && player.lives > 0 && !player.isUser);
    const generated = await Promise.all(observers.map(async observer => {
      const willChallenge = pickChallengeIntent(observer, actor, actualCards);
      const type: ReactionType = willChallenge ? 'challenge' : Math.random() > 0.45 ? 'accept' : 'taunt';
      try {
        const text = await generateAIResponse(buildReactionPrompt(observer.id, actorId, actualCards.length, currentRank, type));
        return { playerId: observer.id, text: `${observer.name}: ${text}`, type, willChallenge };
      } catch {
        const fallback = willChallenge ? `${observer.name}: 我不信。` : `${observer.name}: 行，那就先过。`;
        return { playerId: observer.id, text: fallback, type, willChallenge };
      }
    }));

    generated.forEach(entry => appendLog(entry.text));
    setReactions(generated.map(({ playerId, type, willChallenge, text }) => ({ playerId, type, willChallenge, text })));
    return generated;
  };

  const resolveChallenge = async (challengerId: string, targetId: string, playersState = players, pendingState = pendingPlay) => {
    if (!pendingState) return;

    const liar = pendingState.actualCards.some(card => card !== pendingState.declaredRank);
    const loserId = liar ? targetId : challengerId;
    const challengerName = playersState.find(player => player.id === challengerId)?.name || '某人';
    const targetName = playersState.find(player => player.id === targetId)?.name || '某人';

    setPendingPlay(prev => prev ? { ...prev, revealed: true, acceptedWithoutChallenge: false } : prev);
    appendLog(`${challengerName} 质询了 ${targetName}。`, true);
    appendLog(`翻牌结果：${pendingState.actualCards.join('、')}`, true);

    const updatedPlayers = playersState.map(player =>
      player.id === loserId
        ? { ...player, lives: Math.max(0, player.lives - 1) }
        : player
    );

    setPlayers(updatedPlayers);
    appendLog(liar ? `${targetName} 说谎，失去一条命。` : `${challengerName} 质询失败，失去一条命。`, true);

    await sleep(1200);

    const alive = getAlivePlayers(updatedPlayers);
    if (alive.length <= 1) {
      finishGame(updatedPlayers, alive[0]?.id || null);
      return;
    }

    const userLost = loserId === 'user' && !spectating && updatedPlayers.find(player => player.id === 'user')?.lives === 0;
    if (userLost) {
      setShowSpectatePrompt(true);
      return;
    }

    prepareNextTurn(updatedPlayers, targetId);
  };

  const handleAcceptPlay = async (
    playersState = players,
    pendingState = pendingPlay,
    reactionState = reactions,
    allowFollowupChallenge = true
  ) => {
    if (!pendingState) return;

    if (allowFollowupChallenge && pendingState.actorId !== 'user' && isUserAlive(playersState) && !spectating) {
      const aiChallenger = reactionState.find(reaction => reaction.willChallenge);
      if (aiChallenger) {
        await resolveChallenge(aiChallenger.playerId, pendingState.actorId, playersState, pendingState);
        return;
      }
    }

    const actor = playersState.find(player => player.id === pendingState.actorId);
    if (!actor) return;

    const updatedPending = { ...pendingState, acceptedWithoutChallenge: true };
    setPendingPlay(updatedPending);
    appendLog(`这一轮无人质询，${actor.name} 的牌被默认通过。`, true);

    if (actor.hand.length === 0 && actor.lives > 0) {
      finishGame(playersState, actor.id);
      return;
    }

    await sleep(500);
    prepareNextTurn(playersState, actor.id);
  };

  const autoResolveAfterAIReactions = async (actorId: string, generatedReactions: ReactionEntry[], playersState: Player[], pendingState: PendingPlay) => {
    const aiChallenger = generatedReactions.find(reaction => reaction.willChallenge);
    if (aiChallenger) {
      await resolveChallenge(aiChallenger.playerId, actorId, playersState, pendingState);
    } else {
      await handleAcceptPlay(playersState, pendingState, generatedReactions, false);
    }
  };

  const executePlay = async (actorId: string, actualCards: CardRank[], spokenLine?: string) => {
    const actor = players.find(player => player.id === actorId);
    if (!actor || actualCards.length === 0) return;

    const newHand = [...actor.hand];
    actualCards.forEach(card => {
      const idx = newHand.indexOf(card);
      if (idx > -1) newHand.splice(idx, 1);
    });

    const updatedPlayers = players.map(player =>
      player.id === actorId ? { ...player, hand: newHand } : player
    );

    setPlayers(updatedPlayers);
    const createdPending: PendingPlay = {
      actorId,
      declaredRank: currentRank,
      actualCards,
      revealed: false,
      acceptedWithoutChallenge: false,
    };
    setPendingPlay(createdPending);
    setSelectedCards([]);
    setReactions([]);

    appendLog(`${actor.name} 打出了 ${actualCards.length} 张牌，声称它们都是 ${currentRank}。`, true);
    if (spokenLine) appendLog(`${actor.name}: ${spokenLine}`);

    const generated = await collectAIReactions(updatedPlayers, actorId, actualCards);

    if (actorId === 'user') {
      await autoResolveAfterAIReactions(actorId, generated, updatedPlayers, createdPending);
      return;
    }

    if (!isUserAlive(updatedPlayers) || spectating) {
      await autoResolveAfterAIReactions(actorId, generated, updatedPlayers, createdPending);
      return;
    }
  };

  const generateAIPlaySpeech = async (player: Player, cardCount: number) => {
    const persona = getCharacterPersona(player.id);
    const prompt = `你在玩骗子酒馆。现在轮到你出牌，主题花色是 ${currentRank}，你准备打出 ${cardCount} 张牌。
你是 ${persona.name}，性格是 ${persona.personality}，经历是 ${persona.experience}，说话方式是 ${persona.interactionMode || '自然'}。
请说一句短话，表现你的试探、虚张声势或淡定，必须贴合人设，而且不同角色要有明显口气差异，不要带括号动作描写，不超过18字。`;
    try {
      return await generateAIResponse(prompt);
    } catch {
      return '那就先这样。';
    }
  };

  const runAITurn = async () => {
    if (!currentActor || currentActor.isUser || pendingPlay || showSpectatePrompt) return;
    setIsAiThinking(true);
    await sleep(900);

    const validCards = currentActor.hand.filter(card => card === currentRank);
    const invalidCards = currentActor.hand.filter(card => card !== currentRank);
    const maxPlayable = Math.min(3, currentActor.hand.length);
    const desiredCount = Math.max(1, Math.floor(Math.random() * maxPlayable) + 1);

    let cardsToPlay: CardRank[] = [];
    if (validCards.length >= desiredCount && Math.random() > 0.28) {
      cardsToPlay = validCards.slice(0, desiredCount);
    } else {
      const source = (validCards.length > 0 && Math.random() > 0.5)
        ? [...validCards, ...invalidCards]
        : [...invalidCards, ...validCards];
      cardsToPlay = source.slice(0, desiredCount);
    }

    if (cardsToPlay.length === 0) cardsToPlay = [currentActor.hand[0]];

    const speech = await generateAIPlaySpeech(currentActor, cardsToPlay.length);
    setIsAiThinking(false);
    await executePlay(currentActor.id, cardsToPlay, speech);
  };

  useEffect(() => {
    if (gameState !== 'playing' || isAiThinking || pendingPlay || showSpectatePrompt || !currentActor) return;
    if (!currentActor.isUser) {
      runAITurn();
    }
  }, [gameState, currentActorId, pendingPlay, showSpectatePrompt, currentActor, isAiThinking]);

  const handleUserChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiThinking || !pendingPlay || pendingPlay.actorId === 'user' || spectating || !isUserAlive()) return;

    const msg = chatInput.trim();
    setChatInput('');
    appendLog(`我: ${msg}`);

    setIsAiThinking(true);
    const responders = players.filter(player => !player.isUser && player.lives > 0);
    const responses = await Promise.all(responders.map(async player => {
      try {
        const reply = await generateAIResponse(buildTalkbackPrompt(player.id, msg));
        return `${player.name}: ${reply}`;
      } catch {
        return `${player.name}: ……`;
      }
    }));
    responses.forEach(text => appendLog(text));
    setIsAiThinking(false);
  };

  const startGame = () => {
    if (selectedCharIds.length !== 3) return;

    const initialPlayers: Player[] = [
      { id: 'user', name: '我', avatar: '', isUser: true, lives: 3, hand: buildHands() },
      ...selectedCharIds.map(id => ({
        id,
        name: characters[id].name,
        avatar: characters[id].avatar,
        isUser: false,
        lives: 3,
        hand: buildHands(),
      }))
    ];

    const firstActorId = getRandomNextActorId(initialPlayers);
    const firstRank = randomItem(RANKS);
    setPlayers(initialPlayers);
    setCurrentActorId(firstActorId);
    setCurrentRank(firstRank);
    setSelectedCards([]);
    setPendingPlay(null);
    setReactions([]);
    setChatInput('');
    setSpectating(false);
    setShowSpectatePrompt(false);
    setWinnerId(null);
    setTurnCounter(1);
    setGameLog([{ id: `${Date.now()}`, text: `游戏开始，首轮主题花色是 ${firstRank}。`, isSystem: true }]);
    setGameState('playing');
  };

  const toggleCharSelection = (id: string) => {
    if (selectedCharIds.includes(id)) {
      setSelectedCharIds(prev => prev.filter(item => item !== id));
    } else if (selectedCharIds.length < 3) {
      setSelectedCharIds(prev => [...prev, id]);
    }
  };

  const toggleCardSelection = (index: number) => {
    if (!userPlayer || currentActorId !== 'user' || pendingPlay || spectating) return;
    if (selectedCards.includes(index)) {
      setSelectedCards(prev => prev.filter(item => item !== index));
    } else {
      setSelectedCards(prev => [...prev, index]);
    }
  };

  const handleUserPlay = async () => {
    if (!userPlayer || currentActorId !== 'user' || selectedCards.length === 0 || pendingPlay || spectating) return;
    const actualCards = selectedCards.map(index => userPlayer.hand[index]);
    await executePlay('user', actualCards);
  };

  const visiblePlayers = players.filter(player => !player.isUser);
  const responseStageForUser = Boolean(
    pendingPlay &&
    pendingPlay.actorId !== 'user' &&
    isUserAlive() &&
    !spectating
  );

  if (gameState === 'setup') {
    return (
      <div className="h-full flex flex-col bg-[#0a0f1a] text-blue-100 font-serif relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-50"></div>
        <div className="px-4 pt-12 pb-4 flex items-center justify-between relative z-10 border-b border-blue-900/50">
          <button onClick={closeApp} className="w-8"><ChevronLeft size={28} /></button>
          <h1 className="text-lg tracking-widest flex items-center gap-2"><Wine size={20} /> 骗子酒馆</h1>
          <div className="w-8"></div>
        </div>
        
        <div className="flex-1 p-6 relative z-10 overflow-y-auto">
          <h2 className="text-xl text-center mb-2 text-blue-400">邀请酒客</h2>
          <p className="text-xs text-center text-blue-300/60 mb-8">选择三位角色入局。每人三条命，谁最先安全出完手牌，谁就能赢。</p>
          
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

  return (
    <div className="h-full flex flex-col bg-[#050a0f] text-blue-100 font-serif relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-50"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-900/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="px-4 pt-12 pb-2 flex items-center justify-between relative z-10 shrink-0">
        <button onClick={() => setGameState('setup')}><ChevronLeft size={28} /></button>
        <div className="text-center">
          <div className="text-sm tracking-widest text-blue-400">Liar's Bar</div>
          <div className="text-[10px] text-blue-300/50">第 {turnCounter} 轮</div>
        </div>
        <div className="w-7"></div>
      </div>

      <div className="px-4 pt-2 pb-3 relative z-10 shrink-0">
        <div className="flex justify-around items-start gap-2">
          {visiblePlayers.map(player => {
            const isCurrent = currentActorId === player.id;
            return (
              <div key={player.id} className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-105 drop-shadow-[0_0_10px_rgba(59,130,246,0.75)]' : 'opacity-80'}`}>
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
                <div className="flex gap-1 mt-1">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className={`w-2 h-2 rounded-full ${index < player.lives ? 'bg-blue-500' : 'bg-slate-800'}`} />
                  ))}
                </div>
                <div className="text-[10px] text-blue-400 mt-1">{player.hand.length} 张牌</div>
                {(spectating || gameState === 'gameover') && player.lives > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap justify-center max-w-[84px]">
                    {player.hand.map((card, index) => (
                      <div key={`${player.id}_${index}`} className="scale-[0.7] origin-top">
                        <FaceCard rank={card} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative z-10 px-4 pb-3 flex flex-col gap-3">
        <div className="rounded-[1.5rem] border border-blue-900/40 bg-black/40 backdrop-blur-sm p-4 min-h-[260px] flex flex-col">
          <div className="flex items-center justify-between shrink-0 mb-3">
            <div>
              <div className="text-xs text-blue-400/60">本轮主题花色</div>
              <div className="flex items-center gap-2 mt-1">
                {getCardIcon(currentRank, 24)}
                <span className="text-lg font-bold text-blue-300 tracking-widest">{currentRank}</span>
              </div>
            </div>
            <div className="text-right text-xs text-blue-300/60">
              <div>当前出牌</div>
              <div className="text-sm text-blue-200">{currentActor?.name || '等待中'}</div>
            </div>
          </div>

          <div className="flex items-center justify-center flex-1 min-h-[120px]">
            {pendingPlay ? (
              <div className="flex flex-col items-center w-full">
                <div className="text-sm text-blue-200 mb-3">
                  {players.find(player => player.id === pendingPlay.actorId)?.name} 打出了 {pendingPlay.actualCards.length} 张牌
                </div>
                <div className="relative h-24 w-full flex items-center justify-center">
                  {pendingPlay.actualCards.map((card, index) => {
                    const offset = (index - (pendingPlay.actualCards.length - 1) / 2) * 18;
                    const rotation = (index - (pendingPlay.actualCards.length - 1) / 2) * 6;
                    return (
                      <div
                        key={`${card}_${index}`}
                        className="absolute transition-all duration-500"
                        style={{ transform: `translateX(${offset}px) rotate(${rotation}deg)` }}
                      >
                        {pendingPlay.revealed ? <FaceCard rank={card} /> : <CardBack />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center text-blue-300/60">
                <div className="text-sm">等待本轮出牌</div>
                <div className="text-xs mt-2">每轮都会随机主题花色与下一位行动者</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-[1.5rem] border border-blue-900/30 bg-black/35 p-4 overflow-y-auto flex flex-col gap-2 text-xs">
          {gameLog.map(entry => (
            <div key={entry.id} className={entry.isSystem ? 'text-blue-400 text-center font-bold' : 'text-blue-100/85'}>
              {entry.text}
            </div>
          ))}
          {isAiThinking && <div className="text-blue-500/60 animate-pulse text-center">角色们正在思考…</div>}
        </div>
      </div>

      <div className="relative z-10 shrink-0 bg-gradient-to-t from-[#050a0f] via-black/90 to-[#050a0f]/80 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {gameState === 'gameover' ? (
          <div className="space-y-3">
            <div className="text-center text-blue-300 font-bold">
              {winnerId ? `${players.find(player => player.id === winnerId)?.name || '某人'} 赢下了酒局。` : '酒局结束。'}
            </div>
            <button onClick={() => setGameState('setup')} className="w-full py-3 bg-blue-700 rounded-lg text-white font-bold">重新开始</button>
          </div>
        ) : showSpectatePrompt ? (
          <div className="rounded-2xl border border-blue-800/40 bg-black/60 p-4 space-y-3">
            <div className="text-center text-blue-200 font-bold">你已失去三条命</div>
            <div className="text-xs text-center text-blue-300/70">你可以继续观战，此时将看到所有人的手牌，但不能再发言。</div>
            <div className="flex gap-3">
              <button onClick={() => { setSpectating(true); setShowSpectatePrompt(false); prepareNextTurn(players, pendingPlay?.actorId); }} className="flex-1 py-3 rounded-lg bg-blue-700 text-white font-bold flex items-center justify-center gap-2"><Eye size={18} />继续观战</button>
              <button onClick={() => setGameState('setup')} className="flex-1 py-3 rounded-lg border border-blue-700 text-blue-300 font-bold flex items-center justify-center gap-2"><LogOut size={18} />退出游戏</button>
            </div>
          </div>
        ) : spectating ? (
          <div className="rounded-2xl border border-blue-800/40 bg-black/50 p-4 text-center text-blue-300 font-bold">你已出局，正在观战。此时可以看到所有人的手牌。</div>
        ) : responseStageForUser ? (
          <div className="space-y-3">
            <div className="text-center text-sm text-blue-300">你可以先发言试探，再决定是否质询 {currentActor?.name}</div>
            <div className="flex gap-3">
              <button onClick={() => resolveChallenge('user', pendingPlay!.actorId)} disabled={isAiThinking} className="flex-1 py-3 rounded-lg border border-blue-700 text-blue-300 font-bold disabled:opacity-40">质询</button>
              <button onClick={handleAcceptPlay} disabled={isAiThinking} className="flex-1 py-3 rounded-lg bg-blue-700 text-white font-bold disabled:opacity-40">认同过牌</button>
            </div>
            <form onSubmit={handleUserChat} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-black/40 border border-blue-900/50 rounded-lg px-3 py-3 text-sm text-blue-100 placeholder-blue-800 outline-none focus:border-blue-500"
                placeholder="和他们聊几句，再决定要不要质询…"
                disabled={isAiThinking}
              />
              <button type="submit" disabled={!chatInput.trim() || isAiThinking} className="px-4 bg-blue-800 text-white rounded-lg font-bold text-sm disabled:opacity-50">发送</button>
            </form>
          </div>
        ) : currentActorId === 'user' && !pendingPlay ? (
          <>
            <div className="flex justify-center gap-2 mb-4 min-h-[92px] flex-wrap">
              {userPlayer?.hand.map((card, index) => (
                <FaceCard
                  key={`user_${index}`}
                  rank={card}
                  selectable
                  selected={selectedCards.includes(index)}
                  onClick={() => toggleCardSelection(index)}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleUserPlay} disabled={selectedCards.length === 0 || isAiThinking} className="flex-1 py-3 rounded-lg bg-blue-700 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed">出牌 ({selectedCards.length})</button>
            </div>
          </>
        ) : (
          <div className="text-center text-blue-300/70 text-sm py-3">
            {currentActor?.isUser ? '请选择要出的牌。' : `${currentActor?.name || '角色'} 正在行动…`}
          </div>
        )}
      </div>
    </div>
  );
}
