import type { Server as IOServer, Socket } from "socket.io";
import { z } from "zod";
import {
  AVATARS,
  CATEGORIES,
  GAME_MODES,
  LANGUAGES,
  type Avatar,
  type EngineEvent,
  type QuestionRecord,
  type RoundResult,
} from "@/lib/domain";
import type { GameEngine } from "./game/engine";
import { saveRoomSnapshot, saveRoundRecord } from "./db/repository";

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
const categorySchema = z.enum(CATEGORIES);
const configSchema = z.object({
  categories: z.array(categorySchema).optional(),
  difficulties: z.array(z.enum(["easy", "medium", "hard"])).optional(),
  timerSeconds: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).optional(),
  rounds: z.number().int().min(1).max(50).optional(),
  penalty: z.number().int().min(0).max(200).optional(),
  mode: z.enum(GAME_MODES).optional(),
  language: z.enum(LANGUAGES).optional(),
});
const joinSchema = z.object({
  code: codeSchema,
  nickname: z.string().trim().min(1).max(18),
  avatar: avatarSchema,
  teamId: z.string().nullable().optional(),
});
const tokenSchema = z.object({ code: codeSchema, token: z.string().min(4) });
const playerActionSchema = z.object({ code: codeSchema, playerId: z.string().min(1) });
const submitSchema = playerActionSchema.extend({
  answer: z.string().trim().min(1).max(80),
  idempotencyKey: z.string().min(4).max(80),
});
const hostSchema = z.object({ code: codeSchema, hostToken: z.string().min(4) });
const snapshotSchema = z.object({
  code: codeSchema,
  hostToken: z.string().optional(),
  playerToken: z.string().optional(),
});
const configActionSchema = hostSchema.extend({ config: configSchema });

function fail(ack: Ack | undefined, error: unknown): void {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  ack?.({ ok: false, error: message });
}

function roomName(code: string): string {
  return `room:${code}`;
}

export function setupSockets(io: IOServer, engine: GameEngine, questionBank: QuestionRecord[]): void {
  function emitSnapshots(code: string): void {
    const hostToken = engine.getHostToken(code);
    saveRoomSnapshot(engine.getSnapshot(code, { hostToken }));
    const sockets = io.sockets.adapter.rooms.get(roomName(code));
    if (!sockets) return;
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      socket.emit(
        "state",
        engine.getSnapshot(code, {
          hostToken: socket.data.hostToken,
          playerToken: socket.data.playerToken,
        }),
      );
    }
  }

  function apply(events: EngineEvent[], code: string): void {
    for (const event of events) {
      if (event.type === "answer:result" && event.payload?.result) {
        saveRoundRecord(
          code,
          String(event.payload.questionId ?? ""),
          event.payload.result as RoundResult,
        );
      }
      io.to(roomName(code)).emit("game:event", event);
    }
    emitSnapshots(code);
  }

  function authorizeHost(socket: Socket, code: string, supplied?: string): boolean {
    const hostToken = supplied ?? socket.data.hostToken;
    return Boolean(hostToken && hostToken === engine.getHostToken(code));
  }

  function authorizePlayer(socket: Socket, code: string, playerId: string): boolean {
    if (socket.data.roomCode === code && socket.data.playerId === playerId) return true;
    return Boolean(
      authorizeHost(socket, code) &&
        engine.isLocalPlayer(code, playerId),
    );
  }

  io.on("connection", (socket) => {
    socket.on("room:create", (payload: unknown, ack?: Ack) => {
      try {
        const input = z
          .object({
            config: configSchema.optional(),
            localPlayers: z
              .array(
                z.object({
                  nickname: z.string().trim().min(1).max(18),
                  avatar: avatarSchema,
                  teamId: z.string().nullable().optional(),
                }),
              )
              .max(6)
              .optional(),
          })
          .parse(payload ?? {});
        const created = engine.createRoom({
          questionBank,
          config: input.config,
          localPlayers: input.localPlayers?.map((player) => ({
            ...player,
            avatar: player.avatar as Avatar,
          })),
        });
        socket.data.hostToken = created.value.hostToken;
        socket.data.roomCode = created.value.code;
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

    socket.on("room:join", (payload: unknown, ack?: Ack) => {
      try {
        const input = joinSchema.parse(payload);
        const joined = engine.joinRoom(input.code, {
          nickname: input.nickname,
          avatar: input.avatar as (typeof AVATARS)[number],
          teamId: input.teamId ?? null,
        });
        engine.attachSocket(input.code, joined.value.playerId, socket.id);
        socket.data.roomCode = input.code;
        socket.data.playerId = joined.value.playerId;
        socket.data.playerToken = joined.value.token;
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

    socket.on("room:reconnect", (payload: unknown, ack?: Ack) => {
      try {
        const input = tokenSchema.parse(payload);
        const reconnected = engine.reconnect(input.code, input.token);
        engine.attachSocket(input.code, reconnected.value.playerId, socket.id);
        socket.data.roomCode = input.code;
        socket.data.playerId = reconnected.value.playerId;
        socket.data.playerToken = input.token;
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

    socket.on("room:snapshot", (payload: unknown, ack?: Ack) => {
      try {
        const input = snapshotSchema.parse(payload);
        if (input.hostToken && input.hostToken === engine.getHostToken(input.code)) {
          socket.data.hostToken = input.hostToken;
        }
        if (input.playerToken) {
          const playerId = engine.getPlayerIdByToken(input.code, input.playerToken);
          if (playerId) {
            socket.data.roomCode = input.code;
            socket.data.playerId = playerId;
            socket.data.playerToken = input.playerToken;
          }
        }
        socket.join(roomName(input.code));
        ack?.({
          ok: true,
          snapshot: engine.getSnapshot(input.code, {
            hostToken: socket.data.hostToken,
            playerToken: socket.data.playerToken,
          }),
        });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("player:add-local", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.extend({
          nickname: z.string().trim().min(1).max(18),
          avatar: avatarSchema,
          teamId: z.string().nullable().optional(),
        }).parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const added = engine.addLocalPlayer(input.code, {
          nickname: input.nickname,
          avatar: input.avatar as (typeof AVATARS)[number],
          teamId: input.teamId ?? null,
        });
        apply(added.events, input.code);
        ack?.({ ok: true, ...added.value });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("host:start", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.startGame(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("host:next", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.nextRound(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("host:skip", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.skipQuestion(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("host:reveal", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.revealAnswer(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("host:pause", (payload: unknown, ack?: Ack) => {
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

    socket.on("host:resume", (payload: unknown, ack?: Ack) => {
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

    socket.on("host:config", (payload: unknown, ack?: Ack) => {
      try {
        const input = configActionSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.updateConfig(input.code, input.hostToken, input.config);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("host:dismiss", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.dismissResult(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("player:buzz", (payload: unknown, ack?: Ack) => {
      try {
        const input = playerActionSchema.parse(payload);
        if (!authorizePlayer(socket, input.code, input.playerId)) throw new Error("NOT_AUTHORIZED");
        const result = engine.buzz(input.code, input.playerId);
        apply(result.events, input.code);
        ack?.({ ok: true, accepted: result.value.accepted });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("player:reveal", (payload: unknown, ack?: Ack) => {
      try {
        const input = playerActionSchema.parse(payload);
        if (!authorizePlayer(socket, input.code, input.playerId)) throw new Error("NOT_AUTHORIZED");
        const result = engine.revealLetter(input.code, input.playerId);
        apply(result.events, input.code);
        ack?.({ ok: true, ...result.value });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("player:submit", (payload: unknown, ack?: Ack) => {
      try {
        const input = submitSchema.parse(payload);
        if (!authorizePlayer(socket, input.code, input.playerId)) throw new Error("NOT_AUTHORIZED");
        const result = engine.submitAnswer(input.code, input.playerId, input.answer, input.idempotencyKey);
        apply(result.events, input.code);
        ack?.({ ok: true, ...result.value });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("room:leave", (payload: unknown, ack?: Ack) => {
      try {
        const input = z.object({ code: codeSchema }).parse(payload ?? {});
        if (socket.data.roomCode === input.code && socket.data.playerId) {
          const events = engine.detachSocket(input.code, socket.data.playerId, socket.id);
          apply(events, input.code);
        }
        socket.leave(roomName(input.code));
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });
  });
}
