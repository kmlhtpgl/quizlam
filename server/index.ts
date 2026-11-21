import { createServer } from "node:http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { handleApi } from "./api";
import { ensureSeeded, getQuestionBank } from "./db/repository";
import { GameEngine } from "./game/engine";
import { McqEngine } from "./game/mcqEngine";
import { setupSockets } from "./sockets";
import { setupMcqSockets } from "./socketsMcq";

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handleNext = app.getRequestHandler();

ensureSeeded();
const engine = new GameEngine();
const mcqEngine = new McqEngine();
const questionBank = getQuestionBank();

app.prepare().then(() => {
  const server = createServer((request, response) => {
    handleApi(request, response)
      .then((handled) => {
        if (!handled) void handleNext(request, response);
      })
      .catch(() => {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "INTERNAL_ERROR" }));
      });
  });

  const io = new IOServer(server, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  setupSockets(io, engine, questionBank);
  setupMcqSockets(io, mcqEngine, questionBank);

  server.listen(port, () => {
    console.log(`Quizlam running at http://localhost:${port}`);
  });
});
