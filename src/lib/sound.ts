import type { EngineEvent, RoundResult } from "@/lib/domain";

let context: AudioContext | null = null;
let music: HTMLAudioElement | null = null;
let musicKind: MusicKind | null = null;
let pendingMusicKind: MusicKind | null = null;
const activeCues = new Set<HTMLAudioElement>();
const lastTracks: Partial<Record<TrackKind, string>> = {};

export type SoundKind = "join" | "start" | "buzz" | "question" | "reveal" | "correct" | "wrong" | "timeout" | "tick" | "win";
export type MusicKind = "lobby" | "question";
type TrackKind = MusicKind | "correct" | "wrong";
type SynthSoundKind = Exclude<SoundKind, "correct" | "wrong" | "timeout">;

export const AUDIO_TRACKS: Record<TrackKind, readonly string[]> = {
  lobby: [
    "/audio/lobby/audioera-synth-pop-637720.mp3",
    "/audio/lobby/backgroundmusicmaster-quiz-master-382651.mp3",
    "/audio/lobby/epic_musictracks-to-frighten-121407.mp3",
    "/audio/lobby/sonican-flash-quiz-loop-236356.mp3",
  ],
  question: [
    "/audio/question/alex_kizenkov-cinematic-epic-trailer-clock-trailer-141369.mp3",
    "/audio/question/hot_dope-crimson-lies-intro-343898.mp3",
    "/audio/question/kaazoom-the-omega-conspiracy-30-sec-edit-561129.mp3",
    "/audio/question/sonican-flash-news-30-seconds-buildup-431803.mp3",
    "/audio/question/vadim_makes_sound-game-challenge-countdown-551283.mp3",
    "/audio/question/vadim_makes_sound-news-timer-countdown-551282.mp3",
    "/audio/question/vadim_makes_sound-quiz-thinking-timer-loop-551268.mp3",
  ],
  correct: [
    "/audio/correct_answer/driken5482-applause-236785.mp3",
    "/audio/correct_answer/driken5482-applause-cheer-236786.mp3",
    "/audio/correct_answer/pwlpl-applause-sound-effect-521104.mp3",
  ],
  wrong: [
    "/audio/wrong_answer/eritnhut1992-buzzer-or-wrong-answer-20582.mp3",
    "/audio/wrong_answer/universfield-wrong-answer-126515.mp3",
    "/audio/wrong_answer/universfield-wrong-answer-beep-149895.mp3",
  ],
};

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

export function unlockAudio(): void {
  getContext();
  if (music && pendingMusicKind) void music.play().catch(() => {});
}

function createAudio(src: string, loop: boolean, volume: number): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = volume;
  return audio;
}

export function pickTrack(kind: TrackKind, random: () => number = Math.random): string {
  const tracks = AUDIO_TRACKS[kind];
  const index = Math.min(tracks.length - 1, Math.max(0, Math.floor(random() * tracks.length)));
  let selected = tracks[index]!;
  if (tracks.length > 1 && selected === lastTracks[kind]) {
    selected = tracks[(index + 1) % tracks.length]!;
  }
  lastTracks[kind] = selected;
  return selected;
}

export function startMusic(kind: MusicKind, enabled: boolean): void {
  if (!enabled) {
    stopMusic();
    return;
  }
  if (music && musicKind === kind) {
    pendingMusicKind = kind;
    void music.play().catch(() => {});
    return;
  }
  stopMusic();
  const audio = createAudio(pickTrack(kind), true, 0.16);
  if (!audio) return;
  music = audio;
  musicKind = kind;
  pendingMusicKind = kind;
  void audio.play().catch(() => {});
}

export function stopMusic(): void {
  pendingMusicKind = null;
  if (!music) {
    musicKind = null;
    return;
  }
  music.pause();
  try {
    music.currentTime = 0;
  } catch {}
  music = null;
  musicKind = null;
}

function playCue(kind: "correct" | "wrong", enabled: boolean): void {
  if (!enabled) return;
  const audio = createAudio(pickTrack(kind), false, 0.32);
  if (!audio) return;
  activeCues.add(audio);
  audio.addEventListener("ended", () => activeCues.delete(audio), { once: true });
  audio.addEventListener("error", () => activeCues.delete(audio), { once: true });
  void audio.play().catch(() => activeCues.delete(audio));
}

function readResult(payload: EngineEvent["payload"]): RoundResult | null {
  const value = payload?.result;
  if (!value || typeof value !== "object") return null;
  const result = value as Partial<RoundResult>;
  if (
    typeof result.correct !== "boolean" ||
    typeof result.timedOut !== "boolean" ||
    typeof result.skipped !== "boolean"
  ) {
    return null;
  }
  return result as RoundResult;
}

export function soundForEvent(event: EngineEvent): SoundKind | null {
  switch (event.type) {
    case "player:joined":
      return "join";
    case "room:started":
      return "start";
    case "player:buzzed":
      return "buzz";
    case "letter:revealed":
      return "reveal";
    case "battle:question":
      return "question";
    case "battle:reveal":
      return "reveal";
    case "game:finished":
      return "win";
    case "answer:result": {
      const result = readResult(event.payload);
      if (!result || result.skipped) return null;
      if (result.correct) return "correct";
      if (result.timedOut) return "timeout";
      return "wrong";
    }
    default:
      return null;
  }
}

export function playSound(kind: SoundKind, enabled: boolean): void {
  if (!enabled) return;
  if (kind === "correct") {
    playCue("correct", true);
    return;
  }
  if (kind === "wrong" || kind === "timeout") {
    playCue("wrong", true);
    return;
  }
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  const notes: Record<SynthSoundKind, Array<{ frequency: number; delay: number; duration: number; type?: OscillatorType }>> = {
    join: [
      { frequency: 523, delay: 0, duration: 0.1 },
      { frequency: 784, delay: 0.09, duration: 0.16 },
    ],
    start: [
      { frequency: 392, delay: 0, duration: 0.12 },
      { frequency: 523, delay: 0.11, duration: 0.12 },
      { frequency: 659, delay: 0.22, duration: 0.14 },
      { frequency: 784, delay: 0.35, duration: 0.28 },
    ],
    buzz: [
      { frequency: 660, delay: 0, duration: 0.1 },
      { frequency: 990, delay: 0.1, duration: 0.16 },
    ],
    question: [
      { frequency: 523, delay: 0, duration: 0.1 },
      { frequency: 784, delay: 0.1, duration: 0.16 },
    ],
    reveal: [{ frequency: 880, delay: 0, duration: 0.12 }],
    tick: [{ frequency: 1100, delay: 0, duration: 0.045 }],
    win: [
      { frequency: 523, delay: 0, duration: 0.12 },
      { frequency: 659, delay: 0.1, duration: 0.12 },
      { frequency: 784, delay: 0.2, duration: 0.12 },
      { frequency: 1047, delay: 0.3, duration: 0.36 },
    ],
  };
  for (const note of notes[kind]) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = note.type ?? "sine";
    oscillator.frequency.setValueAtTime(note.frequency, now + note.delay);
    gain.gain.setValueAtTime(0.0001, now + note.delay);
    gain.gain.exponentialRampToValueAtTime(0.13, now + note.delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.delay + note.duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now + note.delay);
    oscillator.stop(now + note.delay + note.duration + 0.02);
  }
}
