import type { EngineEvent, RoundResult } from "@/lib/domain";

let context: AudioContext | null = null;

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

export type SoundKind = "join" | "start" | "buzz" | "reveal" | "correct" | "wrong" | "timeout" | "tick" | "win";

export function unlockAudio(): void {
  getContext();
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
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  const notes: Record<SoundKind, Array<{ frequency: number; delay: number; duration: number; type?: OscillatorType }>> = {
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
    reveal: [{ frequency: 880, delay: 0, duration: 0.12 }],
    correct: [
      { frequency: 523, delay: 0, duration: 0.13 },
      { frequency: 659, delay: 0.12, duration: 0.13 },
      { frequency: 784, delay: 0.24, duration: 0.22 },
    ],
    wrong: [
      { frequency: 260, delay: 0, duration: 0.16 },
      { frequency: 190, delay: 0.14, duration: 0.22 },
    ],
    timeout: [
      { frequency: 330, delay: 0, duration: 0.12 },
      { frequency: 247, delay: 0.11, duration: 0.12 },
      { frequency: 165, delay: 0.22, duration: 0.24 },
    ],
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
