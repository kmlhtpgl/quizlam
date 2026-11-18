"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
const connectionListeners = new Set<() => void>();
let connectionSnapshot = false;

function publishConnection(): void {
  const next = socket?.connected ?? false;
  if (next === connectionSnapshot) return;
  connectionSnapshot = next;
  for (const listener of connectionListeners) listener();
}

export function subscribeConnection(listener: () => void): () => void {
  connectionListeners.add(listener);
  publishConnection();
  return () => connectionListeners.delete(listener);
}

export function getConnectionSnapshot(): boolean {
  return connectionSnapshot;
}

export function getServerConnectionSnapshot(): boolean {
  return false;
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
    socket.on("connect", publishConnection);
    socket.on("disconnect", publishConnection);
  }
  return socket;
}

export interface AckResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export function emitWithAck(event: string, payload: unknown): Promise<AckResponse> {
  return new Promise((resolve) => {
    getSocket()
      .timeout(8000)
      .emit(event, payload, (error: Error | null, response: AckResponse) => {
        if (error) {
          resolve({ ok: false, error: error.message });
          return;
        }
        resolve(response ?? { ok: false, error: "NO_RESPONSE" });
      });
  });
}
