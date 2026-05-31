import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store';
import { MarriageFormat, MarriageRecord } from '../../types';
import { generateAIResponse, getCharacterReply } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { generateCertificate } from './certificateGenerator';
import { ArrowLeft, Check, Undo2, X, Save } from 'lucide-react';
import { saveVideoFile, loadVideoFile } from '../../lib/db';

// ── Constants ──

const ROMANCE_KEYWORDS = ['女友', '男友', '恋人', '情侣', '爱人', '太太', '妻子', '老婆', '老公', '丈夫', '未婚妻', '未婚夫', '女朋友', '男朋友', '对象', '伴侣', '夫人', '亲爱的', 'honey', 'baby', 'sweetheart', 'lover', 'girlfriend', 'boyfriend'];
const PROPOSAL_KEYWORDS = ['marry me', '结婚吧', '嫁给我', '娶我', '求婚', '结婚', 'marry', 'propose', '愿意嫁', '愿意娶', '领证', '结婚证'];

type BureauFlow = 'main' | 'checking' | 'rejected' | 'format_select' | 'signing' | 'certificate' | 'history' | 'divorce_check' | 'divorce_format' | 'divorce_signing' | 'divorce_cert' | 'view_cert' | 'view_divorce_cert' | 'reissuing';

const bodyClass = 'font-[\'Inter\',system-ui,sans-serif]';
const headingClass = 'font-[\'Playfair_Display\',Georgia,serif]';

// ── Signature Pad Component ──

function SignaturePad({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const getCanvas = () => canvasRef.current!;
  const getCtx = () => getCanvas().getContext('2d')!;

  const saveState = useCallback(() => {
    const ctx = getCtx();
    const canvas = getCanvas();
    setUndoStack(prev => {
      const next = [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)];
      return next.slice(-10);
    });
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0] || (e as TouchEvent).changedTouches[0];
      return { x: (touch.clientX - rect.left) * (canvas.width / rect.width), y: (touch.clientY - rect.top) * (canvas.height / rect.height) };
    }
    const me = e as MouseEvent;
    return { x: (me.clientX - rect.left) * (canvas.width / rect.width), y: (me.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    saveState();
    setIsDrawing(true);
    lastPointRef.current = getPos(e);
  }, [saveState]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    const ctx = getCtx();
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (lastPointRef.current) {
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    } else {
      ctx.moveTo(pos.x, pos.y);
    }
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
    setHasDrawn(true);
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPointRef.current = null;
  }, []);

  const undo = useCallback(() => {
    const ctx = getCtx();
    const canvas = getCanvas();
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const prevState = newStack.pop()!;
      ctx.putImageData(prevState, 0, 0);
      setHasDrawn(newStack.length > 0);
      return newStack;
    });
  }, []);

  const handleSave = () => {
    const canvas = getCanvas();
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <p className={`text-xs tracking-[0.25em] uppercase ${bodyClass} text-warm-grey`}>
        请签署你的名字
      </p>
      <div className="relative w-full max-w-[500px]">
        <canvas
          ref={canvasRef}
          width={500}
          height={180}
          className="border border-charcoal/20 bg-white touch-none cursor-crosshair"
          style={{ width: '100%', height: 180, touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className={`text-warm-grey ${headingClass} italic text-lg`}>在此签名</span>
          </div>
        )}
      </div>
      <div className="flex gap-4">
        <button
          onClick={undo}
          disabled={!hasDrawn}
          className={`flex items-center gap-2 px-6 py-2.5 text-xs tracking-[0.2em] uppercase ${bodyClass} font-medium transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed border border-charcoal text-charcoal hover:bg-charcoal hover:text-alabaster`}
        >
          <Undo2 size={14} /> 撤回
        </button>
        <button
          onClick={handleSave}
          disabled={!hasDrawn}
          className={`flex items-center gap-2 px-6 py-2.5 text-xs tracking-[0.2em] uppercase ${bodyClass} font-medium transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed bg-charcoal text-alabaster hover:bg-gold`}
        >
          <Check size={14} /> 签好了
        </button>
        <button
          onClick={onCancel}
          className={`flex items-center gap-2 px-6 py-2.5 text-xs tracking-[0.2em] uppercase ${bodyClass} font-medium transition-all duration-500 border border-charcoal text-charcoal hover:bg-charcoal hover:text-alabaster`}
        >
          <X size={14} /> 取消
        </button>
      </div>
    </div>
  );
}

// ── Certificate Display Component ──

function CertificateDisplay({
  certDataUrl,
  type,
  onSave,
  onBack,
}: {
  certDataUrl: string;
  type: 'marriage' | 'divorce';
  onSave: () => void;
  onBack: () => void;
}) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `${type === 'marriage' ? '结婚证' : '离婚证'}.png`;
    link.href = certDataUrl;
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4">
      <h2 className={`text-2xl ${headingClass} text-charcoal`}>
        {type === 'marriage' ? '恭喜你们' : '已办理离婚'}
      </h2>
      <div className="w-px h-8 bg-charcoal/20" />
      <p className={`text-sm ${bodyClass} text-warm-grey text-center`}>
        {type === 'marriage' ? '你们的结婚证已生成' : '你们的离婚证已生成'}
      </p>
      <div className="w-full max-w-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-shadow duration-500">
        <img src={certDataUrl} alt={type === 'marriage' ? '结婚证' : '离婚证'} className="w-full" />
      </div>
      <div className="flex gap-4 mt-2">
        <button
          onClick={handleDownload}
          className={`flex items-center gap-2 px-7 py-3 text-xs tracking-[0.2em] uppercase ${bodyClass} font-medium transition-all duration-500 bg-charcoal text-alabaster hover:bg-gold shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]`}
        >
          <Save size={16} /> 保存图片
        </button>
        <button
          onClick={onBack}
          className={`flex items-center gap-2 px-7 py-3 text-xs tracking-[0.2em] uppercase ${bodyClass} font-medium transition-all duration-500 border border-charcoal text-charcoal hover:bg-charcoal hover:text-alabaster`}
        >
          <ArrowLeft size={16} /> 返回
        </button>
      </div>
    </div>
  );
}

// ── Legacy Reissue Detection ──
// For records saved before the `isReissue` flag existed, detect reissues
// by walking the marriage history chronologically. If a record of the same
// type appears while the character is already in that state (married/divorced),
// it must be a reissue rather than a real first-time event.
function getRecordLabel(record: MarriageRecord, allRecords: MarriageRecord[]): string {
  if (record.isReissue) {
    return record.type === 'marriage' ? '补办结婚证' : '补办离婚证';
  }
  // Legacy heuristic: walk records in order tracking relationship state
  const sorted = [...allRecords].sort((a, b) => a.issuedAt - b.issuedAt);
  let married = false;
  let divorced = false;
  for (const r of sorted) {
    if (r.id === record.id) {
      if (record.type === 'marriage') {
        if (married) return '补办结婚证';
        return '结婚';
      }
      if (record.type === 'divorce') {
        if (divorced) return '补办离婚证';
        return '离婚';
      }
    }
    if (r.type === 'marriage') { married = true; divorced = false; }
    if (r.type === 'divorce') { divorced = true; married = false; }
  }
  return record.type === 'marriage' ? '结婚' : '离婚';
}

// ── Main Component ──

export default function MarriageBureau() {
  const { characters, chats, characterMemoryBank, emotionEvents, addMarriageRecord, addActivityLog, updateCharacter, coupleDiaries, updateCoupleDiary, receiveMessage, worldSettings, activeWorldSettingId, updateWorldSetting, setNotification } = useAppStore();

  const [flow, setFlow] = useState<BureauFlow>('main');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{ canMarry: boolean; reason: string } | null>(null);
  const [format, setFormat] = useState<MarriageFormat>('chinese');
  const [userSignData, setUserSignData] = useState<string | null>(null);
  const [certDataUrl, setCertDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedChar, setExpandedChar] = useState<string | null>(null);
  const [viewCertDataUrl, setViewCertDataUrl] = useState<string | null>(null);
  const [viewCertLoading, setViewCertLoading] = useState(false);
  const [viewCertError, setViewCertError] = useState<string | null>(null);
  const [reissueMode, setReissueMode] = useState<'marriage' | 'divorce' | null>(null);

  // ── Derived ──

  const lovers = Object.values(characters).filter(char => {
    if (char.isDisabled || char.isWeChatFriend === false) return false;
    if (char.relationshipStatus === 'dating' || char.relationshipStatus === 'engaged' || char.relationshipStatus === 'married') return true;
    const rel = (char.relationship || '').toLowerCase();
    return ROMANCE_KEYWORDS.some(k => rel.includes(k));
  });

  const selectedChar = selectedCharId ? characters[selectedCharId] : null;

  // ── Check Proposal in Chat History ──

  const checkProposal = useCallback(async (charId: string): Promise<{ found: boolean; message?: string }> => {
    const char = characters[charId];
    if (!char) return { found: false };

    if (char.proposalStatus === 'accepted') {
      return { found: true, message: char.proposalMessage };
    }

    const chat = chats[charId] || [];
    const proposalMsgs = chat.filter(m =>
      m.senderId === 'user' && PROPOSAL_KEYWORDS.some(k => m.text.toLowerCase().includes(k))
    );

    if (proposalMsgs.length === 0) return { found: false };
    const lastProposal = proposalMsgs[proposalMsgs.length - 1];

    updateCharacter(charId, {
      proposalStatus: 'pending',
      proposalMessage: lastProposal.text,
      proposalTimestamp: lastProposal.timestamp,
    });

    return { found: true, message: lastProposal.text };
  }, [characters, chats, updateCharacter]);

  // ── AI Check Marriage Condition ──

  const checkMarriageCondition = useCallback(async (charId: string): Promise<{ canMarry: boolean; reason: string }> => {
    const char = characters[charId];
    if (!char) return { canMarry: false, reason: '角色不存在' };

    const isRomantic = lovers.some(l => l.id === charId);
    if (!isRomantic) {
      return { canMarry: false, reason: '你们不是情侣关系，无法领取结婚证' };
    }

    const proposal = await checkProposal(charId);
    if (!proposal.found) {
      return { canMarry: false, reason: '你还没有在微信上向TA求婚，先表达你的心意吧' };
    }

    const memories = characterMemoryBank[charId] || [];
    const recentEvents = (emotionEvents || [])
      .filter(e => e.characterId === charId)
      .slice(-20);

    const conflictMemories = memories.filter(m =>
      m.tags.some(t => ['吵架', '分手', '矛盾', '冲突', '生气', '争吵'].includes(t)) ||
      m.summary.includes('吵架') || m.summary.includes('分手') || m.summary.includes('矛盾')
    );

    let avgValence = 0.5;
    if (recentEvents.length > 0) {
      avgValence = recentEvents.reduce((sum, e) => sum + e.valence, 0) / recentEvents.length;
    }

    const memoryContext = memories.slice(0, 15).map(m => `[${m.type}] ${m.summary}（重要度:${m.importance}，正面度:${m.valence.toFixed(1)}）`).join('\n');
    const eventContext = recentEvents.slice(0, 10).map(e =>
      `${new Date(e.timestamp).toLocaleDateString()} - ${e.word} (正面度:${e.valence.toFixed(1)}, 激动度:${e.arousal.toFixed(1)})`
    ).join('\n');
    const conflictContext = conflictMemories.slice(0, 5).map(m => `- ${m.summary}（${m.importance}/10）`).join('\n');

    try {
      const result = await generateAIResponse(
        `你是一个婚姻匹配系统，需要判断角色是否愿意和用户结婚。

角色：${char.name}
性格：${char.personality}
当前好感度：${char.affection ?? 50}/100

## 近期情绪事件
${eventContext || '无明显情绪事件'}

## 相关记忆
${memoryContext || '无明显相关记忆'}

## 冲突记录
${conflictContext || '无明显冲突'}

## 要求
综合分析：
1. 角色长期情绪是否积极（近期的开心/难过情况）
2. 是否有严重矛盾或吵架
3. 好感度是否足够
4. 对未来恋爱是否有希望和期待

如果角色整体情绪积极、没有严重矛盾、好感度足够、对未来恋爱有希望，返回 JSON：
{"canMarry": true, "reason": "角色同意的原因，用角色的语气说一句暖心的话"}

如果角色情绪不好、最近有严重矛盾或吵架、好感度很低、对未来没有信心，返回 JSON：
{"canMarry": false, "reason": "角色不同意的原因，用角色的语气说一句委婉拒绝的话"}

只返回 JSON，不要其他内容。`
      );

      const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
      if (parsed.canMarry) {
        updateCharacter(charId, { proposalStatus: 'accepted', relationshipStatus: 'engaged' });
      }
      return parsed;
    } catch {
      const hasConflict = conflictMemories.some(m => m.importance >= 7);
      const moodGood = avgValence > 0.4;
      const affectionOk = (char.affection ?? 50) >= 40;

      if (!affectionOk) {
        return { canMarry: false, reason: `${char.name}觉得你们的关系还没到那一步，再相处一段时间吧` };
      }
      if (hasConflict && !moodGood) {
        return { canMarry: false, reason: `${char.name}觉得最近你们之间有些问题还没解决` };
      }

      updateCharacter(charId, { proposalStatus: 'accepted', relationshipStatus: 'engaged' });
      return { canMarry: true, reason: `${char.name}微笑着点了点头，说："我愿意。"` };
    }
  }, [characters, lovers, checkProposal, characterMemoryBank, emotionEvents, updateCharacter]);

  // ── AI Check Divorce Condition ──

  const checkDivorceCondition = useCallback(async (charId: string): Promise<{ canDivorce: boolean; reason: string }> => {
    const char = characters[charId];
    if (!char) return { canDivorce: false, reason: '角色不存在' };
    if (char.relationshipStatus !== 'married') {
      return { canDivorce: false, reason: '你们还没有结婚，无法办理离婚' };
    }

    const memories = characterMemoryBank[charId] || [];
    const recentEvents = (emotionEvents || [])
      .filter(e => e.characterId === charId)
      .slice(-20);

    let avgValence = 0.5;
    if (recentEvents.length > 0) {
      avgValence = recentEvents.reduce((sum, e) => sum + e.valence, 0) / recentEvents.length;
    }

    const memoryContext = memories.slice(0, 15).map(m => `[${m.type}] ${m.summary}（重要度:${m.importance}，正面度:${m.valence.toFixed(1)}）`).join('\n');
    const eventContext = recentEvents.slice(0, 10).map(e =>
      `${new Date(e.timestamp).toLocaleDateString()} - ${e.word} (正面度:${e.valence.toFixed(1)}, 激动度:${e.arousal.toFixed(1)})`
    ).join('\n');

    try {
      const result = await generateAIResponse(
        `你是一个婚姻匹配系统，需要判断角色是否同意离婚。

角色：${char.name}
性格：${char.personality}
当前好感度：${char.affection ?? 50}/100

## 近期情绪事件
${eventContext || '无明显情绪事件'}

## 相关记忆
${memoryContext || '无明显相关记忆'}

## 要求
综合分析：
1. 如果感情已经破裂、经常吵架、好感度很低 → 同意离婚
2. 如果感情还好、没有严重矛盾 → 可能不同意离婚
3. 如果角色还爱着用户 → 不同意离婚

返回 JSON：
{"canDivorce": true/false, "reason": "角色的回应，用角色的语气说一句话"}

只返回 JSON，不要其他内容。`
      );

      const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
      return parsed;
    } catch {
      return {
        canDivorce: avgValence < 0.3,
        reason: avgValence < 0.3
          ? `${char.name}叹了口气，"好吧，也许分开对大家都好。"`
          : `${char.name}摇了摇头，"我不想离婚。"`
      };
    }
  }, [characters, characterMemoryBank, emotionEvents]);

  // ── Generate Certificate ──

  const generateCert = useCallback(async () => {
    if (!selectedChar || !userSignData) return;
    setLoading(true);
    try {
      const dateStr = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

      const userName = useAppStore.getState().settings.persona.name || useAppStore.getState().settings.wechatName || '我';
      const certType = flow === 'divorce_cert' ? 'divorce' as const : 'marriage' as const;

      const sigText = selectedChar.signatureName || selectedChar.name;
      const isEnglishSig = /^[A-Za-z\s.]+$/.test(sigText);

      const displayName = selectedChar.signatureName || selectedChar.name;

      const fmtDate = (d: string | undefined) => {
        if (!d) return '未知';
        const parts = d.split('-');
        if (parts.length !== 3) return d;
        return `${parseInt(parts[0])}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
      };
      const characterBirthDate = fmtDate(selectedChar.birthDate);
      const userBirthDate = fmtDate(useAppStore.getState().settings.persona.birthDate);

      const url = await generateCertificate(
        format,
        certType,
        userName,
        displayName,
        userSignData,
        sigText,
        isEnglishSig,
        dateStr,
        userBirthDate,
        characterBirthDate,
      );
      setCertDataUrl(url);
    } catch (err) {
      console.error('Certificate generation error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedChar, userSignData, format, flow]);

  useEffect(() => {
    if ((flow === 'certificate' || flow === 'divorce_cert') && !certDataUrl && userSignData) {
      generateCert();
    }
  }, [flow, certDataUrl, userSignData, generateCert]);

  // Cleanup object URL when leaving view_cert flow
  useEffect(() => {
    if (flow !== 'view_cert' && flow !== 'view_divorce_cert') {
      if (viewCertDataUrl) URL.revokeObjectURL(viewCertDataUrl);
      setViewCertDataUrl(null);
      setViewCertError(null);
    }
  }, [flow, viewCertDataUrl]);

  // Reset reissue mode when returning to main
  useEffect(() => {
    if (flow === 'main') {
      setReissueMode(null);
    }
  }, [flow]);

  // ── Step: Start Marriage Flow ──

  const handleStartMarriage = async (charId: string) => {
    setSelectedCharId(charId);
    setFlow('checking');
    setLoading(true);
    setCheckResult(null);

    const char = characters[charId];
    if (char?.relationshipStatus === 'married') {
      setCheckResult({ canMarry: false, reason: '你们已经结婚了，不能再领一次结婚证' });
      setFlow('rejected');
      setLoading(false);
      return;
    }

    const result = await checkMarriageCondition(charId);
    setCheckResult(result);
    setFlow(result.canMarry ? 'format_select' : 'rejected');
    setLoading(false);
  };

  // ── Step: Start Divorce Flow ──

  const handleStartDivorce = async (charId: string) => {
    setSelectedCharId(charId);
    setFlow('divorce_check');
    setLoading(true);

    const result = await checkDivorceCondition(charId);
    setCheckResult(result);
    setFlow(result.canDivorce ? 'divorce_format' : 'rejected');
    setLoading(false);
  };

  // ── Step: Select Format → Signing ──

  const handleFormatSelect = (fmt: MarriageFormat) => {
    setFormat(fmt);
    setFlow(flow === 'divorce_format' ? 'divorce_signing' : 'signing');
    setUserSignData(null);
  };

  // ── Step: Signature Save → Certificate ──

  const handleSignSave = (dataUrl: string) => {
    setUserSignData(dataUrl);
    if (flow === 'signing') {
      setFlow('certificate');
      setCertDataUrl(null);
    } else if (flow === 'divorce_signing') {
      setFlow('divorce_cert');
      setCertDataUrl(null);
    }
  };

  // ── Step: Save Record ──

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const raw = atob(parts[1]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const handleRecordMarriage = async () => {
    if (!selectedCharId || !certDataUrl) return;
    const isReissue = reissueMode === 'marriage';
    const certDbKey = `marriage_cert_${Date.now()}`;
    try { await saveVideoFile(certDbKey, dataUrlToBlob(certDataUrl)); } catch {}
    addMarriageRecord(selectedCharId, {
      characterId: selectedCharId,
      type: 'marriage',
      format,
      certDbKey,
      isReissue,
    });
    if (!isReissue) {
      // Auto-update world book relationship (only for first marriage)
      try {
        const activeWs = worldSettings.find(ws => ws.id === activeWorldSettingId);
        if (activeWs) {
          updateWorldSetting(activeWs.id, {
            characters: activeWs.characters.map(card =>
              card.id === selectedCharId ? { ...card, relationship: '夫妻' } : card
            )
          });
        }
      } catch {}
    }
    saveInteractionMemory(
      selectedCharId,
      isReissue
        ? `补办了${characters[selectedCharId]?.name || selectedCharId}的结婚证`
        : `和${characters[selectedCharId]?.name || selectedCharId}领取了结婚证（${format === 'us' ? '美国格式' : '中国格式'}）`,
      undefined,
      'event',
      8,
    );
    useAppStore.getState().addEmotionEvent({
      characterId: selectedCharId,
      paDelta: isReissue ? 0 : 0.4,
      naDelta: isReissue ? 0 : -0.15,
      word: isReissue ? '平静' : '幸福',
      valence: isReissue ? 0 : 0.7,
      arousal: isReissue ? 0.1 : 0.6,
      matchSource: 'free_form',
      source: 'manual',
    });
    addActivityLog({
      id: Date.now().toString(),
      title: isReissue ? '补办结婚证' : '领取结婚证',
      detail: isReissue
        ? `补办与${characters[selectedCharId]?.name || selectedCharId}的结婚证`
        : `与${characters[selectedCharId]?.name || selectedCharId}领取了结婚证`,
      timestamp: Date.now(),
      relatedCharacterIds: [selectedCharId],
    });
    // Auto-add marriage anniversary reminder to Couple Diary (only for first marriage)
    if (!isReissue) {
      try {
        const diary = (coupleDiaries || []).find(d => d.partnerId === selectedCharId);
        if (diary) {
          const today = new Date();
          const marriageReminder = {
            id: `marriage_${Date.now()}`,
            type: 'holiday' as const,
            name: '结婚纪念日',
            days: [0],
            notifyBefore: 3,
            enabled: true,
            month: today.getMonth() + 1,
            day: today.getDate(),
          };
          updateCoupleDiary(diary.id, {
            reminders: [...(diary.reminders || []), marriageReminder]
          });
        }
      } catch {}
    }
    setFlow('main');
  };

  const handleRecordDivorce = async () => {
    if (!selectedCharId || !certDataUrl) return;
    const isReissue = reissueMode === 'divorce';
    const certDbKey = `divorce_cert_${Date.now()}`;
    try { await saveVideoFile(certDbKey, dataUrlToBlob(certDataUrl)); } catch {}
    addMarriageRecord(selectedCharId, {
      characterId: selectedCharId,
      type: 'divorce',
      format,
      certDbKey,
      isReissue,
    });
    if (!isReissue) {
      // Auto-update world book relationship (only for first divorce)
      try {
        const activeWs = worldSettings.find(ws => ws.id === activeWorldSettingId);
        if (activeWs) {
          updateWorldSetting(activeWs.id, {
            characters: activeWs.characters.map(card =>
              card.id === selectedCharId ? { ...card, relationship: '前妻' } : card
            )
          });
        }
      } catch {}
    }
    saveInteractionMemory(
      selectedCharId,
      isReissue
        ? `补办了${characters[selectedCharId]?.name || selectedCharId}的离婚证`
        : `和${characters[selectedCharId]?.name || selectedCharId}办理了离婚证（${format === 'us' ? '美国格式' : '中国格式'}）`,
      undefined,
      'event',
      8,
    );
    useAppStore.getState().addEmotionEvent({
      characterId: selectedCharId,
      paDelta: isReissue ? 0 : -0.35,
      naDelta: isReissue ? 0 : 0.45,
      word: '悲伤',
      valence: -0.5,
      arousal: 0.3,
      matchSource: 'free_form',
      source: 'manual',
    });
    addActivityLog({
      id: Date.now().toString(),
      title: isReissue ? '补办离婚证' : '办理离婚证',
      detail: isReissue
        ? `补办与${characters[selectedCharId]?.name || selectedCharId}的离婚证`
        : `与${characters[selectedCharId]?.name || selectedCharId}办理了离婚证`,
      timestamp: Date.now(),
      relatedCharacterIds: [selectedCharId],
    });
    setFlow('main');
  };

  // ── Re-issue (补办) ──

  const handleReissue = async (charId: string, type: 'marriage' | 'divorce') => {
    const char = characters[charId];
    if (!char) return;

    setReissueMode(type);
    setFlow('reissuing');
    const label = type === 'marriage' ? '结婚证' : '离婚证';

    let msgs: string[];
    try {
      const reply = await getCharacterReply(
        charId,
        `（场景：我们之前办理的${label}找不到了）请主动给我发几条消息，提议一起去补办${label}，语气要符合你的性格和我们的关系。不要用括号动作描写，直接说话。`,
      );
      const parts = reply.split('\n').filter(m => m.trim().length > 0);
      msgs = parts.slice(0, 3);
      if (msgs.length < 1) throw new Error('empty AI reply');
    } catch {
      // Fallback to pre-written messages
      msgs = type === 'marriage'
        ? ['亲爱的，我们的结婚证好像找不到了😅', '要不要一起去民政局补办一个？', '正好也可以再拍张合照~']
        : ['那个...离婚证好像弄丢了', '虽然有点尴尬，但能不能陪我去补办一下？', '麻烦你了...'];
    }

    msgs.forEach((text, i) => {
      setTimeout(() => {
        receiveMessage(charId, text);
      }, i * 2000);
    });
    setNotification({
      id: Date.now(),
      characterId: charId,
      text: msgs[0],
      sourceApp: 'wechat',
      openApp: 'wechat',
    });
    setSelectedCharId(charId);
    setFormat('chinese');
    setUserSignData(null);
    setCertDataUrl(null);
    setFlow(type === 'marriage' ? 'format_select' : 'divorce_format');
  };

  // ── View Saved Certificate ──

  const handleViewCert = async (charId: string, type: 'marriage' | 'divorce') => {
    const char = characters[charId];
    const records = (char.marriageHistory || []).filter(r => r.type === type);
    const record = records[records.length - 1];
    if (!record?.certDbKey) {
      setViewCertError('该记录没有关联的证书文件');
      setFlow(type === 'marriage' ? 'view_cert' : 'view_divorce_cert');
      return;
    }
    setViewCertLoading(true);
    setViewCertError(null);
    setFlow(type === 'marriage' ? 'view_cert' : 'view_divorce_cert');
    try {
      const blob = await loadVideoFile(record.certDbKey);
      if (blob) {
        setViewCertDataUrl(URL.createObjectURL(blob));
      } else {
        setViewCertError('证书文件已丢失，请重新办理');
      }
    } catch {
      setViewCertError('加载证书失败');
    }
    setViewCertLoading(false);
  };

  const handleViewRecord = async (record: MarriageRecord) => {
    if (!record.certDbKey) {
      setViewCertError('该记录没有关联的证书文件');
      setFlow(record.type === 'marriage' ? 'view_cert' : 'view_divorce_cert');
      return;
    }
    setViewCertLoading(true);
    setViewCertError(null);
    setFlow(record.type === 'marriage' ? 'view_cert' : 'view_divorce_cert');
    try {
      const blob = await loadVideoFile(record.certDbKey);
      if (blob) {
        setViewCertDataUrl(URL.createObjectURL(blob));
      } else {
        setViewCertError('证书文件已丢失，请重新办理');
      }
    } catch {
      setViewCertError('加载证书失败');
    }
    setViewCertLoading(false);
  };

  // ── Render ──

  const renderHeader = (title: string) => (
    <div className="flex items-center gap-3 py-4 px-5 border-b border-charcoal/10">
      <button onClick={() => setFlow('main')} className="text-warm-grey hover:text-charcoal transition-colors duration-500">
        <ArrowLeft size={20} />
      </button>
      <h2 className={`text-base tracking-tight ${headingClass} text-charcoal font-normal`}>{title}</h2>
    </div>
  );

  // ── Main Screen ──

  if (flow === 'main') {
    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader('婚姻登记处')}

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">

          {/* Action buttons for each lover character */}
          <div className="space-y-5">
            {lovers.map(char => {
              const isMarried = char.relationshipStatus === 'married';
              const isDivorced = char.relationshipStatus === 'divorced';
              const isEngaged = char.relationshipStatus === 'engaged';

              let statusLabel = '恋爱中';
              if (isMarried) statusLabel = '已婚';
              else if (isDivorced) statusLabel = '已离婚';
              else if (isEngaged) statusLabel = '已订婚';

              return (
                <div key={char.id} className="border-t border-charcoal/10 pt-5 space-y-4 transition-all duration-500 hover:border-gold/30 group">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 flex items-center justify-center text-white text-sm font-medium transition-all duration-[1500ms] group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
                      style={{ background: char.avatar.startsWith('#') ? char.avatar : '#1A1A1A' }}
                    >
                      {char.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-base ${headingClass} text-charcoal`}>{char.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[11px] tracking-[0.15em] uppercase ${bodyClass} text-warm-grey`}>
                          {char.relationship}
                        </span>
                        <span className="w-px h-3 bg-charcoal/15" />
                        <span className={`text-[11px] tracking-[0.15em] uppercase ${bodyClass} ${isMarried ? 'text-gold' : 'text-warm-grey'}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    {(char.marriageHistory || []).length > 0 && (
                      <button
                        onClick={() => setExpandedChar(expandedChar === char.id ? null : char.id)}
                        className={`text-warm-grey hover:text-charcoal text-[11px] tracking-[0.2em] uppercase ${bodyClass} transition-all duration-500`}
                      >
                        {expandedChar === char.id ? '收起' : '记录'}
                      </button>
                    )}
                  </div>

                  {/* Marriage history */}
                  {expandedChar === char.id && (char.marriageHistory || []).length > 0 && (
                    <div className="pl-16 space-y-2">
                      {(char.marriageHistory || []).map(rec => (
                        <div key={rec.id} className="flex items-center gap-2">
                          <span className={`text-xs ${bodyClass} ${rec.type === 'marriage' ? 'text-gold' : 'text-warm-grey'}`}>
                            {getRecordLabel(rec, char.marriageHistory || [])}
                          </span>
                          <span className="text-[10px] text-charcoal/25">/</span>
                          <span className={`text-[11px] ${bodyClass} text-warm-grey`}>
                            {new Date(rec.issuedAt).toLocaleDateString('zh-CN')}
                          </span>
                          <span className="text-[10px] text-charcoal/25">/</span>
                          <span className={`text-[10px] ${bodyClass} text-charcoal/25`}>
                            {rec.format === 'us' ? '美国格式' : '中国格式'}
                          </span>
                          {rec.certDbKey && (
                            <button
                              onClick={() => handleViewRecord(rec)}
                              className="ml-auto text-[10px] tracking-[0.15em] uppercase text-gold hover:text-charcoal transition-colors duration-500 font-medium"
                            >
                              查看
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleStartMarriage(char.id)}
                      disabled={isMarried}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all duration-500 ${
                        isMarried
                          ? 'bg-taupe text-warm-grey cursor-not-allowed opacity-50'
                          : 'bg-charcoal text-alabaster hover:bg-gold'
                      } ${bodyClass}`}
                    >
                      {isMarried ? '已婚' : '领取结婚证'}
                    </button>
                    <button
                      onClick={() => handleStartDivorce(char.id)}
                      disabled={!isMarried}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all duration-500 border ${
                        !isMarried
                          ? 'border-charcoal/10 text-warm-grey cursor-not-allowed opacity-40'
                          : 'border-charcoal text-charcoal hover:bg-charcoal hover:text-alabaster'
                      } ${bodyClass}`}
                    >
                      {!isMarried ? '未结婚' : '办理离婚证'}
                    </button>
                  </div>

                  {/* View saved certificate */}
                  {(char.marriageHistory || []).some(r => r.certDbKey) && (
                    <div className="flex gap-3">
                      {(char.marriageHistory || []).filter(r => r.certDbKey && r.type === 'marriage').length > 0 && (
                        <button
                          onClick={() => handleViewCert(char.id, 'marriage')}
                          disabled={viewCertLoading}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs tracking-[0.15em] uppercase font-medium transition-all duration-500 border border-charcoal/20 text-warm-grey hover:text-gold hover:border-gold/30 ${bodyClass}`}
                        >
                          查看结婚证
                        </button>
                      )}
                      {(char.marriageHistory || []).filter(r => r.certDbKey && r.type === 'divorce').length > 0 && (
                        <button
                          onClick={() => handleViewCert(char.id, 'divorce')}
                          disabled={viewCertLoading}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs tracking-[0.15em] uppercase font-medium transition-all duration-500 border border-charcoal/20 text-warm-grey hover:text-charcoal hover:border-charcoal/50 ${bodyClass}`}
                        >
                          查看离婚证
                        </button>
                      )}
                    </div>
                  )}

                  {/* Re-issue certificate */}
                  {(isMarried || isDivorced) && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleReissue(char.id, isMarried ? 'marriage' : 'divorce')}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs tracking-[0.15em] uppercase font-medium transition-all duration-500 border border-charcoal/10 text-warm-grey hover:text-charcoal hover:border-charcoal/30 bg-transparent/50 hover:bg-charcoal/5 ${bodyClass}"
                      >
                        <Undo2 size={14} /> 补办{isMarried ? '结婚证' : '离婚证'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {lovers.length === 0 && (
              <div className="py-20 text-center border-t border-charcoal/10">
                <div className={`text-7xl ${headingClass} text-charcoal/5 mb-4 leading-none`}>O</div>
                <p className={`text-sm ${bodyClass} text-warm-grey`}>还没有恋爱中的角色</p>
                <p className={`text-xs ${bodyClass} text-charcoal/30 mt-2`}>先和角色成为情侣，再来领取结婚证</p>
              </div>
            )}
          </div>

          {/* Marriage history overview */}
          {Object.values(characters).some(c => (c.marriageHistory || []).length > 0) && (
            <button
              onClick={() => setFlow('history')}
              className={`w-full flex items-center justify-center gap-2 py-3 text-xs tracking-[0.2em] uppercase font-medium text-warm-grey hover:text-gold transition-all duration-500 border border-charcoal/10 hover:border-gold/30 ${bodyClass}`}
            >
              查看婚姻记录
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Reissuing (AI generating messages) ──

  if (flow === 'reissuing') {
    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader('补办中')}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="w-px h-12 bg-gold/40" />
            <p className={`text-sm ${bodyClass} text-warm-grey text-center tracking-wider`}>
              角色正在给你发消息...
            </p>
            <div className="w-px h-12 bg-charcoal/10" />
          </div>
        </div>
      </div>
    );
  }

  // ── Checking / Loading ──

  if (flow === 'checking' || flow === 'divorce_check') {
    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader(flow === 'checking' ? '审核中' : '离婚审核')}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="w-px h-12 bg-gold/40" />
            <p className={`text-sm ${bodyClass} text-warm-grey text-center tracking-wider`}>
              {flow === 'checking'
                ? '正在综合评估你们的关系状况'
                : '正在评估你们的婚姻状况'}
            </p>
            <p className={`text-[10px] ${bodyClass} text-charcoal/20 tracking-[0.3em] uppercase`}>
              请稍候
            </p>
            <div className="w-px h-12 bg-charcoal/10" />
          </div>
        </div>
      </div>
    );
  }

  // ── Rejected ──

  if (flow === 'rejected') {
    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader('无法办理')}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className={`text-5xl ${headingClass} text-charcoal/10 leading-none`}>&mdash;</div>
          <p className={`text-base ${headingClass} text-charcoal text-center leading-relaxed max-w-xs`}>
            {checkResult?.reason || '条件不满足'}
          </p>
          <div className="w-px h-6 bg-charcoal/15" />
          <button
            onClick={() => setFlow('main')}
            className={`px-8 py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all duration-500 border border-charcoal text-charcoal hover:bg-charcoal hover:text-alabaster ${bodyClass}`}
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  // ── Format Selection ──

  if (flow === 'format_select' || flow === 'divorce_format') {
    const isDivorce = flow === 'divorce_format';
    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader(isDivorce ? '选择格式' : '选择格式')}
        <div className="flex-1 px-6 py-10 flex flex-col gap-8 items-center justify-center">
          <div className="text-center space-y-2">
            <p className={`text-sm ${bodyClass} text-warm-grey tracking-wider`}>
              {selectedChar?.name} 同意了
            </p>
            <div className="w-px h-6 bg-gold/30 mx-auto" />
            <p className={`text-xs ${bodyClass} text-charcoal/30 tracking-[0.2em] uppercase`}>
              请选择证书格式
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 w-full max-w-sm">
            {/* Chinese Format */}
            <button
              onClick={() => handleFormatSelect('chinese')}
              className="flex flex-col items-center gap-4 px-6 py-10 border border-charcoal/20 transition-all duration-500 hover:border-gold hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] group"
            >
              <div className={`text-4xl ${headingClass} text-charcoal/15 group-hover:text-gold/40 transition-colors duration-500`}>喜</div>
              <div className={`text-sm tracking-[0.2em] uppercase font-medium text-charcoal ${bodyClass}`}>中国格式</div>
              <div className={`text-[10px] ${bodyClass} text-warm-grey text-center tracking-wider`}>红色经典中式</div>
            </button>

            {/* US Format */}
            <button
              onClick={() => handleFormatSelect('us')}
              className="flex flex-col items-center gap-4 px-6 py-10 border border-charcoal/20 transition-all duration-500 hover:border-gold hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] group"
            >
              <div className={`text-4xl ${headingClass} text-charcoal/15 group-hover:text-gold/40 transition-colors duration-500`}>W</div>
              <div className={`text-sm tracking-[0.2em] uppercase font-medium text-charcoal ${bodyClass}`}>美国格式</div>
              <div className={`text-[10px] ${bodyClass} text-warm-grey text-center tracking-wider`}>典雅西式</div>
            </button>
          </div>

          <button
            onClick={() => setFlow('main')}
            className={`text-[11px] tracking-[0.2em] uppercase text-warm-grey hover:text-charcoal transition-colors duration-500 underline underline-offset-4 decoration-charcoal/20 hover:decoration-gold/50 ${bodyClass}`}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  // ── Signing ──

  if (flow === 'signing' || flow === 'divorce_signing') {
    const isDivorce = flow === 'divorce_signing';
    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader(isDivorce ? '签署离婚证' : '签署结婚证')}
        <div className="flex-1 px-5 py-8 flex flex-col items-center justify-center gap-8">
          <SignaturePad
            onSave={handleSignSave}
            onCancel={() => setFlow('format_select')}
          />
          {userSignData && (
            <div className={`flex items-center gap-2 text-xs ${bodyClass} text-gold`}>
              <Check size={14} />
              签名已确认，正在生成证书
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Certificate Display ──

  if (flow === 'certificate') {
    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader('结婚证')}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-6">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-pulse flex flex-col items-center gap-3">
                <div className="w-px h-10 bg-gold/30" />
                <p className={`text-sm ${bodyClass} text-warm-grey tracking-wider`}>正在生成结婚证</p>
              </div>
            </div>
          ) : certDataUrl ? (
            <div className="flex flex-col items-center gap-6 w-full max-w-md">
              <CertificateDisplay
                certDataUrl={certDataUrl}
                type="marriage"
                onSave={() => {}}
                onBack={() => setFlow('main')}
              />
              <div className="w-px h-6 bg-charcoal/10" />
              <button
                onClick={handleRecordMarriage}
                className={`px-8 py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all duration-500 bg-gold text-white hover:bg-charcoal shadow-[0_4px_16px_rgba(0,0,0,0.15)] ${bodyClass}`}
              >
                保存并返回
              </button>
            </div>
          ) : (
            <p className={`text-sm ${bodyClass} text-warm-grey`}>生成失败，请重试</p>
          )}
        </div>
      </div>
    );
  }

  // ── Divorce Certificate ──

  if (flow === 'divorce_cert') {
    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader('离婚证')}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-6">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-pulse flex flex-col items-center gap-3">
                <div className="w-px h-10 bg-charcoal/20" />
                <p className={`text-sm ${bodyClass} text-warm-grey tracking-wider`}>正在生成离婚证</p>
              </div>
            </div>
          ) : certDataUrl ? (
            <div className="flex flex-col items-center gap-6 w-full max-w-md">
              <CertificateDisplay
                certDataUrl={certDataUrl}
                type="divorce"
                onSave={() => {}}
                onBack={() => setFlow('main')}
              />
              <div className="w-px h-6 bg-charcoal/10" />
              <button
                onClick={handleRecordDivorce}
                className={`px-8 py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all duration-500 border border-charcoal text-charcoal hover:bg-charcoal hover:text-alabaster ${bodyClass}`}
              >
                确认并返回
              </button>
            </div>
          ) : (
            <p className={`text-sm ${bodyClass} text-warm-grey`}>生成失败，请重试</p>
          )}
        </div>
      </div>
    );
  }

  // ── View Saved Certificate ──

  if (flow === 'view_cert' || flow === 'view_divorce_cert') {
    const isDivorce = flow === 'view_divorce_cert';
    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader(isDivorce ? '离婚证' : '结婚证')}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-6">
          {viewCertLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-pulse flex flex-col items-center gap-3">
                <div className="w-px h-10 bg-gold/30" />
                <p className={`text-sm ${bodyClass} text-warm-grey tracking-wider`}>加载中</p>
              </div>
            </div>
          ) : viewCertDataUrl ? (
            <div className="flex flex-col items-center gap-6 w-full max-w-md">
              <CertificateDisplay
                certDataUrl={viewCertDataUrl}
                type={isDivorce ? 'divorce' : 'marriage'}
                onSave={() => {}}
                onBack={() => { setFlow('main'); setViewCertDataUrl(null); setViewCertError(null); }}
              />
            </div>
          ) : viewCertError ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-px h-8 bg-charcoal/15" />
              <p className={`text-sm ${bodyClass} text-warm-grey text-center`}>{viewCertError}</p>
              <button
                onClick={() => { setFlow('main'); setViewCertError(null); }}
                className={`mt-2 px-6 py-2 text-xs tracking-[0.15em] uppercase font-medium transition-all duration-500 border border-charcoal/30 text-warm-grey hover:border-gold hover:text-gold ${bodyClass}`}
              >
                返回
              </button>
            </div>
          ) : (
            <p className={`text-sm ${bodyClass} text-warm-grey`}>无法加载证书</p>
          )}
        </div>
      </div>
    );
  }

  // ── History ──

  if (flow === 'history') {
    const allRecords: { charName: string; marriageHistory: MarriageRecord[]; record: MarriageRecord }[] = [];
    for (const char of Object.values(characters)) {
      if (char.marriageHistory) {
        for (const rec of char.marriageHistory) {
          allRecords.push({ charName: char.name, marriageHistory: char.marriageHistory, record: rec });
        }
      }
    }
    allRecords.sort((a, b) => b.record.issuedAt - a.record.issuedAt);

    return (
      <div className="h-full flex flex-col bg-alabaster pt-7">
        {renderHeader('婚姻记录')}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {allRecords.length === 0 ? (
            <div className="text-center py-20">
              <p className={`text-sm ${bodyClass} text-warm-grey`}>暂无婚姻记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allRecords.map(({ charName, marriageHistory, record }) => (
                <div key={record.id} className="border-t border-charcoal/10 pt-4 space-y-1">
                  <div className="flex items-center gap-3">
                    <div className={`text-xs tracking-[0.2em] uppercase font-medium ${record.type === 'marriage' ? 'text-gold' : 'text-warm-grey'} ${bodyClass}`}>
                      {getRecordLabel(record, marriageHistory)}
                    </div>
                    <span className="w-px h-3 bg-charcoal/15" />
                    <span className={`text-sm ${headingClass} text-charcoal`}>{charName}</span>
                    {record.certDbKey && (
                      <button
                        onClick={() => handleViewRecord(record)}
                        className="ml-auto text-[10px] tracking-[0.15em] uppercase text-gold hover:text-charcoal transition-colors duration-500 font-medium"
                      >
                        查看证件
                      </button>
                    )}
                  </div>
                  <div className={`text-[11px] ${bodyClass} text-warm-grey tracking-wider`}>
                    {new Date(record.issuedAt).toLocaleDateString('zh-CN', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                  <div className={`text-[10px] ${bodyClass} text-charcoal/25 tracking-wider`}>
                    格式：{record.format === 'us' ? '美国格式' : '中国格式'}
                    {record.endedAt && ` · 结束：${new Date(record.endedAt).toLocaleDateString('zh-CN')}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
