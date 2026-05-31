import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, ChevronRight, Heart, Plus, Camera, Cloud, Sun, CloudRain, Snowflake, Zap, Smile, Frown, Meh, Angry, Laugh, Heart as HeartIcon, X, Settings, Calendar, Trash2, Edit3, Bell, Palette, Clock, ChevronDown, ChevronUp, MapPin, Gift, MessageCircle, CheckCircle2, Circle, Image as ImageIcon, Timer, Lock, Unlock, Send, Vibrate } from 'lucide-react';
import { CoupleDiaryEntry, SpecialEvent, WhisperMessage, TimeCapsule, WishlistItem, LocationCheckin, HeartbeatRecord } from '../../types';
import {
  generatePartnerDiary,
  generatePartnerGalleryPhoto,
  generatePartnerWhisper,
  generatePartnerCapsule,
  generatePartnerWish,
  generatePartnerLocation,
} from './coupleDiaryAI';
import ImageUploader from '../ImageUploader';
import { format, differenceInDays, parseISO, isSameDay, addDays } from 'date-fns';
import { saveInteractionMemory, estimateSentiment } from '../../lib/characterMemory';
import { extractImageData, generateAIResponse } from '../../lib/ai';
import Tesseract from 'tesseract.js';

// ── Image description for memory: AI vision first, OCR fallback ──
async function describeImage(dataUrl: string): Promise<string> {
  const imgData = extractImageData(dataUrl);
  if (!imgData) return '[图片]';

  try {
    // Attempt 1: AI vision API
    const desc = await generateAIResponse(
      '请用一句话简洁描述这张图片的内容（避免用"图片中""画面中"开头，直接描述），不超过30字。',
      undefined,
      [imgData],
    );
    if (desc && desc.length > 2) return desc.trim();
  } catch {}

  try {
    // Attempt 2: Tesseract.js OCR (extract any visible text)
    const { data } = await Tesseract.recognize(dataUrl, 'chi_sim+eng', {
      logger: () => {}, // quiet
    });
    const text = data.text.trim();
    if (text.length > 2) return `[图片文字] ${text.slice(0, 80)}`;
  } catch {}

  return '[图片]';
}

const MOODS = [
  { icon: Laugh, label: '超开心', color: '#fbbf24' },
  { icon: Smile, label: '开心', color: '#34d399' },
  { icon: HeartIcon, label: '甜蜜', color: '#f472b6' },
  { icon: Meh, label: '一般', color: '#9ca3af' },
  { icon: Frown, label: '难过', color: '#60a5fa' },
  { icon: Angry, label: '生气', color: '#f87171' },
];

const WEATHER = [
  { icon: Sun, label: '晴天' },
  { icon: Cloud, label: '多云' },
  { icon: CloudRain, label: '雨天' },
  { icon: Snowflake, label: '雪天' },
  { icon: Zap, label: '雷暴' },
];

const BACKGROUND_COLORS = [
  '#fef3f2', '#fefce8', '#f0fdf4', '#ecfeff', '#eff6ff',
  '#fdf4ff', '#fff1f2', '#fffbeb', '#fscfdf', '#f5f3ff',
  '#ffffff', '#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db',
];

const HOLIDAYS = [
  { name: '情人节', month: 2, day: 14 },
  { name: '七夕', month: 8, day: 10 },
  { name: '520', month: 5, day: 20 },
  { name: '521', month: 5, day: 21 },
];

export default function CoupleDiaryApp({ onBack }: { onBack: () => void }) {
  const { characters, settings, coupleDiaries, createCoupleDiary, addCoupleDiaryEntry, updateCoupleDiary, deleteCoupleDiaryEntry, addSpecialEvent, deleteSpecialEvent, setNotification } = useAppStore();
  const [showInvite, setShowInvite] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSpecialEvents, setShowSpecialEvents] = useState(false);
  const [showSpecialEventEntry, setShowSpecialEventEntry] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedWeather, setSelectedWeather] = useState<number | null>(null);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedBgColor, setSelectedBgColor] = useState(BACKGROUND_COLORS[0]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<'low' | 'medium' | 'high' | 'off'>('medium');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [upcomingReminders, setUpcomingReminders] = useState<{ name: string; days: number; date: Date }[]>([]);
  const [editStartDate, setEditStartDate] = useState(false);
  const [startDateValue, setStartDateValue] = useState('');
  const [specialEventName, setSpecialEventName] = useState('');
  const [specialEventColor, setSpecialEventColor] = useState(BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [galleryTick, setGalleryTick] = useState(0);
  const [galleryTapPhoto, setGalleryTapPhoto] = useState<{ key: string; index: number } | null>(null);
  const [newReminderName, setNewReminderName] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');
  const [newReminderNotifyBefore, setNewReminderNotifyBefore] = useState(3);
  const [showReminderPage, setShowReminderPage] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any>(null);
  const [reminderNotification, setReminderNotification] = useState<{ title: string; message: string } | null>(null);

  // New feature states
  const [showGallery, setShowGallery] = useState(false);
  const [showWhisper, setShowWhisper] = useState(false);
  const [showCapsule, setShowCapsule] = useState(false);
  const [showHeartbeat, setShowHeartbeat] = useState(false);
  const [showStampMap, setShowStampMap] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [whisperText, setWhisperText] = useState('');
  const [whisperScheduledDate, setWhisperScheduledDate] = useState('');
  const [showScheduler, setShowScheduler] = useState(false);
  const [deliveryTick, setDeliveryTick] = useState(0); // force re-render for scheduled whisper delivery
  const [capsuleTitle, setCapsuleTitle] = useState('');
  const [capsuleContent, setCapsuleContent] = useState('');
  const [capsuleOpenDate, setCapsuleOpenDate] = useState('');
  const [capsulePhotos, setCapsulePhotos] = useState<string[]>([]);
  const [wishlistText, setWishlistText] = useState('');
  const [timelineStartDate, setTimelineStartDate] = useState('');
  const [timelineEndDate, setTimelineEndDate] = useState('');
  const [heartbeating, setHeartbeating] = useState(false);
  const [showNewCapsule, setShowNewCapsule] = useState(false);
  const [viewingCapsule, setViewingCapsule] = useState<TimeCapsule | null>(null);
  const [heartbeatPartner, setHeartbeatPartner] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [locationPhoto, setLocationPhoto] = useState<string | null>(null);

  const capsuleFileInputRef = useRef<HTMLInputElement>(null);
  const locationFileInputRef = useRef<HTMLInputElement>(null);
  const whisperEndRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatStartRef = useRef<number>(0);
  
  const toggleExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const checkAndShowNotifications = () => {
    if (!currentDiary) return;
    
    const today = new Date();
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    
    const shouldNotify = (currentHour === 10 && currentMinute < 5) || 
                         (currentHour === 18 && currentMinute < 5);
    
    if (!shouldNotify) return;
    
    const remindersToShow: { name: string; days: number }[] = [];
    
    currentDiary.reminders?.forEach(reminder => {
      if (!reminder.enabled) return;
      
      if (reminder.type === 'holiday' && reminder.month && reminder.day) {
        let holidayDate = new Date(today.getFullYear(), reminder.month - 1, reminder.day);
        if (holidayDate < today) {
          holidayDate = new Date(today.getFullYear() + 1, reminder.month - 1, reminder.day);
        }
        const daysUntil = differenceInDays(holidayDate, today);
        if (daysUntil <= reminder.notifyBefore && daysUntil >= 0) {
          remindersToShow.push({ name: reminder.name, days: daysUntil });
        }
      }
    });
    
    currentDiary.specialEvents?.forEach(event => {
      if (!event.enabled) return;
      try {
        const eventDate = parseISO(event.date);
        const daysUntil = differenceInDays(eventDate, today);
        if (daysUntil <= 7 && daysUntil >= 0) {
          remindersToShow.push({ name: event.name, days: daysUntil });
        }
      } catch {}
    });
    
    if (remindersToShow.length > 0) {
        const firstReminder = remindersToShow[0];
        setReminderNotification({
          title: firstReminder.name,
          message: firstReminder.days === 0 ? '今天是个特别的日子！' : 
                   firstReminder.days === 1 ? '明天就是重要的日子！' : 
                   `${firstReminder.days}天后有重要的日子！`,
        });
        
        setTimeout(() => {
          setReminderNotification(null);
        }, 5000);
      }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark = settings.wechatTheme === 'dark';
  const currentDiary = coupleDiaries[0];
  
  useEffect(() => {
    checkAndShowNotifications();

    const interval = setInterval(() => {
      checkAndShowNotifications();
      setDeliveryTick(t => t + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentDiary]);
  const partner = currentDiary ? characters[currentDiary.partnerId] : null;

  useEffect(() => {
    if (currentDiary) {
      checkReminders();
      setFrequency(currentDiary.partnerWritingFrequency || 'medium');
    }
  }, [currentDiary]);

  useEffect(() => {
    if (currentDiary?.partnerWritingFrequency) {
      setFrequency(currentDiary.partnerWritingFrequency);
    }
  }, [currentDiary?.partnerWritingFrequency]);

  const checkReminders = () => {
    if (!currentDiary || !currentDiary.startDate) return;
    const reminders: { name: string; days: number; date: Date }[] = [];
    const today = new Date();
    const startDate = new Date(currentDiary.startDate);

    const daysTogether = differenceInDays(today, startDate);

    currentDiary.reminders?.forEach(reminder => {
      if (!reminder.enabled) return;
      if (reminder.type === 'anniversary') {
        reminder.days.forEach(day => {
          const nextDate = addDays(startDate, day);
          if (nextDate >= today) {
            const daysUntil = differenceInDays(nextDate, today);
            if (daysUntil <= reminder.notifyBefore) {
              reminders.push({ name: `${reminder.name}第${day}天`, days: daysUntil, date: nextDate });
            }
          }
        });
      } else if (reminder.type === 'holiday') {
        const currentYear = today.getFullYear();
        const holiday = HOLIDAYS.find(h => h.name === reminder.name);
        if (holiday) {
          let holidayDate = new Date(currentYear, holiday.month - 1, holiday.day);
          if (holidayDate < today) {
            holidayDate = new Date(currentYear + 1, holiday.month - 1, holiday.day);
          }
          const daysUntil = differenceInDays(holidayDate, today);
          if (daysUntil <= reminder.notifyBefore && daysUntil >= 0) {
            reminders.push({ name: reminder.name, days: daysUntil, date: holidayDate });
          }
        }
      }
    });

    currentDiary.specialEvents?.forEach(event => {
      try {
        const eventDate = parseISO(event.date);
        if (eventDate >= today) {
          const daysUntil = differenceInDays(eventDate, today);
          if (daysUntil <= 7) {
            reminders.push({ name: event.name, days: daysUntil, date: eventDate });
          }
        }
      } catch {}
    });

    setUpcomingReminders(reminders.sort((a, b) => a.days - b.days));
  };

  const simulatePartnerContent = async () => {
    if (!currentDiary || frequency === 'off' || !partner) return;
    const partnerId = currentDiary.partnerId;

    // Pick a random content type to generate
    const contentTypes = ['diary', 'gallery', 'whisper', 'capsule', 'wish', 'location'];
    const type = contentTypes[Math.floor(Math.random() * contentTypes.length)];

    try {
      switch (type) {
        case 'diary': {
          const result = await generatePartnerDiary(partnerId);
          const entry: CoupleDiaryEntry = {
            id: 'partner_diary_' + Date.now(),
            authorId: partnerId,
            title: result.title || (partner?.name + '的日记'),
            content: result.content || '',
            photos: [],
            createdAt: Date.now(),
            moods: result.moods || ['开心'],
          };
          addCoupleDiaryEntry(currentDiary.id, entry);
          break;
        }
        case 'gallery': {
          const photo = await generatePartnerGalleryPhoto(partnerId);
          const diary = currentDiary;
          const existingPhotos = diary.galleryPhotos || [];
          // Store as a description string - gallery will render it
          const galleryKey = 'partner_gallery_' + Date.now();
          const newPhotos = [...existingPhotos, galleryKey];
          updateCoupleDiary(currentDiary.id, { galleryPhotos: newPhotos });
          // Store photo description + caption in localStorage for persistence
          try {
            const stored = JSON.parse(localStorage.getItem('cp_gallery_descs_' + partnerId) || '{}');
            stored[galleryKey] = photo;
            localStorage.setItem('cp_gallery_descs_' + partnerId, JSON.stringify(stored));
          } catch {}
          // Also add as a diary entry so it's visible in the timeline
          const entry: CoupleDiaryEntry = {
            id: 'partner_photo_' + Date.now(),
            authorId: partnerId,
            title: '分享了一张照片',
            content: photo.description + (photo.caption ? '\n💬 ' + photo.caption : ''),
            photos: [],
            createdAt: Date.now(),
            moods: ['开心'],
          };
          addCoupleDiaryEntry(currentDiary.id, entry);
          break;
        }
        case 'whisper': {
          const msg = await generatePartnerWhisper(partnerId);
          const existingWhispers = currentDiary.whispers || [];
          const newWhisper: WhisperMessage = {
            id: 'partner_whisper_' + Date.now(),
            senderId: 'partner',
            text: msg,
            createdAt: Date.now(),
          };
          updateCoupleDiary(currentDiary.id, { whispers: [...existingWhispers, newWhisper] });
          break;
        }
        case 'capsule': {
          const capsule = await generatePartnerCapsule(partnerId);
          const existingCapsules = currentDiary.timeCapsules || [];
          const openDate = new Date();
          openDate.setDate(openDate.getDate() + Math.floor(Math.random() * 90) + 30);
          const newCapsule: TimeCapsule = {
            id: 'partner_capsule_' + Date.now(),
            title: capsule.title,
            content: capsule.content,
            createdAt: Date.now(),
            openAt: openDate.getTime(),
            openCondition: 'date',
            locked: true,
          };
          updateCoupleDiary(currentDiary.id, { timeCapsules: [...existingCapsules, newCapsule] });
          break;
        }
        case 'wish': {
          const wishText = await generatePartnerWish(partnerId);
          const existingWishes = currentDiary.wishlist || [];
          const newWish: WishlistItem = {
            id: 'partner_wish_' + Date.now(),
            text: wishText,
            completed: false,
            createdBy: 'partner',
            createdAt: Date.now(),
          };
          updateCoupleDiary(currentDiary.id, { wishlist: [...existingWishes, newWish] });
          break;
        }
        case 'location': {
          const loc = await generatePartnerLocation(partnerId);
          const existingLocs = currentDiary.locations || [];
          const newLoc: LocationCheckin = {
            id: 'partner_loc_' + Date.now(),
            name: loc.name,
            note: loc.note,
            timestamp: Date.now(),
            createdBy: 'partner',
          };
          updateCoupleDiary(currentDiary.id, { locations: [...existingLocs, newLoc] });
          break;
        }
      }
    } catch (e) {
      console.error('Partner content generation error:', e);
    }
  };

  // ── Partner AI auto-content generator ──
  const partnerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (partnerIntervalRef.current) {
      clearInterval(partnerIntervalRef.current);
      partnerIntervalRef.current = null;
    }
    if (!currentDiary || frequency === 'off') return;

    const intervals: Record<string, number> = {
      low: 4 * 60 * 60 * 1000,
      medium: 2 * 60 * 60 * 1000,
      high: 30 * 60 * 1000,
    };
    const ms = intervals[frequency];
    if (ms) {
      // First generation after a random delay (0-30% of interval)
      const firstDelay = Math.random() * ms * 0.3;
      setTimeout(() => {
        simulatePartnerContent();
        partnerIntervalRef.current = setInterval(() => {
          simulatePartnerContent();
        }, ms);
      }, firstDelay);
    }
    return () => {
      if (partnerIntervalRef.current) {
        clearInterval(partnerIntervalRef.current);
      }
    };
  }, [currentDiary, frequency]);

  const handleCreateDiary = (partnerId: string) => {
    createCoupleDiary(partnerId);
    setShowInvite(false);
  };

  const handleAddEntry = async () => {
    if (!currentDiary || (!entryContent.trim() && photos.length === 0)) return;

    const specialEvent = selectedEventId ? currentDiary.specialEvents?.find(e => e.id === selectedEventId) : null;

    const newEntry: CoupleDiaryEntry = {
      id: Date.now().toString(),
      authorId: 'user',
      title: entryTitle || '今日日记',
      content: entryContent,
      photos,
      createdAt: Date.now(),
      moods: selectedMood !== null ? [MOODS[selectedMood].label] : [],
      weather: selectedWeather !== null ? WEATHER[selectedWeather].label : undefined,
      backgroundColor: selectedBgColor,
      isSpecialEvent: !!specialEvent,
      eventId: selectedEventId || undefined,
    };

    addCoupleDiaryEntry(currentDiary.id, newEntry);

    // ── Rich memory for partner + emotion ──
    if (currentDiary?.partnerId) {
      // Describe images (AI vision / OCR fallback)
      let imageDesc = '';
      if (photos.length > 0) {
        const descriptions = await Promise.all(photos.map(describeImage));
        imageDesc = '（配图：' + descriptions.join('；') + '）';
      }
      const moodStr = newEntry.moods?.length ? `[心情:${newEntry.moods.join(',')}]` : '';
      const weatherStr = newEntry.weather ? `[天气:${newEntry.weather}]` : '';
      const summary = `在情侣日记中写了「${newEntry.title}」${moodStr}${weatherStr}`;
      const fullContent = (newEntry.content || '') + imageDesc;
      const est = estimateSentiment(summary + ' ' + fullContent);
      useAppStore.getState().addCharacterMemory(currentDiary.partnerId, {
        type: 'event',
        content: fullContent,
        summary: summary.slice(0, 80),
        tags: ['couple_diary', 'user_diary'],
        valence: est.valence,
        arousal: est.arousal,
        importance: 4,
        layer: 'diary',
        resolved: 0,
      });
      useAppStore.getState().addEmotionEvent({ characterId: currentDiary.partnerId, paDelta: 0.25, naDelta: -0.05, word: '甜蜜', valence: 0.6, arousal: 0.5, matchSource: 'free_form', source: 'manual' });
    }
    setShowNewEntry(false);
    setEntryTitle('');
    setEntryContent('');
    setPhotos([]);
    setSelectedMood(null);
    setSelectedWeather(null);
    setSelectedBgColor(BACKGROUND_COLORS[0]);
    setSelectedEventId(null);
  };

  const handleAddSpecialEventEntry = async () => {
    if (!currentDiary || (!entryContent.trim() && photos.length === 0)) return;
    if (!specialEventName.trim()) return;

    const event: SpecialEvent = {
      id: Date.now().toString(),
      name: specialEventName.trim(),
      date: format(new Date(), 'yyyy-MM-dd'),
      color: specialEventColor,
      enabled: true,
    };

    addSpecialEvent(currentDiary.id, event);

    const newEntry: CoupleDiaryEntry = {
      id: (Date.now() + 1).toString(),
      authorId: 'user',
      title: entryTitle || specialEventName.trim(),
      content: entryContent,
      photos,
      createdAt: Date.now(),
      moods: selectedMood !== null ? [MOODS[selectedMood].label] : [],
      weather: selectedWeather !== null ? WEATHER[selectedWeather].label : undefined,
      backgroundColor: selectedBgColor,
      isSpecialEvent: true,
      eventId: event.id,
    };

    addCoupleDiaryEntry(currentDiary.id, newEntry);
    setShowSpecialEventEntry(false);
    setEntryTitle('');
    setEntryContent('');
    setPhotos([]);
    setSelectedMood(null);
    setSelectedWeather(null);
    setSelectedBgColor(BACKGROUND_COLORS[0]);
    setSpecialEventName('');
    setSpecialEventColor(BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)]);

    // ── Rich memory for partner + emotion ──
    if (currentDiary?.partnerId) {
      let imageDesc = '';
      if (photos.length > 0) {
        const descriptions = await Promise.all(photos.map(describeImage));
        imageDesc = '（配图：' + descriptions.join('；') + '）';
      }
      const moodStr = newEntry.moods?.length ? `[心情:${newEntry.moods.join(',')}]` : '';
      const weatherStr = newEntry.weather ? `[天气:${newEntry.weather}]` : '';
      const summary = `在情侣日记中记录了特殊事件「${newEntry.title}」${moodStr}${weatherStr}`;
      const fullContent = (newEntry.content || '') + imageDesc;
      const est = estimateSentiment(summary + ' ' + fullContent);
      useAppStore.getState().addCharacterMemory(currentDiary.partnerId, {
        type: 'event',
        content: fullContent,
        summary: summary.slice(0, 80),
        tags: ['couple_diary', 'user_diary'],
        valence: est.valence,
        arousal: est.arousal,
        importance: 5,
        layer: 'diary',
        resolved: 0,
      });
      useAppStore.getState().addEmotionEvent({ characterId: currentDiary.partnerId, paDelta: 0.3, naDelta: -0.05, word: '惊喜', valence: 0.6, arousal: 0.6, matchSource: 'free_form', source: 'manual' });
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!currentDiary) return;
    deleteCoupleDiaryEntry(currentDiary.id, entryId);
    setDeleteConfirm(null);
  };

  const handleFrequencyChange = (newFreq: 'low' | 'medium' | 'high' | 'off') => {
    if (!currentDiary) return;
    setFrequency(newFreq);
    updateCoupleDiary(currentDiary.id, { partnerWritingFrequency: newFreq });
  };

  const handleDeleteEvent = (eventId: string) => {
    if (!currentDiary) return;
    const event = currentDiary.specialEvents?.find(e => e.id === eventId);
    if (!event) return;
    
    if (confirm(`确定要删除"${event.name}"吗？关联的日记也会被删除。`)) {
      currentDiary.entries?.forEach(entry => {
        if (entry.eventId === eventId) {
          deleteCoupleDiaryEntry(currentDiary.id, entry.id);
        }
      });
      deleteSpecialEvent(currentDiary.id, eventId);
    }
  };

  const handleToggleReminder = (reminderId: string) => {
    if (!currentDiary) return;
    const updatedReminders = currentDiary.reminders?.map(r => 
      r.id === reminderId ? { ...r, enabled: !r.enabled } : r
    );
    updateCoupleDiary(currentDiary.id, { reminders: updatedReminders });
    setTimeout(() => checkReminders(), 100);
  };

  const handleAddReminder = () => {
    if (!currentDiary || !newReminderName.trim() || !newReminderDate) return;
    
    const date = new Date(newReminderDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const existingReminders = currentDiary.reminders || [];
    const newReminder = {
      id: Date.now().toString(),
      type: 'holiday' as const,
      name: newReminderName.trim(),
      days: [0],
      notifyBefore: newReminderNotifyBefore,
      enabled: true,
      month,
      day,
    };
    
    updateCoupleDiary(currentDiary.id, { reminders: [...existingReminders, newReminder] });
    setShowAddReminder(false);
    setNewReminderName('');
    setNewReminderDate('');
    setNewReminderNotifyBefore(3);
    setTimeout(() => checkReminders(), 100);
  };

  const handleDeleteReminder = (reminderId: string) => {
    if (!currentDiary) return;
    const updatedReminders = currentDiary.reminders?.filter(r => r.id !== reminderId);
    updateCoupleDiary(currentDiary.id, { reminders: updatedReminders });
    setTimeout(() => checkReminders(), 100);
  };

  const handleUpdateReminder = () => {
    if (!currentDiary || !editingReminder) return;
    
    const date = new Date(newReminderDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const updatedReminders = currentDiary.reminders?.map(r => 
      r.id === editingReminder.id 
        ? { 
            ...r, 
            name: newReminderName.trim(), 
            notifyBefore: newReminderNotifyBefore,
            month,
            day,
          } 
        : r
    );
    
    updateCoupleDiary(currentDiary.id, { reminders: updatedReminders });
    setShowAddReminder(false);
    setEditingReminder(null);
    setNewReminderName('');
    setNewReminderDate('');
    setNewReminderNotifyBefore(3);
    setTimeout(() => checkReminders(), 100);
  };

  const handleToggleEventReminder = (eventId: string) => {
    if (!currentDiary) return;
    const event = currentDiary.specialEvents?.find(e => e.id === eventId);
    if (!event) return;
    updateCoupleDiary(currentDiary.id, {
      specialEvents: currentDiary.specialEvents.map(e => 
        e.id === eventId ? { ...e, enabled: !e.enabled } : e
      )
    });
  };

  const handleUpdateStartDate = () => {
    if (!currentDiary || !startDateValue) return;
    const newStartDate = new Date(startDateValue).getTime();
    updateCoupleDiary(currentDiary.id, { startDate: newStartDate });
    setEditStartDate(false);
    setStartDateValue('');
  };

  // ── Whisper ──

  const handleSendWhisper = () => {
    if (!currentDiary || !whisperText.trim()) return;
    const whisper: WhisperMessage = {
      id: Date.now().toString(),
      senderId: 'user',
      text: whisperText.trim(),
      createdAt: Date.now(),
      scheduledFor: whisperScheduledDate ? new Date(whisperScheduledDate).getTime() : undefined,
    };
    updateCoupleDiary(currentDiary.id, {
      whispers: [...(currentDiary.whispers || []), whisper]
    });
    setWhisperText('');
    setWhisperScheduledDate('');
    setTimeout(() => whisperEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    // Simulate partner reply after a delay
    if (Math.random() > 0.3) {
      const delay = 2000 + Math.random() * 4000;
      setTimeout(() => {
        const replies = ['嗯嗯~', '知道啦❤️', '我也想你~', '好呀好呀', '嘻嘻', '收到啦~', '你说得对！', '我记住了~'];
        const reply: WhisperMessage = {
          id: (Date.now() + 1).toString(),
          senderId: 'partner',
          text: replies[Math.floor(Math.random() * replies.length)],
          createdAt: Date.now(),
        };
        updateCoupleDiary(currentDiary.id, {
          whispers: [...(useAppStore.getState().coupleDiaries?.find(d => d.id === currentDiary.id)?.whispers || []), reply]
        });
      }, delay);
    }
  };

  // ── Time Capsule ──

  const handleCreateCapsule = () => {
    if (!currentDiary || !capsuleTitle.trim() || !capsuleOpenDate) return;
    const capsule: TimeCapsule = {
      id: Date.now().toString(),
      title: capsuleTitle.trim(),
      content: capsuleContent.trim(),
      createdAt: Date.now(),
      openAt: new Date(capsuleOpenDate).getTime(),
      openCondition: 'date',
      locked: true,
      photos: capsulePhotos.length > 0 ? capsulePhotos : undefined,
    };
    updateCoupleDiary(currentDiary.id, {
      timeCapsules: [...(currentDiary.timeCapsules || []), capsule]
    });
    setShowNewCapsule(false);
    setCapsuleTitle('');
    setCapsuleContent('');
    setCapsuleOpenDate('');
    setCapsulePhotos([]);
  };

  const handleOpenCapsule = (capsule: TimeCapsule) => {
    if (capsule.locked && capsule.openAt > Date.now()) return;
    const updated = (currentDiary.timeCapsules || []).map(c =>
      c.id === capsule.id ? { ...c, locked: false, openedAt: c.openedAt || Date.now() } : c
    );
    updateCoupleDiary(currentDiary.id, { timeCapsules: updated });
    setViewingCapsule({ ...capsule, locked: false, openedAt: capsule.openedAt || Date.now() });
  };

  const handleCapsulePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => { setCapsulePhotos(prev => [...prev, reader.result as string]); };
      reader.readAsDataURL(file as Blob);
    });
    e.target.value = '';
  };

  // ── Heartbeat ──

  const startHeartbeat = () => {
    setHeartbeating(true);
    heartbeatStartRef.current = Date.now();
    try { navigator.vibrate?.(200); } catch {}
    pressTimerRef.current = setTimeout(() => {
      if (!currentDiary) return;
      const duration = Math.floor((Date.now() - heartbeatStartRef.current) / 1000);
      setHeartbeatPartner(true);
      const record: HeartbeatRecord = {
        id: Date.now().toString(),
        senderId: 'user',
        duration: Math.max(duration, 1),
        createdAt: Date.now(),
      };
      updateCoupleDiary(currentDiary.id, {
        heartbeatLog: [...(useAppStore.getState().coupleDiaries?.find(d => d.id === currentDiary.id)?.heartbeatLog || []), record]
      });
      setTimeout(() => setHeartbeatPartner(false), 2000);
      try { navigator.vibrate?.([100, 100, 100, 100, 200]); } catch {}
      // Partner pokes back sometimes
      if (Math.random() > 0.5) {
        setTimeout(() => {
          if (!currentDiary) return;
          const reply: HeartbeatRecord = {
            id: (Date.now() + 1).toString(),
            senderId: 'partner',
            duration: Math.floor(Math.random() * 3) + 1,
            createdAt: Date.now(),
          };
          updateCoupleDiary(currentDiary.id, {
            heartbeatLog: [...(useAppStore.getState().coupleDiaries?.find(d => d.id === currentDiary.id)?.heartbeatLog || []), reply]
          });
        }, 1000 + Math.random() * 2000);
      }
    }, 1000);
  };

  const stopHeartbeat = () => {
    setHeartbeating(false);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  // ── Wishlist ──

  const handleAddWish = () => {
    if (!currentDiary || !wishlistText.trim()) return;
    const item: WishlistItem = {
      id: Date.now().toString(),
      text: wishlistText.trim(),
      createdBy: 'user',
      createdAt: Date.now(),
      completed: false,
    };
    updateCoupleDiary(currentDiary.id, {
      wishlist: [...(currentDiary.wishlist || []), item]
    });
    setWishlistText('');
  };

  const handleToggleWish = (itemId: string) => {
    if (!currentDiary) return;
    updateCoupleDiary(currentDiary.id, {
      wishlist: (currentDiary.wishlist || []).map(item =>
        item.id === itemId ? { ...item, completed: !item.completed, completedAt: !item.completed ? Date.now() : undefined } : item
      )
    });
  };

  const handleDeleteWish = (itemId: string) => {
    if (!currentDiary) return;
    updateCoupleDiary(currentDiary.id, {
      wishlist: (currentDiary.wishlist || []).filter(item => item.id !== itemId)
    });
  };

  // ── Stamp Map ──

  const handleAddLocation = () => {
    if (!currentDiary || !locationName.trim()) return;
    const loc: LocationCheckin = {
      id: Date.now().toString(),
      name: locationName.trim(),
      timestamp: Date.now(),
      photo: locationPhoto || undefined,
      note: locationNote.trim() || undefined,
    };
    updateCoupleDiary(currentDiary.id, {
      locations: [...(currentDiary.locations || []), loc]
    });
    setShowAddLocation(false);
    setLocationName('');
    setLocationNote('');
    setLocationPhoto(null);
  };

  const handleDeleteLocation = (locId: string) => {
    if (!currentDiary) return;
    updateCoupleDiary(currentDiary.id, {
      locations: (currentDiary.locations || []).filter(l => l.id !== locId)
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || photos.length >= 9) return;
    
    Array.from(files).slice(0, 9 - photos.length).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file as Blob);
    });
    e.target.value = '';
  };

  const daysTogether = currentDiary && currentDiary.startDate ? differenceInDays(new Date(), new Date(currentDiary.startDate)) + 1 : 0;

  if (!currentDiary) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-pink-50 to-rose-100 dark:from-gray-900 dark:to-gray-800 z-50 absolute inset-0">
        <div className="pt-14 pb-4 px-4 flex items-center gap-4 bg-white/60 dark:bg-black/60 backdrop-blur-lg">
          <button onClick={onBack} className="p-2 text-gray-700 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">情侣日记</h1>
          </div>
          <button onClick={() => setShowInvite(true)} className="text-pink-500 font-medium">
            <Plus size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-32 h-32 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mb-6">
            <Heart size={64} className="text-pink-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">开启情侣日记</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-6">和你的另一半一起记录每一天的美好时光</p>
          <button 
            onClick={() => setShowInvite(true)}
            className="px-8 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all"
          >
            邀请另一半
          </button>
        </div>

        {showInvite && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-2xl w-full max-w-sm p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">邀请另一半</h3>
                <button onClick={() => setShowInvite(false)} className="text-gray-400">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">选择一个角色作为你的另一半</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.values(characters).filter(c => c.isDisabled !== true).map(char => (
                  <button
                    key={char.id}
                    onClick={() => handleCreateDiary(char.id)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors"
                  >
                    <div 
                      className="w-12 h-12 rounded-full"
                      style={{ background: char.avatar.startsWith('#') ? char.avatar : `url(${char.avatar}) center/cover` }}
                    />
                    <div className="text-left">
                      <div className="font-medium text-gray-800 dark:text-white">{char.name}</div>
                      <div className="text-xs text-gray-400">{char.personality?.slice(0, 20)}...</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-pink-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 z-50 absolute inset-0">
      <div className="pt-14 pb-3 px-4 bg-white/60 dark:bg-black/60 backdrop-blur-lg relative z-50">
        <div className="flex items-center justify-between mb-2 h-10">
          <button onClick={onBack} className="p-2 text-gray-700 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <div className="absolute left-1/2 transform -translate-x-1/2 text-center">
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">情侣日记</h1>
            <p className="text-xs text-pink-500">与 {partner?.name} 的故事 · 第{daysTogether}天</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSettings(true)} className="p-2 text-gray-500">
              <Settings size={20} />
            </button>
            <button onClick={() => setShowAddMenu(!showAddMenu)} className="p-2 text-pink-500 relative">
              <Plus size={24} />
            </button>
          </div>
        </div>
        
        {partner && (
          <div className="flex items-center justify-center gap-3 pb-2">
            <div 
              className="w-8 h-8 rounded-full border-2 border-white shadow"
              style={{ background: settings.wechatAvatar.startsWith('#') ? settings.wechatAvatar : `url(${settings.wechatAvatar}) center/cover` }}
            />
            <HeartIcon size={16} className="text-pink-500 fill-pink-500" />
            <div 
              className="w-8 h-8 rounded-full border-2 border-pink-200 shadow"
              style={{ background: partner.avatar.startsWith('#') ? partner.avatar : `url(${partner.avatar}) center/cover` }}
            />
          </div>
        )}

      </div>

      {showAddMenu && (
        <div className="fixed right-4 top-28 z-[100] bg-white dark:bg-gray-800 rounded-xl shadow-xl p-2 min-w-36 border border-gray-100 dark:border-gray-700">
          <button
            onClick={() => {
              setShowAddMenu(false);
              setShowNewEntry(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors"
          >
            <Edit3 size={18} className="text-pink-500" />
            写日记
          </button>
          <button
            onClick={() => {
              setShowAddMenu(false);
              setShowSpecialEventEntry(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors"
          >
            <HeartIcon size={18} className="text-pink-500" />
            特殊事件
          </button>
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          <button
            onClick={() => {
              setShowAddMenu(false);
              setShowWhisper(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors"
          >
            <MessageCircle size={18} className="text-pink-500" />
            悄悄话
          </button>
          <button
            onClick={() => {
              setShowAddMenu(false);
              setShowCapsule(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors"
          >
            <Gift size={18} className="text-pink-500" />
            时光胶囊
          </button>
          <button
            onClick={() => {
              setShowAddMenu(false);
              setShowWishlist(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors"
          >
            <CheckCircle2 size={18} className="text-pink-500" />
            心愿清单
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 relative z-0">
        {/* Feature Shortcut Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 px-1 -mx-1 max-w-md mx-auto mb-2">
          <button onClick={() => setShowGallery(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-full text-xs font-medium text-pink-600 dark:text-pink-400 whitespace-nowrap flex-shrink-0">
            <ImageIcon size={14} /> 相册
          </button>
          <button onClick={() => setShowWhisper(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-full text-xs font-medium text-pink-600 dark:text-pink-400 whitespace-nowrap flex-shrink-0">
            <MessageCircle size={14} /> 悄悄话
          </button>
          <button onClick={() => setShowCapsule(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-full text-xs font-medium text-pink-600 dark:text-pink-400 whitespace-nowrap flex-shrink-0">
            <Gift size={14} /> 时光胶囊
          </button>
          <button onClick={() => setShowHeartbeat(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-full text-xs font-medium text-pink-600 dark:text-pink-400 whitespace-nowrap flex-shrink-0">
            <HeartIcon size={14} /> 戳一戳
          </button>
          <button onClick={() => setShowStampMap(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-full text-xs font-medium text-pink-600 dark:text-pink-400 whitespace-nowrap flex-shrink-0">
            <MapPin size={14} /> 邮戳地图
          </button>
          <button onClick={() => setShowWishlist(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-full text-xs font-medium text-pink-600 dark:text-pink-400 whitespace-nowrap flex-shrink-0">
            <CheckCircle2 size={14} /> 心愿清单
          </button>
          <button onClick={() => setShowTimeline(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-full text-xs font-medium text-pink-600 dark:text-pink-400 whitespace-nowrap flex-shrink-0">
            <Timer size={14} /> 时间轴
          </button>
        </div>
        {currentDiary.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <HeartIcon size={48} className="text-pink-300 mb-3" />
            <p className="text-gray-500">还没有日记，</p>
            <p className="text-gray-500">点击右上角 + 开始记录</p>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-4">
            {currentDiary.entries.sort((a, b) => b.createdAt - a.createdAt).map(item => {
              const isOwnEntry = item.authorId === 'user';
              const event = item.eventId ? currentDiary.specialEvents?.find(e => e.id === item.eventId) : null;
              return (
                <div 
                  key={item.id} 
                  className="rounded-2xl p-4 shadow-sm relative group z-10"
                  style={{ backgroundColor: item.backgroundColor || '#ffffff' }}
                >
                  {event && (
                    <div 
                      className="absolute top-0 left-0 right-0 h-2 rounded-t-2xl"
                      style={{ backgroundColor: event.color }}
                    />
                  )}
                  <div className="flex items-center justify-between mb-3 mt-1 relative z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div 
                        className="w-6 h-6 rounded-full"
                        style={{ 
                          background: item.authorId === 'user' 
                            ? (settings.wechatAvatar.startsWith('#') ? settings.wechatAvatar : `url(${settings.wechatAvatar}) center/cover`)
                            : (partner?.avatar.startsWith('#') ? partner.avatar : `url(${partner.avatar}) center/cover`)
                        }}
                      />
                      <span className="text-sm font-medium text-gray-800 dark:text-white">
                        {item.authorId === 'user' ? '我' : partner?.name}
                      </span>
                      {event ? (
                        <span 
                          className="text-xs font-medium px-2 py-0.5 rounded-full border"
                          style={{ 
                            backgroundColor: event.color,
                            borderColor: event.color,
                            color: '#fff'
                          }}
                        >
                          ★ {event.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{format(item.createdAt, 'MM月dd日 HH:mm')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {isOwnEntry && (
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="p-1.5 opacity-100 transition-opacity bg-red-100/80 dark:bg-red-900/30 text-red-500 rounded-full hover:bg-red-200 dark:hover:bg-red-800/40"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {item.weather && (
                        <span className="text-xs text-gray-500">{item.weather}</span>
                      )}
                      {item.moods?.map((mood, i) => (
                        <span key={i} className="text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full">
                          {mood}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2 relative z-10">{item.title}</h3>
                  
                  {item.photos?.length > 0 && (
                    <div className={`grid gap-1 mb-3 ${item.photos.length === 1 ? 'grid-cols-1' : item.photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {item.photos.map((photo, i) => (
                        <img key={i} src={photo} alt="" className="w-full h-32 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                  
                  <div className="relative z-10">
                    {(() => {
                      const needsTruncation = item.content.length > 120 || item.content.split('\n').length > 6;
                      if (needsTruncation) {
                        return <>
                          <div className={`transition-all overflow-hidden ${expandedEntries.has(item.id) ? '' : 'max-h-24'}`}>
                            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{item.content}</p>
                          </div>
                          {!expandedEntries.has(item.id) && (
                            <div className="absolute bottom-6 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-gray-800 via-white/80 dark:via-gray-800/80 to-transparent pointer-events-none" />
                          )}
                          <button
                            onClick={() => toggleExpanded(item.id)}
                            className="w-full flex items-center justify-center gap-1 pt-1 text-xs text-pink-500 hover:text-pink-600 transition-colors"
                          >
                            {expandedEntries.has(item.id) ? (
                              <><ChevronUp size={14} /> 收起</>
                            ) : (
                              <><ChevronDown size={14} /> 展开全部</>
                            )}
                          </button>
                        </>;
                      }
                      return <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{item.content}</p>;
                    })()}
                  </div>

                  {item.eventId && (() => {
                    const evt = currentDiary.specialEvents?.find(e => e.id === item.eventId);
                    if (!evt) return null;
                    return (
                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 relative z-10">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: evt.color }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          💝 {evt.name}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-2xl w-full max-w-xs p-6`}>
            <h3 className="text-lg font-bold mb-2">确认删除</h3>
            <p className="text-gray-500 mb-4">确定要删除这条日记吗？此操作无法撤销。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 rounded-full"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteEntry(deleteConfirm)}
                className="flex-1 py-2 bg-red-500 text-white rounded-full"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end">
          <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl w-full p-6 max-h-[80vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Clock size={16} />
                {partner?.name}写日记频率
              </h4>
              <div className="flex gap-2">
                {[
                  { key: 'off', label: '关闭' },
                  { key: 'low', label: '低' },
                  { key: 'medium', label: '中' },
                  { key: 'high', label: '高' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => handleFrequencyChange(f.key as any)}
                    className={`flex-1 py-2 rounded-full text-sm ${
                      frequency === f.key 
                        ? 'bg-pink-500 text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowReminderPage(true)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center">
                  <Calendar size={20} className="text-pink-500" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200">纪念日提醒</div>
                  <div className="text-xs text-gray-500">管理和设置纪念日</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </button>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center justify-between">
                <span>起始日期</span>
                {!editStartDate && (
                  <button onClick={() => {
                    setEditStartDate(true);
                    if (currentDiary.startDate) {
                      setStartDateValue(format(currentDiary.startDate, 'yyyy-MM-dd'));
                    }
                  }} className="text-xs text-pink-500">
                    <Edit3 size={14} /> 编辑
                  </button>
                )}
              </h4>
              {editStartDate ? (
                <div className="space-y-3">
                  <input
                    type="date"
                    value={startDateValue}
                    onChange={e => setStartDateValue(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'} outline-none`}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditStartDate(false);
                        setStartDateValue('');
                      }}
                      className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleUpdateStartDate}
                      disabled={!startDateValue}
                      className="flex-1 py-2 bg-pink-500 text-white rounded-full text-sm disabled:opacity-50"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {currentDiary.startDate ? format(currentDiary.startDate, 'yyyy年MM月dd日') : '未设置'} · 已在一起 {daysTogether} 天
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddReminder && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-end">
          <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl w-full p-6`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{editingReminder ? '编辑纪念日' : '新增纪念日提醒'}</h3>
              <button onClick={() => {
                setShowAddReminder(false);
                setEditingReminder(null);
                setNewReminderName('');
                setNewReminderDate('');
                setNewReminderNotifyBefore(3);
              }} className="text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-2 block">纪念日名称</label>
                <input
                  type="text"
                  value={newReminderName}
                  onChange={e => setNewReminderName(e.target.value)}
                  placeholder="如：生日、纪念日..."
                  className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'} outline-none`}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">日期</label>
                <input
                  type="date"
                  value={newReminderDate}
                  onChange={e => setNewReminderDate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'} outline-none`}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">提前提醒天数</label>
                <div className="flex gap-2">
                  {[1, 3, 5, 7].map(days => (
                    <button
                      key={days}
                      onClick={() => setNewReminderNotifyBefore(days)}
                      className={`flex-1 py-2 rounded-full text-sm ${
                        newReminderNotifyBefore === days 
                          ? 'bg-pink-500 text-white' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                      }`}
                    >
                      {days}天
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddReminder(false);
                    setEditingReminder(null);
                    setNewReminderName('');
                    setNewReminderDate('');
                    setNewReminderNotifyBefore(3);
                  }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 rounded-full"
                >
                  取消
                </button>
                <button
                  onClick={editingReminder ? handleUpdateReminder : handleAddReminder}
                  disabled={!newReminderName.trim() || !newReminderDate}
                  className="flex-1 py-3 bg-pink-500 text-white rounded-full disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReminderPage && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setShowReminderPage(false)} className="p-2 text-gray-700 dark:text-gray-200">
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1 text-center">
              <h2 className="font-bold">纪念日提醒</h2>
            </div>
            <button 
              onClick={() => {
                setEditingReminder(null);
                setNewReminderName('');
                setNewReminderDate('');
                setNewReminderNotifyBefore(3);
                setShowAddReminder(true);
              }}
              className="text-pink-500 font-medium flex items-center gap-1"
            >
              <Plus size={20} />
              新增
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {((currentDiary.reminders && currentDiary.reminders.length > 0 ? currentDiary.reminders : [
              { id: '1', type: 'anniversary' as const, name: '纪念日', days: [52, 100, 365], notifyBefore: 3, enabled: true },
              { id: '2', type: 'holiday' as const, name: '情人节', days: [0], notifyBefore: 7, enabled: true },
              { id: '3', type: 'holiday' as const, name: '七夕', days: [0], notifyBefore: 7, enabled: true },
              { id: '4', type: 'holiday' as const, name: '520', days: [0], notifyBefore: 3, enabled: true },
              { id: '5', type: 'holiday' as const, name: '圣诞节', days: [0], notifyBefore: 7, enabled: true },
            ]) as any[]).map(reminder => (
              <div key={reminder.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{reminder.name}</span>
                    {reminder.month && reminder.day && (
                      <span className="text-xs text-gray-500">{reminder.month}月{reminder.day}日</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    提前{reminder.notifyBefore}天提醒
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleReminder(reminder.id)}
                    className="relative w-10 h-5 rounded-full transition-colors"
                    style={{ backgroundColor: reminder.enabled ? '#ec4899' : '#9ca3af' }}
                  >
                    <div 
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                      style={{ transform: reminder.enabled ? 'translateX(20px)' : 'translateX(2px)' }}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setEditingReminder(reminder);
                      setNewReminderName(reminder.name);
                      setNewReminderDate(reminder.month ? `${new Date().getFullYear()}-${String(reminder.month).padStart(2, '0')}-${String(reminder.day).padStart(2, '0')}` : '');
                      setNewReminderNotifyBefore(reminder.notifyBefore);
                      setShowAddReminder(true);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteReminder(reminder.id)}
                    className="p-2 text-red-400 hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSpecialEvents && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end">
          <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl w-full p-6 max-h-[80vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">特殊事件</h3>
              <button onClick={() => setShowSpecialEvents(false)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>

            {currentDiary.specialEvents?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">还没有特殊事件</p>
                <p className="text-xs text-gray-400 mt-2">在写日记页面创建特殊事件</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentDiary.specialEvents?.map(event => {
                  const eventDate = parseISO(event.date);
                  const daysUntil = differenceInDays(eventDate, new Date());
                  return (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ backgroundColor: event.color }}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{event.name}</div>
                        <div className="text-xs text-gray-500">
                          {format(eventDate, 'yyyy年MM月dd日')}
                          {daysUntil >= 0 ? ` · ${daysUntil}天后` : ` · ${Math.abs(daysUntil)}天前`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleEventReminder(event.id)}
                          className="relative w-10 h-5 rounded-full transition-colors"
                          style={{ backgroundColor: (event.enabled !== false) ? '#ec4899' : '#9ca3af' }}
                        >
                          <div 
                            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                            style={{ transform: (event.enabled !== false) ? 'translateX(20px)' : 'translateX(2px)' }}
                          />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="p-2 text-red-400 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => {
              setShowNewEntry(false);
              setSelectedEventId(null);
            }} className="p-2 text-gray-700 dark:text-gray-200">取消</button>
            <div className="flex-1 text-center">
              <h2 className="font-bold">{selectedEventId ? (currentDiary.specialEvents?.find(e => e.id === selectedEventId)?.name || '写日记') : '写日记'}</h2>
            </div>
            <button 
              onClick={handleAddEntry}
              disabled={!entryContent.trim() && photos.length === 0}
              className="text-pink-500 font-medium disabled:opacity-50"
            >
              发布
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <input
              type="text"
              value={entryTitle}
              onChange={e => setEntryTitle(e.target.value)}
              placeholder="标题（选填）"
              className="w-full text-lg font-bold bg-transparent outline-none mb-4 placeholder-gray-300"
            />

            <textarea
              value={entryContent}
              onChange={e => setEntryContent(e.target.value)}
              placeholder="记录今天的美好..."
              className="w-full h-40 bg-transparent outline-none resize-none text-sm placeholder-gray-300"
            />

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">天气</span>
              </div>
              <div className="flex gap-2">
                {WEATHER.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedWeather(selectedWeather === i ? null : i)}
                    className={`p-2 rounded-lg ${selectedWeather === i ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                  >
                    <w.icon size={20} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">心情</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {MOODS.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedMood(selectedMood === i ? null : i)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${selectedMood === i ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}
                  >
                    <m.icon size={14} style={{ color: m.color }} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">背景颜色</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_COLORS.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBgColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${selectedBgColor === color ? 'border-pink-500' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">照片（{photos.length}/9）</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img src={photo} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {photos.length < 9 && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer"
                  >
                    <Camera size={24} />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {showSpecialEventEntry && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => {
              setShowSpecialEventEntry(false);
            }} className="p-2 text-gray-700 dark:text-gray-200">取消</button>
            <div className="flex-1 text-center">
              <h2 className="font-bold">特殊事件</h2>
            </div>
            <button 
              onClick={handleAddSpecialEventEntry}
              disabled={!entryContent.trim() && photos.length === 0 || !specialEventName.trim()}
              className="text-pink-500 font-medium disabled:opacity-50"
            >
              发布
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">事件名称</span>
              </div>
              <input
                type="text"
                value={specialEventName}
                onChange={e => setSpecialEventName(e.target.value)}
                placeholder="如：生日、纪念日、春节..."
                className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'} outline-none`}
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">事件颜色</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_COLORS.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setSpecialEventColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${specialEventColor === color ? 'border-pink-500' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <input
              type="text"
              value={entryTitle}
              onChange={e => setEntryTitle(e.target.value)}
              placeholder="标题（选填）"
              className="w-full text-lg font-bold bg-transparent outline-none mb-4 placeholder-gray-300"
            />

            <textarea
              value={entryContent}
              onChange={e => setEntryContent(e.target.value)}
              placeholder="记录今天的美好..."
              className="w-full h-40 bg-transparent outline-none resize-none text-sm placeholder-gray-300"
            />

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">天气</span>
              </div>
              <div className="flex gap-2">
                {WEATHER.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedWeather(selectedWeather === i ? null : i)}
                    className={`p-2 rounded-lg ${selectedWeather === i ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                  >
                    <w.icon size={20} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">心情</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {MOODS.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedMood(selectedMood === i ? null : i)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${selectedMood === i ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}
                  >
                    <m.icon size={14} style={{ color: m.color }} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">背景颜色</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_COLORS.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBgColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${selectedBgColor === color ? 'border-pink-500' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">照片（{photos.length}/9）</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img src={photo} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {photos.length < 9 && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer"
                  >
                    <Camera size={24} />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {showGallery && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setShowGallery(false)} className="p-2 text-gray-700 dark:text-gray-200"><ChevronLeft size={24} /></button>
            <div className="flex-1 text-center"><h2 className="font-bold">相册</h2></div>
            <label className="text-pink-500 cursor-pointer flex items-center gap-1 text-sm">
              <Camera size={18} /> 上传
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const files = e.target.files;
                if (!files || !currentDiary) return;
                Array.from(files).forEach((f: File) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    updateCoupleDiary(currentDiary.id, {
                      galleryPhotos: [...(useAppStore.getState().coupleDiaries?.find(d => d.id === currentDiary.id)?.galleryPhotos || []), reader.result as string]
                    });
                  };
                  reader.readAsDataURL(f);
                });
                e.target.value = '';
              }} />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {(() => {
              const entryPhotos = currentDiary.entries.flatMap((e: CoupleDiaryEntry) => e.photos || []);
              const galleryPhotos = currentDiary.galleryPhotos || [];
              const allPhotos = [...galleryPhotos, ...entryPhotos];
              if (allPhotos.length === 0) return <div className="flex flex-col items-center justify-center h-full text-gray-400"><ImageIcon size={48} className="mb-3" /><p>还没有照片</p><p className="text-xs mt-1">点击右上角上传照片</p></div>;
              return <div className="grid grid-cols-3 gap-2">{allPhotos.map((photo: string, i: number) => {
                const isPartnerPhoto = typeof photo === 'string' && photo.startsWith('partner_gallery_');
                let desc = '';
                let palette = '#fce4ec';
                if (isPartnerPhoto) {
                  try {
                    const stored = JSON.parse(localStorage.getItem('cp_gallery_descs_' + currentDiary.partnerId) || '{}');
                    const data = stored[photo];
                    if (data) { desc = data.description || ''; palette = data.palette || '#fce4ec'; }
                  } catch {}
                }
                return <div key={i} className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer" onClick={() => setGalleryTapPhoto({ key: photo, index: i })}>
                  {isPartnerPhoto ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center overflow-y-auto" style={{ backgroundColor: palette }}>
                      <span className="text-[11px] font-medium text-gray-600 leading-tight">{desc || '分享了一张照片'}</span>
                    </div>
                  ) : (
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  )}
                  <button onClick={e => { e.stopPropagation(); if (!currentDiary) return; const isGalleryPhoto = i < galleryPhotos.length; if (isGalleryPhoto) { const updated = (useAppStore.getState().coupleDiaries?.find(d => d.id === currentDiary.id)?.galleryPhotos || []).filter((_: string, idx: number) => idx !== i); updateCoupleDiary(currentDiary.id, { galleryPhotos: updated }); } }} className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                </div>;
              })}</div>;
            })()}
          </div>

          {galleryTapPhoto && (() => {
            const { key, index } = galleryTapPhoto;
            const isPartnerPhoto = key.startsWith('partner_gallery_');
            let desc = '';
            let caption = '';
            let palette = '#fce4ec';
            const storedCaptions = JSON.parse(localStorage.getItem('cp_gallery_captions_' + currentDiary.id) || '{}');
            if (isPartnerPhoto) {
              try {
                const stored = JSON.parse(localStorage.getItem('cp_gallery_descs_' + currentDiary.partnerId) || '{}');
                const data = stored[key];
                if (data) { desc = data.description || ''; caption = data.caption || ''; palette = data.palette || '#fce4ec'; }
              } catch {}
            } else {
              caption = storedCaptions[key] || '';
            }
            const gPhotos = useAppStore.getState().coupleDiaries?.find(d => d.id === currentDiary?.id)?.galleryPhotos || [];
            const isGalleryPhotoIdx = index < gPhotos.length;
            const handleDelete = () => {
              if (!currentDiary || isPartnerPhoto) return;
              if (!confirm('确定删除这张照片吗？')) return;
              const current = useAppStore.getState().coupleDiaries?.find(d => d.id === currentDiary.id)?.galleryPhotos || [];
              const updated = current.filter((_: string, idx: number) => idx !== index);
              updateCoupleDiary(currentDiary.id, { galleryPhotos: updated });
              setGalleryTapPhoto(null);
            };
            return (
              <div className="fixed inset-0 z-[200] bg-black/50 flex items-end" onClick={() => setGalleryTapPhoto(null)}>
                <div className="w-full bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh' }}>
                  <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b dark:border-gray-800">
                    <span className="text-sm font-medium text-gray-500">{isPartnerPhoto ? (partner?.name || '对方') : '我'} 的照片</span>
                    <div className="flex items-center gap-2">
                      {!isPartnerPhoto && isGalleryPhotoIdx && (
                        <button onClick={handleDelete} className="p-1 text-red-400 hover:text-red-500"><Trash2 size={18} /></button>
                      )}
                      <button onClick={() => setGalleryTapPhoto(null)} className="p-1 text-gray-400"><X size={20} /></button>
                    </div>
                  </div>
                  <div className="overflow-y-auto p-4 space-y-4">
                    {isPartnerPhoto ? (
                      <div className="w-full aspect-square rounded-xl flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: palette }}>
                        <span className="text-base font-medium text-gray-600 leading-relaxed">{desc}</span>
                      </div>
                    ) : (
                      <div className="w-full flex justify-center">
                        <img src={key} alt="" className="max-w-full rounded-xl" style={{ maxHeight: '50vh', objectFit: 'contain' }} />
                      </div>
                    )}
                    {isPartnerPhoto ? (
                      caption ? (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                          <p className="text-sm text-gray-700 dark:text-gray-200">{caption}</p>
                          <p className="text-xs text-gray-400 mt-1">—— {partner?.name}</p>
                        </div>
                      ) : null
                    ) : (
                      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                        <input
                          type="text"
                          placeholder="写一句话..."
                          value={caption}
                          onChange={e => {
                            const newCaps = { ...storedCaptions, [key]: e.target.value };
                            localStorage.setItem('cp_gallery_captions_' + currentDiary.id, JSON.stringify(newCaps));
                            setGalleryTick(t => t + 1);
                          }}
                          className="flex-1 text-sm bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
                          maxLength={60}
                        />
                        {caption && (
                          <button onClick={() => {
                            const newCaps = { ...storedCaptions, [key]: '' };
                            localStorage.setItem('cp_gallery_captions_' + currentDiary.id, JSON.stringify(newCaps));
                            setGalleryTick(t => t + 1);
                          }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {showWhisper && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setShowWhisper(false)} className="p-2 text-gray-700 dark:text-gray-200"><ChevronLeft size={24} /></button>
            <div className="flex-1 text-center"><h2 className="font-bold">悄悄话</h2></div>
            <div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(() => {
              const now = Date.now();
              const visibleWhispers = (currentDiary.whispers || []).filter(w => !w.scheduledFor || w.scheduledFor <= now);
              return visibleWhispers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageCircle size={48} className="mb-3" /><p>还没有悄悄话</p><p className="text-xs mt-1">发送第一条悄悄话吧~</p>
                </div>
              ) : (
                <>
                  {visibleWhispers.map((msg: WhisperMessage) => (
                    <div key={msg.id} className={`flex ${msg.senderId === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${msg.senderId === 'user' ? 'bg-pink-500 text-white rounded-br-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'}`}>
                        <p>{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${msg.senderId === 'user' ? 'text-pink-200' : 'text-gray-400'}`}>
                          {format(msg.createdAt, 'MM/dd HH:mm')}{msg.readAt ? ' · 已读' : ''}{msg.scheduledFor ? ' · 定时' : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={whisperEndRef} />
                </>
              );
            })()}
          </div>
          <div className="p-4 border-t dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex gap-2">
              <input type="text" value={whisperText} onChange={e => setWhisperText(e.target.value)} placeholder="说点什么..." className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm outline-none" onKeyDown={e => e.key === 'Enter' && handleSendWhisper()} />
              <button onClick={() => setShowScheduler(!showScheduler)} className={`p-2.5 ${showScheduler || whisperScheduledDate ? 'text-pink-500' : 'text-gray-400 hover:text-gray-600'}`}><Clock size={20} /></button>
              <button onClick={handleSendWhisper} disabled={!whisperText.trim()} className="p-2.5 bg-pink-500 text-white rounded-full disabled:opacity-50"><Send size={20} /></button>
            </div>
            {showScheduler && (
              <div className="flex items-center gap-2 mt-2 px-2">
                <input type="datetime-local" value={whisperScheduledDate || ''} onChange={e => setWhisperScheduledDate(e.target.value)} className="flex-1 text-xs px-2 py-1.5 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none" />
                {whisperScheduledDate && <button onClick={() => { setWhisperScheduledDate(''); setShowScheduler(false); }} className="text-gray-400"><X size={14} /></button>}
              </div>
            )}
            {!showScheduler && whisperScheduledDate && (
              <div className="flex items-center gap-2 mt-2 px-2">
                <Clock size={12} className="text-gray-400" />
                <span className="text-xs text-gray-400">定时发送: {new Date(whisperScheduledDate).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <button onClick={() => { setWhisperScheduledDate(''); setShowScheduler(false); }} className="text-gray-400"><X size={12} /></button>
              </div>
            )}
          </div>
        </div>
      )}

      {showCapsule && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setShowCapsule(false)} className="p-2 text-gray-700 dark:text-gray-200"><ChevronLeft size={24} /></button>
            <div className="flex-1 text-center"><h2 className="font-bold">时光胶囊</h2></div>
            <button onClick={() => { setShowNewCapsule(true); }} className="text-pink-500"><Plus size={24} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {(currentDiary.timeCapsules || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Gift size={48} className="mb-3" /><p>还没有时光胶囊</p>
                <button onClick={() => { setShowNewCapsule(true); }} className="mt-4 px-6 py-2 bg-pink-500 text-white rounded-full text-sm">创建第一个</button>
              </div>
            ) : (
              <div className="space-y-3">
                {(currentDiary.timeCapsules || []).map((capsule: TimeCapsule) => {
                  const canOpen = !capsule.locked || capsule.openAt <= Date.now();
                  return (
                    <div key={capsule.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm">{capsule.title}</h3>
                        {capsule.locked ? (
                          canOpen ? <button onClick={() => handleOpenCapsule(capsule)} className="text-pink-500 text-xs flex items-center gap-1"><Unlock size={14} /> 开启</button>
                            : <span className="text-xs text-gray-400 flex items-center gap-1"><Lock size={14} /> {Math.ceil((capsule.openAt - Date.now()) / (1000 * 60 * 60 * 24))}天后</span>
                        ) : (
                          <button onClick={() => setViewingCapsule(capsule)} className="text-xs text-green-500 flex items-center gap-1"><Unlock size={14} /> 查看</button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">创建于 {format(capsule.createdAt, 'yyyy年MM月dd日')}</p>
                      {capsule.openedAt && <p className="text-xs text-gray-400 mt-1">开启于 {format(capsule.openedAt, 'yyyy年MM月dd日 HH:mm')}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showNewCapsule && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => { setShowNewCapsule(false); }} className="p-2 text-gray-700 dark:text-gray-200"><ChevronLeft size={24} /></button>
            <div className="flex-1 text-center"><h2 className="font-bold">创建时光胶囊</h2></div>
            <button onClick={handleCreateCapsule} disabled={!capsuleTitle.trim() || !capsuleOpenDate} className="text-pink-500 font-medium disabled:opacity-50">保存</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div><label className="text-xs text-gray-500 mb-2 block">标题</label><input type="text" value={capsuleTitle} onChange={e => setCapsuleTitle(e.target.value)} placeholder="给未来的一封信..." className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm outline-none" /></div>
            <div><label className="text-xs text-gray-500 mb-2 block">内容</label><textarea value={capsuleContent} onChange={e => setCapsuleContent(e.target.value)} placeholder="写下想对未来说的话..." className="w-full h-32 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm outline-none resize-none" /></div>
            <div><label className="text-xs text-gray-500 mb-2 block">开启日期</label><input type="date" value={capsuleOpenDate} onChange={e => setCapsuleOpenDate(e.target.value)} className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm outline-none" /></div>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">照片（选填）</label>
              <div className="flex flex-wrap gap-2">
                {capsulePhotos.map((photo, i) => (
                  <div key={i} className="relative w-16 h-16">
                    <img src={photo} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button onClick={() => setCapsulePhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={10} /></button>
                  </div>
                ))}
                {capsulePhotos.length < 3 && <div onClick={() => capsuleFileInputRef.current?.click()} className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer"><Camera size={20} /></div>}
              </div>
              <input ref={capsuleFileInputRef} type="file" accept="image/*" multiple onChange={handleCapsulePhotoUpload} className="hidden" />
            </div>
          </div>
        </div>
      )}

      {viewingCapsule && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setViewingCapsule(null)} className="p-2 text-gray-700 dark:text-gray-200"><ChevronLeft size={24} /></button>
            <div className="flex-1 text-center"><h2 className="font-bold">{viewingCapsule.title}</h2></div>
            <div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {viewingCapsule.photos?.map((photo, i) => <img key={i} src={photo} alt="" className="w-full rounded-xl mb-4" />)}
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{viewingCapsule.content}</p>
            <p className="text-xs text-gray-400 mt-4">创建于 {format(viewingCapsule.createdAt, 'yyyy年MM月dd日')} · 开启于 {viewingCapsule.openedAt ? format(viewingCapsule.openedAt, 'yyyy年MM月dd日 HH:mm') : '未开启'}</p>
          </div>
        </div>
      )}

      {showHeartbeat && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setShowHeartbeat(false)} className="p-2 text-gray-700 dark:text-gray-200"><ChevronLeft size={24} /></button>
            <div className="flex-1 text-center"><h2 className="font-bold">戳一戳</h2></div>
            <div className="w-10" />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-col items-center justify-center pt-6 pb-4 px-8 border-b dark:border-gray-800">
              <p className="text-gray-500 text-sm mb-4">长按按钮向{partner?.name}发送心跳提醒</p>
              <button
                onMouseDown={startHeartbeat} onMouseUp={stopHeartbeat} onMouseLeave={stopHeartbeat}
                onTouchStart={startHeartbeat} onTouchEnd={stopHeartbeat}
                className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-150 select-none ${heartbeating ? 'bg-pink-500 scale-110 shadow-2xl shadow-pink-500/50' : 'bg-pink-100 dark:bg-pink-900/30 scale-100 shadow-lg'}`}
              >
                <HeartIcon size={56} className={`transition-all duration-150 ${heartbeating ? 'text-white fill-white animate-pulse' : 'text-pink-500'}`} />
              </button>
              {heartbeatPartner && <div className="mt-3 animate-fade-in text-center"><div className="text-lg mb-1">💓</div><p className="text-pink-500 font-medium text-sm">{partner?.name}收到了你的心跳！</p></div>}
              <p className="text-xs text-gray-400 mt-3">长按1秒以上发送心跳</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-medium text-gray-500 mb-3">戳一戳记录</h3>
              {(currentDiary.heartbeatLog || []).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">还没有记录</p>
              ) : (
                <div className="space-y-2">
                  {[...(currentDiary.heartbeatLog || [])].reverse().map((h: HeartbeatRecord) => (
                    <div key={h.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-pink-100 dark:bg-pink-900/30">
                        <HeartIcon size={14} className="text-pink-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                          <span className="font-medium">{h.senderId === 'user' ? '我' : partner?.name}</span> 戳了你
                        </p>
                        <p className="text-xs text-gray-400">
                          持续 {h.duration}秒 · {format(h.createdAt, 'MM/dd HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showStampMap && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setShowStampMap(false)} className="p-2 text-gray-700 dark:text-gray-200"><ChevronLeft size={24} /></button>
            <div className="flex-1 text-center"><h2 className="font-bold">邮戳地图</h2></div>
            <button onClick={() => setShowAddLocation(true)} className="text-pink-500"><MapPin size={24} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {(currentDiary.locations || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <MapPin size={48} className="mb-3" /><p>还没有去过的地方</p>
                <button onClick={() => setShowAddLocation(true)} className="mt-4 px-6 py-2 bg-pink-500 text-white rounded-full text-sm">添加地点</button>
              </div>
            ) : (
              <div className="space-y-3">
                {[...(currentDiary.locations || [])].sort((a: LocationCheckin, b: LocationCheckin) => b.timestamp - a.timestamp).map((loc: LocationCheckin) => (
                  <div key={loc.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><MapPin size={20} className="text-pink-500" /></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{loc.name}</p>
                          <p className="text-xs text-gray-400">{format(loc.timestamp, 'yyyy年MM月dd日 HH:mm')}</p>
                          {loc.note && <p className="text-xs text-gray-500 mt-1.5">{loc.note}</p>}
                          {loc.photo && <img src={loc.photo} alt="" className="w-full h-32 object-cover rounded-lg mt-2" />}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteLocation(loc.id)} className="p-2 text-red-400 hover:text-red-500 flex-shrink-0"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddLocation && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-end">
          <div className="bg-white dark:bg-gray-900 rounded-t-3xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">添加地点</h3>
              <button onClick={() => { setShowAddLocation(false); setLocationPhoto(null); }} className="text-gray-400"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-2 block">地点名称</label>
                <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="如：中央公园、海边餐厅..." className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">做了什么（选填）</label>
                <textarea value={locationNote} onChange={e => setLocationNote(e.target.value)} placeholder="记录在这里的美好时光..." className="w-full h-20 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm outline-none resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">照片（选填）</label>
                {locationPhoto ? (
                  <div className="relative w-24 h-24">
                    <img src={locationPhoto} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button onClick={() => setLocationPhoto(null)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={14} /></button>
                  </div>
                ) : (
                  <div onClick={() => locationFileInputRef.current?.click()} className="w-24 h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer">
                    <Camera size={24} />
                  </div>
                )}
                <input ref={locationFileInputRef} type="file" accept="image/*" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = () => setLocationPhoto(reader.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }} className="hidden" />
              </div>
              <button onClick={handleAddLocation} disabled={!locationName.trim()} className="w-full py-3 bg-pink-500 text-white rounded-full font-medium disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}

      {showWishlist && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setShowWishlist(false)} className="p-2 text-gray-700 dark:text-gray-200"><ChevronLeft size={24} /></button>
            <div className="flex-1 text-center"><h2 className="font-bold">心愿清单</h2></div>
            <div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex gap-2 mb-4">
              <input type="text" value={wishlistText} onChange={e => setWishlistText(e.target.value)} placeholder="新增心愿..." className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm outline-none" onKeyDown={e => e.key === 'Enter' && handleAddWish()} />
              <button onClick={handleAddWish} disabled={!wishlistText.trim()} className="px-4 py-2.5 bg-pink-500 text-white rounded-full text-sm disabled:opacity-50">添加</button>
            </div>
            {(currentDiary.wishlist || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400"><CheckCircle2 size={36} className="mb-2" /><p className="text-sm">许下一个心愿吧~</p></div>
            ) : (
              <div className="space-y-2">
                {(currentDiary.wishlist || []).map((item: WishlistItem) => (
                  <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl ${item.completed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <button onClick={() => handleToggleWish(item.id)} className="flex-shrink-0">{item.completed ? <CheckCircle2 size={22} className="text-green-500" /> : <Circle size={22} className="text-gray-400" />}</button>
                    <div className="flex-1"><p className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{item.text}</p><p className="text-xs text-gray-400 mt-0.5">{item.createdBy === 'user' ? '我' : partner?.name} · {format(item.createdAt, 'MM/dd')}</p></div>
                    <button onClick={() => handleDeleteWish(item.id)} className="p-1.5 text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showTimeline && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setShowTimeline(false)} className="p-2 text-gray-700 dark:text-gray-200"><ChevronLeft size={24} /></button>
            <div className="flex-1 text-center"><h2 className="font-bold">情感时间轴</h2></div>
            <div className="w-10" />
          </div>
          <div className="px-4 py-3 border-b dark:border-gray-800">
            <div className="flex gap-2 items-center">
              <input type="date" value={timelineStartDate} onChange={e => setTimelineStartDate(e.target.value)} className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs outline-none" />
              <span className="text-gray-400">~</span>
              <input type="date" value={timelineEndDate} onChange={e => setTimelineEndDate(e.target.value)} className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {(() => {
              let filtered = currentDiary.entries;
              if (timelineStartDate) { const start = new Date(timelineStartDate).getTime(); filtered = filtered.filter(e => e.createdAt >= start); }
              if (timelineEndDate) { const end = new Date(timelineEndDate).getTime() + 86400000; filtered = filtered.filter(e => e.createdAt <= end); }
              filtered = [...filtered].sort((a, b) => a.createdAt - b.createdAt);
              if (filtered.length === 0) return <div className="flex flex-col items-center justify-center h-40 text-gray-400"><Timer size={36} className="mb-2" /><p className="text-sm">没有找到相关日记</p></div>;
              return (
                <div className="relative">
                  <div className="absolute left-[17px] top-0 bottom-0 w-0.5 bg-pink-200 dark:bg-pink-900/50" />
                  {filtered.map((entry, i) => (
                    <div key={entry.id} className="relative flex gap-4 pb-6">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center z-10"><HeartIcon size={14} className="text-pink-500" /></div>
                      <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">{format(entry.createdAt, 'yyyy年MM月dd日 HH:mm')} · {entry.authorId === 'user' ? '我' : partner?.name}</p>
                        <h4 className="text-sm font-medium mb-1">{entry.title}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{entry.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {reminderNotification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[200] animate-slide-down">
          <div className="bg-gray-900 text-white rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[320px]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-300 mb-1">情侣日记</div>
                <div className="text-base font-medium">{reminderNotification.title}</div>
                <div className="text-sm text-gray-400 mt-1">{reminderNotification.message}</div>
              </div>
              <button
                onClick={() => setReminderNotification(null)}
                className="text-gray-500 hover:text-gray-300 p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
              <button
                onClick={() => {
                  setReminderNotification(null);
                  setShowReminderPage(true);
                }}
                className="flex-1 py-2 bg-pink-500 rounded-lg text-sm font-medium"
              >
                查看详情
              </button>
              <button
                onClick={() => setReminderNotification(null)}
                className="flex-1 py-2 bg-gray-700 rounded-lg text-sm font-medium"
              >
                稍后
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
