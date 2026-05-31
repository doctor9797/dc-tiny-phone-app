import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store';
import { getCharacterReply, textToSpeech, speechToText, translateText } from '../../lib/ai';
import { Mic, MicOff, Volume2, PhoneOff, Send, Phone, PhoneIncoming } from 'lucide-react';

type CallState = 'calling' | 'connected' | 'ended';

interface VoiceCallMessage {
  id: string;
  text: string;
  senderId: 'user' | string;
  type: 'text' | 'audio';
  audioUrl?: string;
  audioLabel?: string;
  audioDuration?: number;
  audioTranscription?: string;
  audioTranslation?: string;
  timestamp: number;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Generate deterministic voice bar heights for audio visualization
const getVoiceBarHeights = (seed: string, count: number) => {
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const h = ((seed.charCodeAt(i % seed.length) || i * 7) * (i + 1) * 3 + i * 11) % 14;
    heights.push(Math.round(4 + h));
  }
  return heights;
};

export default function VoiceCall({
  characterId,
  onEnd,
}: {
  characterId: string;
  onEnd: (durationSeconds?: number) => void;
}) {
  const { characters, settings } = useAppStore();
  const character = characters[characterId];
  const isDark = settings.wechatTheme === 'dark';

  const [callState, setCallState] = useState<CallState>('calling');
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [messages, setMessages] = useState<VoiceCallMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showEndedOverlay, setShowEndedOverlay] = useState(false);

  const timerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);
  const callStartRef = useRef<number>(Date.now());

  // Get voice config for this character
  const voiceConfig = settings.voiceApiConfigs?.find(c => c.characterId === characterId) || settings.voiceApiConfigs?.[0];

  const addMessage = useCallback((msg: VoiceCallMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate answer after 3-5 seconds
  useEffect(() => {
    if (callState !== 'calling') return;
    const delay = 3000 + Math.random() * 2000;
    const t = setTimeout(() => {
      setCallState('connected');
      callStartRef.current = Date.now();
      // Start call duration timer
      timerRef.current = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }, delay);
    return () => clearTimeout(t);
  }, [callState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (playingAudioRef.current) {
        playingAudioRef.current.pause();
        playingAudioRef.current = null;
      }
    };
  }, []);

  // Play audio helper
  const playAudio = useCallback((url: string, id: string) => {
    if (playingAudioRef.current) {
      playingAudioRef.current.pause();
      playingAudioRef.current = null;
    }
    setPlayingAudioId(id);
    const audio = new Audio(url);
    audio.onended = () => { setPlayingAudioId(null); playingAudioRef.current = null; };
    audio.onerror = () => { setPlayingAudioId(null); playingAudioRef.current = null; };
    playingAudioRef.current = audio;
    void audio.play().catch(() => { setPlayingAudioId(null); playingAudioRef.current = null; });
  }, []);

  // Generate character voice reply
  const generateVoiceReply = useCallback(async (userText: string) => {
    if (!character || !voiceConfig?.apiKey) return;

    setIsProcessing(true);
    try {
      const reply = await getCharacterReply(characterId, userText);
      if (!reply.trim()) return;

      // Clean text for TTS (remove gift/transfer markers, brackets)
      const cleanText = reply.replace(/\[.*?\]/g, '').trim();
      if (!cleanText) return;

      // Detect if text is primarily English
      const isEnglish = /^[a-zA-Z0-9\s\.,!?;:'"\-()]+$/.test(cleanText) || settings.bilingual;
      let translation = '';
      if (isEnglish) {
        translation = await translateText(cleanText, '中文');
      }

      const audioUrl = await textToSpeech(cleanText, voiceConfig.voiceId);

      addMessage({
        id: `call_char_${Date.now()}`,
        text: cleanText,
        senderId: characterId,
        type: 'audio',
        audioUrl,
        audioLabel: cleanText.slice(0, 40) + (cleanText.length > 40 ? '…' : ''),
        audioDuration: Math.max(3, Math.ceil(cleanText.length / 4)),
        audioTranscription: cleanText,
        audioTranslation: translation || undefined,
        timestamp: Date.now(),
      });

      // Auto-play the voice
      playAudio(audioUrl, `call_char_${Date.now()}`);
    } catch (e) {
      console.error('Voice reply failed:', e);
    } finally {
      setIsProcessing(false);
    }
  }, [character, characterId, voiceConfig, settings.bilingual, addMessage, playAudio]);

  // Send text message (user types during call)
  const handleSendText = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    setInputText('');

    addMessage({
      id: `call_user_${Date.now()}`,
      text,
      senderId: 'user',
      type: 'text',
      timestamp: Date.now(),
    });

    await generateVoiceReply(text);
  }, [inputText, isProcessing, addMessage, generateVoiceReply]);

  // Handle voice recording for user voice input during call
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const handleStartVoiceInput = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  }, []);

  const handleStopVoiceInput = useCallback(async () => {
    if (mediaRecorderRef.current?.state !== 'recording') return;

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      streamRef.current?.getTracks().forEach(t => t.stop());
      setIsRecording(false);

      if (isProcessing) return;
      setIsProcessing(true);

      try {
        // Transcribe voice to text
        const transcript = await speechToText(blob, 'en');
        const text = transcript || '';
        if (!text.trim()) {
          setIsProcessing(false);
          return;
        }

        // Show user voice message with transcription
        const audioUrl = URL.createObjectURL(blob);
        addMessage({
          id: `call_user_voice_${Date.now()}`,
          text,
          senderId: 'user',
          type: 'audio',
          audioUrl,
          audioLabel: text.length > 30 ? text.slice(0, 30) + '…' : text,
          timestamp: Date.now(),
        });

        // Translate if bilingual
        let userText = text;
        if (settings.bilingual) {
          userText = await translateText(text, '中文');
        }

        await generateVoiceReply(userText || text);
      } catch {
        // fallback: just do nothing
      } finally {
        setIsProcessing(false);
      }
    };

    mediaRecorderRef.current.stop();
  }, [isProcessing, settings.bilingual, addMessage, generateVoiceReply]);

  const handleCancelVoiceInput = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        setIsRecording(false);
      };
      mediaRecorderRef.current.stop();
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  }, []);

  // End call
  const handleEndCall = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalDuration = callDuration;
    setCallState('ended');
    setShowEndedOverlay(true);
    // Auto-return after showing ended screen briefly, pass duration back
    setTimeout(() => {
      onEnd(finalDuration);
    }, 2500);
  }, [callDuration, onEnd]);

  const charName = character?.remark || character?.name || '';

  // ===== CALLING SCREEN =====
  if (callState === 'calling') {
    return (
      <div
        className="absolute inset-0 z-[100] flex flex-col items-center justify-between"
        style={{ background: '#1c1c1e' }}
      >
        {/* Top area - Call info */}
        <div className="w-full pt-16 flex flex-col items-center">
          <div className="text-white/50 text-sm mb-2">呼出中...</div>
          <div
            className="w-24 h-24 rounded-full mb-4 border-2 border-white/30 shadow-2xl"
            style={{
              background: character?.avatar?.startsWith('#') ? character.avatar : `url(${character?.avatar || ''}) center/cover`,
              boxShadow: character?.avatar?.startsWith('#') ? `0 0 60px ${character.avatar}66` : '0 0 60px rgba(0,0,0,0.3)',
            }}
          />
          <h1 className="text-white text-2xl font-semibold mb-1">{charName}</h1>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/60 text-sm">等待接听...</span>
          </div>
        </div>

        {/* Center - Avatar ripple animation */}
        <div className="relative flex-1 flex items-center justify-center">
          <div className="absolute w-48 h-48 rounded-full border border-white/10 animate-ping opacity-30" style={{ animationDuration: '2s' }} />
          <div className="absolute w-40 h-40 rounded-full border border-white/15 animate-ping opacity-20" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
          <Phone size={40} className="text-white/30" />
        </div>

        {/* Bottom - Controls */}
        <div className="w-full pb-12 flex items-center justify-center gap-8">
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isSpeakerOn ? 'bg-white/20 text-white ring-1 ring-white/30' : 'bg-white/20 text-white'
            }`}
          >
            {isSpeakerOn ? <Volume2 size={24} /> : <Phone size={24} />}
          </button>
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg hover:bg-red-600 active:scale-95 transition-all"
          >
            <PhoneOff size={28} className="text-white" />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isMuted ? 'bg-red-500/30 text-red-400 ring-1 ring-red-400/40' : 'bg-white/20 text-white'
            }`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
        </div>
      </div>
    );
  }

  // ===== CONNECTED SCREEN =====
  if (callState === 'connected') {
    return (
      <div
        className="absolute inset-0 z-[100] flex flex-col"
        style={{ background: '#1c1c1e' }}
      >
        {/* Call header */}
        <div className="flex items-center justify-between px-4 pt-14 pb-3 bg-black/20 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full border border-white/20"
              style={{
                background: character?.avatar?.startsWith('#') ? character.avatar : `url(${character?.avatar || ''}) center/cover`,
              }}
            />
            <div>
              <h2 className="text-white text-sm font-medium">{charName}</h2>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-white/50 text-xs">{formatDuration(callDuration)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={`p-2 rounded-full ${isSpeakerOn ? 'bg-white/20 text-white ring-1 ring-white/30' : 'bg-white/20 text-white'}`}
            >
              {isSpeakerOn ? <Volume2 size={20} /> : <Phone size={20} />}
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-full ${isMuted ? 'bg-red-500/30 text-red-400 ring-1 ring-red-400/40' : 'bg-white/20 text-white'}`}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Call connected system message */}
          <div className="text-center">
            <span className="text-white/40 text-xs">通话已连接</span>
          </div>

          {messages.map(msg => {
            const isUser = msg.senderId === 'user';
            return (
              <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                {msg.type === 'text' ? (
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                      isUser
                        ? 'bg-emerald-500 text-white rounded-tr-md'
                        : 'bg-white/15 text-white/90 rounded-tl-md backdrop-blur-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                ) : (
                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <button
                      onClick={() => msg.audioUrl && playAudio(msg.audioUrl, msg.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.97] ${
                        isUser
                          ? 'bg-emerald-500/80 text-white rounded-tr-md'
                          : 'bg-white/15 text-white/90 rounded-tl-md backdrop-blur-sm'
                      } ${playingAudioId === msg.id ? 'ring-2 ring-white/30' : ''}`}
                    >
                      <div className="flex items-center gap-[3px]">
                        {getVoiceBarHeights(msg.id, isUser ? 8 : 8).map((h, i) => (
                          <div
                            key={i}
                            className={`w-[3px] rounded-full ${
                              playingAudioId === msg.id ? 'animate-pulse' : ''
                            } ${isUser ? 'bg-white/80' : 'bg-white/60'}`}
                            style={{
                              height: `${h}px`,
                              animationDelay: playingAudioId === msg.id ? `${i * 0.08}s` : undefined,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs opacity-70">
                        {msg.audioLabel || '语音消息'}
                      </span>
                    </button>
                    {msg.audioTranscription && (
                      <div className={`mt-1 px-3 py-1.5 text-[11px] leading-relaxed rounded-xl max-w-[260px] bg-white/10 text-white/70`}>
                        <div>{msg.audioTranscription}</div>
                        {msg.audioTranslation && (
                          <div className="mt-1.5 pt-1.5 border-t border-white/15 text-[11px] text-white/50">
                            🌐 {msg.audioTranslation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-2xl backdrop-blur-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
                <span className="text-white/40 text-xs">{charName} 正在说话...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom input area */}
        <div className="shrink-0 bg-black/30 backdrop-blur-md border-t border-white/10 px-3 py-3 pb-safe">
          <div className="flex items-center gap-2">
            {/* Voice input button */}
            <button
              onPointerDown={handleStartVoiceInput}
              onPointerUp={handleStopVoiceInput}
              onPointerLeave={handleCancelVoiceInput}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                isRecording
                  ? 'bg-red-500 text-white scale-90 shadow-lg'
                  : 'bg-white/10 text-white/70 active:scale-90'
              }`}
              title={isRecording ? '松开发送' : '按住说话'}
            >
              {isRecording ? <div className="w-4 h-4 rounded-sm bg-white" /> : <Mic size={18} />}
            </button>

            {/* Text input */}
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              className="flex-1 min-w-0 h-10 bg-white/10 text-white rounded-lg px-3 outline-none text-sm placeholder-white/40"
              placeholder="输入消息..."
              disabled={isProcessing}
            />

            {/* Send button */}
            <button
              onClick={handleSendText}
              disabled={!inputText.trim() || isProcessing}
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-30 bg-emerald-500 text-white"
            >
              <Send size={18} />
            </button>

            {/* End call */}
            <button
              onClick={handleEndCall}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
              title="结束通话"
            >
              <PhoneOff size={18} />
            </button>
          </div>

          {isRecording && (
            <div className="mt-2 text-center">
              <span className="text-red-400 text-xs animate-pulse">● 录音中... 松开发送</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== ENDED SCREEN =====
  if (showEndedOverlay) {
    return (
      <div
        className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 rounded-full opacity-50"
            style={{
              background: character?.avatar?.startsWith('#') ? character.avatar : `url(${character?.avatar || ''}) center/cover`,
            }}
          />
          <h2 className="text-white text-lg font-medium">通话已结束</h2>
          <p className="text-white/40 text-sm">{formatDuration(callDuration)}</p>
          <PhoneIncoming size={24} className="text-white/30" />
        </div>
      </div>
    );
  }

  return null;
}
