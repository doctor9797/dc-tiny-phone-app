import { useState } from 'react';

const STORAGE_PREFIX = 'phone_data_';

export interface PhoneSettings {
  passcode: string;
  lockscreenWallpaper: string;
  homeWallpaper: string;
}

const DEFAULTS: PhoneSettings = {
  passcode: '',
  lockscreenWallpaper: '',
  homeWallpaper: '',
};

function loadSettings(characterId: string, charAvatar?: string, charBg?: string): PhoneSettings {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + characterId);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...getDefaultWallpapers(charAvatar, charBg), ...parsed };
    }
  } catch {}
  return { ...getDefaultWallpapers(charAvatar, charBg), passcode: '' };
}

function getDefaultWallpapers(charAvatar?: string, charBg?: string): Pick<PhoneSettings, 'lockscreenWallpaper' | 'homeWallpaper'> {
  // Use character's avatar color as lock screen, background as home screen
  const lockWall = charAvatar?.startsWith('#') ? charAvatar : '#1a1a2e';
  const homeWall = charBg?.startsWith('#') ? charBg : '#1a1a2e';
  return { lockscreenWallpaper: lockWall, homeWallpaper: homeWall };
}

function saveSettings(characterId: string, settings: PhoneSettings) {
  localStorage.setItem(STORAGE_PREFIX + characterId, JSON.stringify(settings));
}

export function useCharPhoneSettings(characterId: string, charAvatar?: string, charBg?: string) {
  const [settings, setSettingsState] = useState<PhoneSettings>(() =>
    loadSettings(characterId, charAvatar, charBg)
  );

  const setPasscode = (val: string) => {
    setSettingsState(prev => {
      const next = { ...prev, passcode: val };
      saveSettings(characterId, next);
      return next;
    });
  };

  const setLockWall = (val: string) => {
    setSettingsState(prev => {
      const next = { ...prev, lockscreenWallpaper: val };
      saveSettings(characterId, next);
      return next;
    });
  };

  const setHomeWall = (val: string) => {
    setSettingsState(prev => {
      const next = { ...prev, homeWallpaper: val };
      saveSettings(characterId, next);
      return next;
    });
  };

  return { ...settings, setPasscode, setLockWall, setHomeWall };
}
