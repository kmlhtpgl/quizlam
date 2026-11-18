export interface PlayerSession {
  playerId: string;
  token: string;
  nickname: string;
  avatar: string;
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getHostSession(code: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`quizlam.host.${code}`);
}

export function setHostSession(code: string, token: string): void {
  window.localStorage.setItem(`quizlam.host.${code}`, token);
}

export function getPlayerSession(code: string): PlayerSession | null {
  if (typeof window === "undefined") return null;
  return safeParse<PlayerSession>(window.localStorage.getItem(`quizlam.player.${code}`));
}

export function setPlayerSession(code: string, session: PlayerSession): void {
  window.localStorage.setItem(`quizlam.player.${code}`, JSON.stringify(session));
}
