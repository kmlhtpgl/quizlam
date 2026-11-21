"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_CONFIG, type GameConfig, type Language } from "@/lib/domain";
import { translate, type TranslationKey } from "@/lib/i18n";
import { stopMusic, unlockAudio } from "@/lib/sound";

interface AppContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
  defaults: GameConfig;
  setDefaults: (config: GameConfig) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
}

interface StoredPreferences {
  language: Language;
  soundEnabled: boolean;
  musicEnabled: boolean;
  defaults: GameConfig;
}

const SERVER_PREFERENCES: StoredPreferences = {
  language: "en",
  soundEnabled: true,
  musicEnabled: true,
  defaults: DEFAULT_CONFIG,
};

const listeners = new Set<() => void>();
let preferenceCache: StoredPreferences = SERVER_PREFERENCES;

function readLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("quizlam.language") === "tr" ? "tr" : "en";
}

function readSound(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("quizlam.sound") !== "off";
}

function readMusic(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("quizlam.music") !== "off";
}

function readDefaults(): GameConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const stored = window.localStorage.getItem("quizlam.defaults");
    if (!stored) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(stored) as Partial<GameConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function getPreferencesSnapshot(): StoredPreferences {
  const next: StoredPreferences = {
    language: readLanguage(),
    soundEnabled: readSound(),
    musicEnabled: readMusic(),
    defaults: readDefaults(),
  };
  if (JSON.stringify(next) !== JSON.stringify(preferenceCache)) preferenceCache = next;
  return preferenceCache;
}

function getServerPreferencesSnapshot(): StoredPreferences {
  return SERVER_PREFERENCES;
}

function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyPreferences(): void {
  for (const listener of listeners) listener();
}

const AppContext = createContext<AppContextValue | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const preferences = useSyncExternalStore(
    subscribePreferences,
    getPreferencesSnapshot,
    getServerPreferencesSnapshot,
  );

  useEffect(() => {
    document.documentElement.lang = preferences.language;
  }, [preferences.language]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const setLanguage = useCallback((value: Language) => {
    window.localStorage.setItem("quizlam.language", value);
    notifyPreferences();
  }, []);

  const setSoundEnabled = useCallback((value: boolean) => {
    window.localStorage.setItem("quizlam.sound", value ? "on" : "off");
    notifyPreferences();
  }, []);

  const setMusicEnabled = useCallback((value: boolean) => {
    window.localStorage.setItem("quizlam.music", value ? "on" : "off");
    if (!value) stopMusic();
    notifyPreferences();
  }, []);

  const setDefaults = useCallback((value: GameConfig) => {
    window.localStorage.setItem("quizlam.defaults", JSON.stringify(value));
    notifyPreferences();
  }, []);

  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) => translate(preferences.language, key, values),
    [preferences.language],
  );

  const value = useMemo(
    () => ({
      language: preferences.language,
      setLanguage,
      soundEnabled: preferences.soundEnabled,
      setSoundEnabled,
      musicEnabled: preferences.musicEnabled,
      setMusicEnabled,
      defaults: preferences.defaults,
      setDefaults,
      t,
    }),
    [preferences, setLanguage, setSoundEnabled, setMusicEnabled, setDefaults, t],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider missing");
  return context;
}
