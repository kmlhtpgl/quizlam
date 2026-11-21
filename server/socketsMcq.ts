import type { Server as IOServer, Socket } from "socket.io";
import { z } from "zod";
import { AVATARS, CATEGORIES, LANGUAGES, type Avatar, type EngineEvent, type QuestionRecord } from "@/lib/domain";
import type { McqResult } from "@/lib/mcqDomain";
import { saveMcqRoomSnapshot, saveMcqRoundRecord } from "./db/repository";
import type { McqEngine } from "./game/mcqEngine";

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
  timerSeconds: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).optional(),
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
  return `mcq:${code}`;
}

export function setupMcqSockets(io: IOServer, engine: McqEngine, questionBank: QuestionRecord[]): void {
  function emitSnapshots(code: string): void {
    const hostToken = engine.getHostToken(code);
    saveMcqRoomSnapshot(engine.getSnapshot(code, { hostToken }));
    const sockets = io.sockets.adapter.rooms.get(roomName(code));
    if (!sockets) return;
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      socket.emit(
        "state",
        engine.getSnapshot(code, {
          hostToken: socket.data.mcqHostToken,
          playerToken: socket.data.mcqPlayerToken,
        }),
      );
    }
  }

  function apply(events: EngineEvent[], code: string): void {
    for (const event of events) {
      if (event.type === "answer:result" && event.payload?.result) {
        saveMcqRoundRecord(code, String(event.payload.questionId ?? ""), event.payload.result as McqResult);
      }
      io.to(roomName(code)).emit("game:event", event);
    }
    emitSnapshots(code);
  }

  function authorizeHost(socket: Socket, code: string, supplied?: string): boolean {
    const token = supplied ?? socket.data.mcqHostToken;
    return Boolean(token && token === engine.getHostToken(code));
  }

  function authorizePlayer(socket: Socket, code: string, playerId: string): boolean {
    if (socket.data.mcqRoomCode === code && socket.data.mcqPlayerId === playerId) return true;
    return Boolean(authorizeHost(socket, code) && engine.isLocalPlayer(code, playerId));
  }

  io.on("connection", (socket) => {
    socket.on("mcq:create", (payload: unknown, ack?: Ack) => {
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
              .max(12)
              .optional(),
          })
          .parse(payload ?? {});
        const created = engine.createRoom({
          questionBank,
          config: input.config,
          localPlayers: input.localPlayers?.map((player) => ({ ...player, avatar: player.avatar as Avatar })),
        });
        socket.data.mcqHostToken = created.value.hostToken;
        socket.data.mcqRoomCode = created.value.code;
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

    socket.on("mcq:join", (payload: unknown, ack?: Ack) => {
      try {
        const input = joinSchema.parse(payload);
        const joined = engine.joinRoom(input.code, {
          nickname: input.nickname,
          avatar: input.avatar as (typeof AVATARS)[number],
          teamId: input.teamId ?? null,
        });
        engine.attachSocket(input.code, joined.value.playerId, socket.id);
        socket.data.mcqRoomCode = input.code;
        socket.data.mcqPlayerId = joined.value.playerId;
        socket.data.mcqPlayerToken = joined.value.token;
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

    socket.on("mcq:reconnect", (payload: unknown, ack?: Ack) => {
      try {
        const input = tokenSchema.parse(payload);
        const reconnected = engine.reconnect(input.code, input.token);
        engine.attachSocket(input.code, reconnected.value.playerId, socket.id);
        socket.data.mcqRoomCode = input.code;
        socket.data.mcqPlayerId = reconnected.value.playerId;
        socket.data.mcqPlayerToken = input.token;
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

    socket.on("mcq:snapshot", (payload: unknown, ack?: Ack) => {
      try {
        const input = snapshotSchema.parse(payload);
        if (input.hostToken && input.hostToken === engine.getHostToken(input.code)) {
          socket.data.mcqHostToken = input.hostToken;
        }
        if (input.playerToken) {
          const playerId = engine.getPlayerIdByToken(input.code, input.playerToken);
          if (playerId) {
            socket.data.mcqRoomCode = input.code;
            socket.data.mcqPlayerId = playerId;
            socket.data.mcqPlayerToken = input.playerToken;
          }
        }
        socket.join(roomName(input.code));
        ack?.({
          ok: true,
          snapshot: engine.getSnapshot(input.code, {
            hostToken: socket.data.mcqHostToken,
            playerToken: socket.data.mcqPlayerToken,
          }),
        });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("mcq:add-local", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema
          .extend({
            nickname: z.string().trim().min(1).max(18),
            avatar: avatarSchema,
          })
          .parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const added = engine.addLocalPlayer(input.code, {
          nickname: input.nickname,
          avatar: input.avatar as (typeof AVATARS)[number],
        });
        apply(added.events, input.code);
        ack?.({ ok: true, ...added.value });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("mcq:select-contestant", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.extend({ playerId: z.string().min(1) }).parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.selectContestant(input.code, input.hostToken, input.playerId);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("mcq:start", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.startRun(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("mcq:answer", (payload: unknown, ack?: Ack) => {
      try {
        const input = playerActionSchema.extend({
          choice: z.number().int().min(0).max(3),
          idempotencyKey: z.string().min(4).max(80),
        }).parse(payload);
        if (!authorizePlayer(socket, input.code, input.playerId)) throw new Error("NOT_AUTHORIZED");
        const result = engine.answer(input.code, input.playerId, input.choice, input.idempotencyKey);
        apply(result.events, input.code);
        ack?.({ ok: true, correct: result.value.correct });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("mcq:fifty-fifty", (payload: unknown, ack?: Ack) => {
      try {
        const input = playerActionSchema.parse(payload);
        if (!authorizePlayer(socket, input.code, input.playerId)) throw new Error("NOT_AUTHORIZED");
        const result = engine.useFiftyFifty(input.code, input.playerId);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("mcq:reveal", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.reveal(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("mcq:next", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.nextQuestion(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("mcq:reset", (payload: unknown, ack?: Ack) => {
      try {
        const input = hostSchema.parse(payload);
        if (!authorizeHost(socket, input.code, input.hostToken)) throw new Error("HOST_ONLY");
        const result = engine.resetRun(input.code, input.hostToken);
        apply(result.events, input.code);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("mcq:pause", (payload: unknown, ack?: Ack) => {
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

    socket.on("mcq:resume", (payload: unknown, ack?: Ack) => {
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

    socket.on("mcq:leave", (payload: unknown, ack?: Ack) => {
      try {
        const input = z.object({ code: codeSchema }).parse(payload ?? {});
        if (socket.data.mcqRoomCode === input.code && socket.data.mcqPlayerId) {
          apply(engine.detachSocket(input.code, socket.data.mcqPlayerId, socket.id), input.code);
        }
        socket.leave(roomName(input.code));
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });
  });
}
