import type { Server as IOServer, Socket } from "socket.io";
import { z } from "zod";
import { AVATARS, CATEGORIES, LANGUAGES, type Avatar, type EngineEvent, type QuestionRecord } from "@/lib/domain";
import type { BattleResult } from "@/lib/battleDomain";
import { saveBattleRoomSnapshot, saveBattleRoundRecord } from "./db/repository";
import type { BattleEngine } from "./game/battleEngine";

type Ack = (payload: { ok: boolean; error?: string; [key: string]: unknown }) => void;

const codeSchema = z
  .string()
  .trim()
  .min(4)
  .max(8)
  .transform((value) => value.toUpperCase());
const avatarSchema = z.string().refine((value) => AVATARS.includes(value as (typeof AVATARS)[number]), {
  message: "INVALID_AVATAR",
});
const configSchema = z.object({
  categories: z.array(z.enum(CATEGORIES)).optional(),
  difficulties: z.array(z.enum(["easy", "medium", "hard"])).optional(),
  timerSeconds: z.union([
    z.literal(10),
    z.literal(15),
    z.literal(20),
    z.literal(30),
    z.literal(45),
    z.literal(60),
  ]).optional(),
  rounds: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional(),
  language: z.enum(LANGUAGES).optional(),
});
const joinSchema = z.object({
  code: codeSchema,
  nickname: z.string().trim().min(1).max(18),
  avatar: avatarSchema,
});
const tokenSchema = z.object({ code: codeSchema, token: z.string().min(4) });
const playerActionSchema = z.object({ code: codeSchema, playerId: z.string().min(1) });
const hostSchema = z.object({ code: codeSchema, hostToken: z.string().min(4) });
const snapshotSchema = z.object({
  code: codeSchema,
  hostToken: z.string().optional(),
  playerToken: z.string().optional(),
});

function fail(ack: Ack | undefined, error: unknown): void {
  ack?.({ ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
}

function roomName(code: string): string {
  return `battle:${code}`;
}

export function setupBattleSockets(io: IOServer, engine: BattleEngine, questionBank: QuestionRecord[]): void {
  function emitSnapshots(code: string): void {
    const hostToken = engine.getHostToken(code);
    saveBattleRoomSnapshot(engine.getSnapshot(code, { hostToken }));
    const sockets = io.sockets.adapter.rooms.get(roomName(code));
    if (!sockets) return;
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      socket.emit(
        "state",
        engine.getSnapshot(code, {
          hostToken: socket.data.battleHostToken,
          playerToken: socket.data.battlePlayerToken,
        }),
      );
    }
  }

  function apply(events: EngineEvent[], code: string): void {
    for (const event of events) {
      if (event.type === "battle:reveal" && Array.isArray(event.payload?.results)) {
        for (const result of event.payload.results as BattleResult[]) {
          saveBattleRoundRecord(code, String(event.payload?.questionId ?? ""), result);
        }
      }
      io.to(roomName(code)).emit("game:event", event);
    }
    emitSnapshots(code);
  }

  engine.setEventSink((events, code) => apply(events, code));

  function authorizeHost(socket: Socket, code: string, supplied?: string): boolean {
    const token = supplied ?? socket.data.battleHostToken;
    return Boolean(token && token === engine.getHostToken(code));
  }

  function authorizePlayer(socket: Socket, code: string, playerId: string): boolean {
    if (socket.data.battleRoomCode === code && socket.data.battlePlayerId === playerId) return true;
    return Boolean(authorizeHost(socket, code) && engine.isLocalPlayer(code, playerId));
  }

  io.on("connection", (socket) => {
    socket.on("battle:create", (payload: unknown, ack?: Ack) => {
      try {
        const input = z
          .object({
            config: configSchema.optional(),
            localPlayers: z
              .array(
                z.object({
                  nickname: z.string().trim().min(1).max(18),
                  avatar: avatarSchema,
                }),
              )
              .max(12)
              .optional(),
          })
          .parse(payload ?? {});
        const created = engine.createRoom({
          questionBank,
          config: input.config,
          localPlayers: input.localPlayers?.map((player) => ({ ...player, avatar: player.avatar as Avatar })),
        });
        socket.data.battleHostToken = created.value.hostToken;
        socket.data.battleRoomCode = created.value.code;
        socket.join(roomName(created.value.code));
        apply(created.events, created.value.code);
        ack?.({
          ok: true,
          code: created.value.code,
          hostToken: created.value.hostToken,
          snapshot: engine.getSnapshot(created.value.code, { hostToken: created.value.hostToken }),
        });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:join", (payload: unknown, ack?: Ack) => {
      try {
        const input = joinSchema.parse(payload);
        const joined = engine.joinRoom(input.code, {
          nickname: input.nickname,
          avatar: input.avatar as (typeof AVATARS)[number],
        });
        engine.attachSocket(input.code, joined.value.playerId, socket.id);
        socket.data.battleRoomCode = input.code;
        socket.data.battlePlayerId = joined.value.playerId;
        socket.data.battlePlayerToken = joined.value.token;
        socket.join(roomName(input.code));
        apply(joined.events, input.code);
        ack?.({
          ok: true,
          code: input.code,
          playerId: joined.value.playerId,
          token: joined.value.token,
          snapshot: engine.getSnapshot(input.code, { playerToken: joined.value.token }),
        });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:reconnect", (payload: unknown, ack?: Ack) => {
      try {
        const input = tokenSchema.parse(payload);
        const reconnected = engine.reconnect(input.code, input.token);
        engine.attachSocket(input.code, reconnected.value.playerId, socket.id);
        socket.data.battleRoomCode = input.code;
        socket.data.battlePlayerId = reconnected.value.playerId;
        socket.data.battlePlayerToken = input.token;
        socket.join(roomName(input.code));
        apply(reconnected.events, input.code);
        ack?.({
          ok: true,
          ...reconnected.value,
          snapshot: engine.getSnapshot(input.code, { playerToken: input.token }),
        });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:snapshot", (payload: unknown, ack?: Ack) => {
      try {
        const input = snapshotSchema.parse(payload);
        if (input.hostToken && input.hostToken === engine.getHostToken(input.code)) {
          socket.data.battleHostToken = input.hostToken;
        }
        if (input.playerToken) {
          const playerId = engine.getPlayerIdByToken(input.code, input.playerToken);
          if (playerId) {
            socket.data.battleRoomCode = input.code;
            socket.data.battlePlayerId = playerId;
            socket.data.battlePlayerToken = input.playerToken;
          }
        }
        socket.join(roomName(input.code));
        ack?.({
          ok: true,
          snapshot: engine.getSnapshot(input.code, {
            hostToken: socket.data.battleHostToken,
            playerToken: socket.data.battlePlayerToken,
          }),
        });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:start", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.start(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:answer", (payload: unknown, ack?: Ack) => {
      try {
        const input = playerActionSchema.extend({
          selectedIndex: z.number().int().min(0).max(3),
          idempotencyKey: z.string().min(4).max(80),
        }).parse(payload);
        if (!authorizePlayer(socket, input.code, input.playerId)) throw new Error("NOT_AUTHORIZED");
        const result = engine.submitAnswer(input.code, input.playerId, input.selectedIndex, input.idempotencyKey);
        apply(result.events, input.code);
        ack?.({ ok: true, ...result.value });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:skip", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.skip(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:next", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.next(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:pause", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.pause(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:resume", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.resume(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:end", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.end(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("battle:leave", (payload: unknown, ack?: Ack) => {
      try {
        const input = z.object({ code: codeSchema }).parse(payload ?? {});
        if (socket.data.battleRoomCode === input.code && socket.data.battlePlayerId) {
          apply(engine.detachSocket(input.code, socket.data.battlePlayerId, socket.id), input.code);
        }
        socket.leave(roomName(input.code));
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("disconnect", () => {
      const code = socket.data.battleRoomCode as string | undefined;
      const playerId = socket.data.battlePlayerId as string | undefined;
      if (!code || !playerId) return;
      try {
        apply(engine.detachSocket(code, playerId, socket.id), code);
      } catch {
        return;
      }
    });
  });
}
