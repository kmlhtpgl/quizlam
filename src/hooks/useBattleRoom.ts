"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { EngineEvent } from "@/lib/domain";
import type { BattleRoomSnapshot } from "@/lib/battleDomain";
import { getPlayerSession, getHostSession } from "@/lib/session";
import {
  emitWithAck,
  getConnectionSnapshot,
  getServerConnectionSnapshot,
  getSocket,
  subscribeConnection,
  type AckResponse,
} from "@/lib/socket";
import type { GameEventEnvelope, RoomRole } from "./useGameRoom";

export function useBattleRoom(code: string, role: RoomRole) {
  const [snapshot, setSnapshot] = useState<BattleRoomSnapshot | null>(null);
  const [events, setEvents] = useState<GameEventEnvelope[]>([]);
  const eventId = useRef(0);
  const connected = useSyncExternalStore(subscribeConnection, getConnectionSnapshot, getServerConnectionSnapshot);

  const hostToken = useMemo(() => (role === "host" ? getHostSession(code) : null), [code, role]);
  const playerToken = useMemo(() => (role === "player" ? getPlayerSession(code)?.token ?? null : null), [code, role]);

  useEffect(() => {
    if (!code) return;
    const socket = getSocket();
    const request = () => {
      socket.emit(
        "battle:snapshot",
        {
          code,
          hostToken: hostToken ?? undefined,
          playerToken: playerToken ?? undefined,
        },
        (response: AckResponse) => {
          const value = response.snapshot as BattleRoomSnapshot | undefined;
          if (response.ok && value?.gameType === "battle") setSnapshot(value);
        },
      );
    };
    const onConnect = () => request();
    const onState = (state: BattleRoomSnapshot) => {
      if (state?.gameType === "battle") setSnapshot(state);
    };
    const onEvent = (event: EngineEvent) => {
      eventId.current += 1;
      setEvents((current) => [...current, { event, id: eventId.current }].slice(-64));
    };

    socket.on("connect", onConnect);
    socket.on("state", onState);
    socket.on("game:event", onEvent);
    if (socket.connected) request();

    return () => {
      socket.off("connect", onConnect);
      socket.off("state", onState);
      socket.off("game:event", onEvent);
    };
  }, [code, hostToken, playerToken]);

  const emit = useCallback((event: string, payload: unknown) => emitWithAck(event, payload), []);

  return { snapshot, connected, events, lastEvent: events[events.length - 1] ?? null, emit, hostToken, playerToken };
}
