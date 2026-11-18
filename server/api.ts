import type { IncomingMessage, ServerResponse } from "node:http";
import {
  deleteQuestion,
  getGameHistory,
  listAdminQuestions,
  saveQuestion,
  type SaveQuestionInput,
} from "./db/repository";

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("TOO_LARGE"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function isAuthorized(request: IncomingMessage): boolean {
  const expected = process.env.PARENT_PIN ?? "1234";
  const provided = request.headers["x-parent-pin"];
  return typeof provided === "string" && provided === expected;
}

export async function handleApi(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;

  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      sendJson(response, 200, { ok: true, time: new Date().toISOString() });
      return true;
    }

    if (url.pathname === "/api/questions" && request.method === "GET") {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { error: "PARENT_PIN_REQUIRED" });
        return true;
      }
      sendJson(response, 200, { questions: listAdminQuestions() });
      return true;
    }

    if (url.pathname === "/api/questions" && request.method === "POST") {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { error: "PARENT_PIN_REQUIRED" });
        return true;
      }
      const body = JSON.parse(await readBody(request)) as SaveQuestionInput;
      sendJson(response, 200, { question: saveQuestion(body) });
      return true;
    }

    const deleteMatch = url.pathname.match(/^\/api\/questions\/([^/]+)$/);
    if (deleteMatch && request.method === "DELETE") {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { error: "PARENT_PIN_REQUIRED" });
        return true;
      }
      deleteQuestion(decodeURIComponent(deleteMatch[1] ?? ""));
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (url.pathname === "/api/history" && request.method === "GET") {
      sendJson(response, 200, { games: getGameHistory() });
      return true;
    }

    sendJson(response, 404, { error: "NOT_FOUND" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    sendJson(response, 400, { error: message });
    return true;
  }
}
