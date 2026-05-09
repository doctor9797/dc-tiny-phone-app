import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Mail, PenSquare, Send, Settings2, Trash2, Images } from 'lucide-react';
import { MailLetter } from '../../types';
import { generateAIResponse } from '../../lib/ai';
import ImageUploader from '../ImageUploader';

type MailTab = 'inbox' | 'sent' | 'compose' | 'detail' | 'manage';

const HANDWRITING_FONT = '"Kaiti SC", "STKaiti", "KaiTi", "DFKai-SB", "Bradley Hand", "Segoe Print", cursive';
const HEADER_FONT = '"Palatino Linotype", "Book Antiqua", "Georgia", serif';
const MAILBOX_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="18" fill="#b97745"/>
    <text x="32" y="39" text-anchor="middle" font-size="27" font-family="Arial, sans-serif" fill="white">✉</text>
  </svg>
`)}`;

function LetterPaper({ letter, characterName }: { letter: MailLetter; characterName: string }) {
  return (
    <div
      className="rounded-[2rem] border border-[#e9dcc9] bg-[#fffaf1] px-6 py-7 shadow-[0_18px_40px_rgba(124,93,63,0.14)] relative overflow-hidden"
      style={{
        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.76), rgba(255,248,235,0.95))',
      }}
    >
      <div className="absolute inset-x-6 top-0 h-10 border-b border-[#eadfcd]/70" />
      <div className="absolute inset-y-0 left-8 w-px bg-[#f1e6d6]" />
      <div className="relative z-10 pl-5">
        <div className="text-[11px] tracking-[0.26em] uppercase text-[#9a7a55] mb-2" style={{ fontFamily: HEADER_FONT }}>
          Letter Mail
        </div>
        <div className="text-[28px] text-[#6f5336] mb-2" style={{ fontFamily: HEADER_FONT }}>
          {letter.subject || '无题来信'}
        </div>
        <div className="flex items-center justify-between text-sm text-[#8e7357] mb-5" style={{ fontFamily: HANDWRITING_FONT }}>
          <span>{letter.direction === 'incoming' ? `来自 ${characterName}` : `寄给 ${characterName}`}</span>
          <span>{new Date(letter.createdAt).toLocaleString()}</span>
        </div>
        <div
          className="whitespace-pre-wrap leading-9 text-[20px] text-[#4f3c2a]"
          style={{ fontFamily: HANDWRITING_FONT }}
        >
          {letter.content}
        </div>
        {letter.photoUrl && (
          <div className="mt-6 rounded-2xl overflow-hidden border border-[#e9dcc9]">
            <img src={letter.photoUrl} alt="attached" className="w-full h-48 object-cover" />
          </div>
        )}
        <div className="mt-8 text-right text-[22px] text-[#7f6347]" style={{ fontFamily: HANDWRITING_FONT }}>
          {letter.direction === 'incoming' ? characterName : '我'}
        </div>
      </div>
    </div>
  );
}

export default function MailboxApp() {
  const { closeApp, settings, updateSettings, mailboxLetters, characters, saveMailboxLetter, deleteMailboxLetter, markMailboxLetterRead, addActivityLog, setNotification } = useAppStore();
  const [tab, setTab] = useState<MailTab>('inbox');
  const [activeLetter, setActiveLetter] = useState<MailLetter | null>(null);
  const [recipientId, setRecipientId] = useState(Object.keys(characters)[0] || '');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  const inboxLetters = useMemo(() => mailboxLetters.filter(letter => letter.direction === 'incoming'), [mailboxLetters]);
  const sentLetters = useMemo(() => mailboxLetters.filter(letter => letter.direction === 'outgoing'), [mailboxLetters]);
  const mailboxCharacters = useMemo(() => Object.values(characters), [characters]);

  const openLetter = (letter: MailLetter) => {
    setActiveLetter(letter);
    if (letter.direction === 'incoming' && !letter.isRead) {
      markMailboxLetterRead(letter.id);
    }
    setTab('detail');
  };

  const handleSend = async () => {
    if (!recipientId || !content.trim()) return;
    setSending(true);
    const outgoingLetter: MailLetter = {
      id: `${Date.now()}_outgoing`,
      direction: 'outgoing',
      fromId: 'user',
      toId: recipientId,
      subject: subject.trim() || '一封新信',
      content: content.trim(),
      photoUrl,
      createdAt: Date.now(),
      isRead: true,
    };
    saveMailboxLetter(outgoingLetter);

    try {
      const char = characters[recipientId];
      if (char) {
        const reply = (await generateAIResponse(`你是${char.name}，性格是${char.personality}，和我的关系是${char.relationship}。我给你写了一封信。\n信件标题：${outgoingLetter.subject}\n信件内容：${outgoingLetter.content}\n请你回一封真实、温柔、有个人风格的短信纸来信，像真正手写信，不要Markdown，不超过180字。`)).trim();
        saveMailboxLetter({
          id: `${Date.now()}_reply_${recipientId}`,
          direction: 'incoming',
          fromId: recipientId,
          toId: 'user',
          subject: `Re: ${outgoingLetter.subject}`,
          content: reply.replace(/^\s+|\s+$/g, ''),
          createdAt: Date.now() + 1,
          isRead: false,
        });
        setNotification({
          id: Date.now() + 2,
          title: char.name,
          text: `${char.name}给您寄来了一封信`,
          sourceApp: 'mailbox',
          openApp: 'mailbox',
          avatar: MAILBOX_ICON,
          characterId: recipientId,
        });
      }
    } catch {
      // ignore reply failures
    }

    addActivityLog({
      id: `${Date.now()}_mail`,
      title: `寄出信件：${subject.trim() || '一封新信'}`,
      detail: `收件人：${characters[recipientId]?.name || recipientId}`,
      timestamp: Date.now(),
      relatedCharacterIds: [recipientId]
    });

    setSubject('');
    setContent('');
    setPhotoUrl(undefined);
    setSending(false);
    setTab('sent');
  };

  const resetCompose = () => {
    setSubject('');
    setContent('');
    setPhotoUrl(undefined);
  };

  if (tab === 'compose') {
    return (
      <div className="h-full flex flex-col bg-[#f7efe5]">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b border-[#eadcc9] bg-[#fff8ef]">
          <button onClick={() => { resetCompose(); setTab('inbox'); }} className="text-[#7d6142]"><ChevronLeft size={28} /></button>
          <div className="font-bold text-[#67472f]" style={{ fontFamily: HEADER_FONT }}>写信</div>
          <button onClick={handleSend} disabled={sending || !content.trim()} className="text-sm font-bold text-[#7b5434] disabled:opacity-40">
            发送
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-[2rem] border border-[#ebddcb] bg-[#fffaf3] p-4 space-y-3 shadow-sm">
            <select
              value={recipientId}
              onChange={e => setRecipientId(e.target.value)}
              className="w-full rounded-2xl border border-[#e7d9c6] bg-white px-4 py-3 text-[#6a4d33]"
              style={{ fontFamily: HEADER_FONT }}
            >
              {Object.values(characters).map(char => (
                <option key={char.id} value={char.id}>{char.name}</option>
              ))}
            </select>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="信件标题"
              className="w-full rounded-2xl border border-[#e7d9c6] bg-white px-4 py-3 text-[#6a4d33]"
              style={{ fontFamily: HEADER_FONT }}
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="把想说的话写成一封信。"
              className="w-full min-h-[260px] resize-none rounded-[1.8rem] border border-[#e7d9c6] bg-[#fffdf8] px-5 py-5 text-[#513d2c] outline-none leading-9"
              style={{ fontFamily: HANDWRITING_FONT, fontSize: 20 }}
            />
          </div>
          <div className="flex items-center gap-3">
            <ImageUploader onImageSelected={(url) => setPhotoUrl(url)}>
              <div className="rounded-2xl border border-dashed border-[#d4c4b0] bg-[#faf5ef] px-4 py-3 text-sm font-bold text-[#8b7355] flex items-center gap-2 cursor-pointer">
                <Images size={16} /> {photoUrl ? '更换照片' : '添加照片'}
              </div>
            </ImageUploader>
            {photoUrl && (
              <button onClick={() => setPhotoUrl(undefined)} className="text-xs font-bold text-[#a94f4f]">移除</button>
            )}
          </div>
          {photoUrl && (
            <div className="rounded-2xl overflow-hidden border border-[#ebddcb]">
              <img src={photoUrl} alt="attached" className="w-full h-48 object-cover" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (tab === 'detail' && activeLetter) {
    const characterName = activeLetter.direction === 'incoming'
      ? (characters[activeLetter.fromId]?.name || activeLetter.fromId)
      : (characters[activeLetter.toId]?.name || activeLetter.toId);
    return (
      <div className="h-full flex flex-col bg-[#f7efe5]">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b border-[#eadcc9] bg-[#fff8ef]">
          <button onClick={() => setTab(activeLetter.direction === 'incoming' ? 'inbox' : 'sent')} className="text-[#7d6142]"><ChevronLeft size={28} /></button>
          <div className="font-bold text-[#67472f]" style={{ fontFamily: HEADER_FONT }}>信件内容</div>
          <button onClick={() => { if (confirm('确定删除这封信吗？')) { deleteMailboxLetter(activeLetter.id); setTab(activeLetter.direction === 'incoming' ? 'inbox' : 'sent'); } }} className="text-[#a94f4f]">
            <Trash2 size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <LetterPaper letter={activeLetter} characterName={characterName} />
        </div>
      </div>
    );
  }

  if (tab === 'manage') {
    return (
      <div className="h-full flex flex-col bg-[#f7efe5]">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b border-[#eadcc9] bg-[#fff8ef]">
          <button onClick={() => setTab('inbox')} className="text-[#7d6142]"><ChevronLeft size={28} /></button>
          <div className="font-bold text-[#67472f]" style={{ fontFamily: HEADER_FONT }}>来信设置</div>
          <div className="w-5" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mailboxCharacters.map(char => {
            const enabled = settings.mailbox?.enabledSenderIds?.includes(char.id) || false;
            const frequency = settings.mailbox?.frequencyByCharacter?.[char.id] || 'medium';
            return (
              <div key={char.id} className="rounded-[1.7rem] border border-[#eadcc9] bg-[#fffaf3] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-[#6b4d34]" style={{ fontFamily: HEADER_FONT }}>{char.name}</div>
                    <div className="text-xs text-[#a08467] mt-1">{char.relationship}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => {
                      const nextIds = e.target.checked
                        ? Array.from(new Set([...(settings.mailbox?.enabledSenderIds || []), char.id]))
                        : (settings.mailbox?.enabledSenderIds || []).filter(id => id !== char.id);
                      updateSettings({
                        mailbox: {
                          enabledSenderIds: nextIds,
                          frequencyByCharacter: settings.mailbox?.frequencyByCharacter || {},
                          lastReceivedAt: settings.mailbox?.lastReceivedAt || {}
                        }
                      });
                    }}
                    className="w-5 h-5 accent-[#8b6b4c]"
                  />
                </div>
                <select
                  value={frequency}
                  onChange={e => updateSettings({
                    mailbox: {
                      enabledSenderIds: settings.mailbox?.enabledSenderIds || [],
                      frequencyByCharacter: {
                        ...(settings.mailbox?.frequencyByCharacter || {}),
                        [char.id]: e.target.value as 'low' | 'medium' | 'high'
                      },
                      lastReceivedAt: settings.mailbox?.lastReceivedAt || {}
                    }
                  })}
                  className="mt-3 w-full rounded-2xl border border-[#e7d9c6] bg-white px-4 py-3 text-[#6a4d33]"
                  style={{ fontFamily: HEADER_FONT }}
                >
                  <option value="high">高频</option>
                  <option value="medium">正常</option>
                  <option value="low">低频</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const list = tab === 'inbox' ? inboxLetters : sentLetters;

  return (
    <div className="h-full flex flex-col bg-[#f7efe5]">
      <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b border-[#eadcc9] bg-[#fff8ef]">
        <button onClick={closeApp} className="text-[#7d6142]"><ChevronLeft size={28} /></button>
        <div className="font-bold text-[#67472f]" style={{ fontFamily: HEADER_FONT }}>信箱</div>
        <div className="flex items-center gap-3 text-[#7b5434]">
          <button onClick={() => setTab('manage')}>
            <Settings2 size={19} />
          </button>
          <button onClick={() => setTab('compose')}>
            <PenSquare size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 flex gap-2">
        <button
          onClick={() => setTab('inbox')}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${tab === 'inbox' ? 'bg-[#6f5137] text-white' : 'bg-white text-[#7f654b] border border-[#eadcc9]'}`}
          style={{ fontFamily: HEADER_FONT }}
        >
          收件箱
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${tab === 'sent' ? 'bg-[#6f5137] text-white' : 'bg-white text-[#7f654b] border border-[#eadcc9]'}`}
          style={{ fontFamily: HEADER_FONT }}
        >
          已发送
        </button>
        <button
          onClick={() => setTab('compose')}
          className="rounded-full px-4 py-2 bg-white text-[#7f654b] border border-[#eadcc9]"
        >
          <Send size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {list.length === 0 ? (
          <div className="mt-24 text-center text-[#b2987b]" style={{ fontFamily: HANDWRITING_FONT, fontSize: 22 }}>
            {tab === 'inbox' ? '现在还没有收到新的信。' : '你还没有寄出任何信。'}
          </div>
        ) : list.map(letter => {
          const char = letter.direction === 'incoming' ? characters[letter.fromId] : characters[letter.toId];
          return (
            <button
              key={letter.id}
              onClick={() => openLetter(letter)}
              className="w-full text-left rounded-[1.7rem] border border-[#eadcc9] bg-[#fffaf3] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[#6b4d34]">
                    <Mail size={16} />
                    <span className="font-bold truncate" style={{ fontFamily: HEADER_FONT }}>
                      {char?.name || '未知寄件人'}
                    </span>
                    {letter.direction === 'incoming' && !letter.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#d97706]" />
                    )}
                  </div>
                  <div className="mt-1 truncate text-[#513d2c]" style={{ fontFamily: HEADER_FONT }}>
                    {letter.subject || '无题来信'}
                  </div>
                </div>
                <div className="text-xs text-[#a08467] shrink-0">
                  {new Date(letter.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="line-clamp-2 text-[#735943] leading-7" style={{ fontFamily: HANDWRITING_FONT, fontSize: 18 }}>
                {letter.content}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
