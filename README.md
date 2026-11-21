# Quizlam

A real-time Islamic word-guessing game for families and young learners. A host runs the game from a dashboard, players buzz in from their phones, and a TV screen shows the question, hidden answer tiles, timer, and scoreboard.

## Features

- Host dashboard with room code, QR code, local buzzers, and full game controls.
- Phone players join with a nickname and avatar; reconnect with a stored session token.
- TV view designed for a big screen (`/tv/[code]`).
- Server-authoritative buzzer ordering, timer, scoring, letter reveals, and answer validation.
- 750 bilingual questions across 16 categories, with a PIN-protected parent editor.
- English/Turkish interface and questions.
- Randomized lobby/question music and answer cues on TV/host, with separate sound and music toggles.
- Individual, team, family, tournament, and daily-challenge modes.
- Saved game history and answer review.

## Requirements

- Node.js 22.14+ (24.x recommended)
- npm

## Setup

```bash
npm install
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. The custom dev server runs Next.js and Socket.IO together.

Optional environment variables:

```bash
PORT=3000
PARENT_PIN=1234
```

`PARENT_PIN` defaults to `1234` for local development. Change it before exposing the app publicly.

## Deploy to Render Free

The repository includes a `render.yaml` Blueprint for a free Render Web Service.

1. Push the repository to GitHub.
2. In Render, click **New → Blueprint**.
3. Connect `kmlhtpgl/quizlam` and use the `main` branch.
4. Set `PARENT_PIN` when Render prompts for it.
5. Deploy and open the generated `onrender.com` URL.

Blueprint settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Node version | 24.22.1 |
| Plan | Free |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Instances | 1 |
| Database path | `/tmp/quizlam.db` |

Render Free limitations:

- The service sleeps after 15 minutes without HTTP or WebSocket traffic; the first request after sleep takes about one minute.
- The SQLite database is ephemeral. The question bank is reseeded automatically, but parent edits and saved history reset on sleep, restart, or redeploy.
- Persistent disks, SSH, and multiple instances are not available on the free plan.
- Free Render Postgres expires after 30 days, so it is not used here.

Manual web service setup uses the same build command, start command, health check, and environment variables.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js and Socket.IO in development mode |
| `npm run build` | Build Next.js and bundle the custom server |
| `npm start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm test` | Run Vitest engine tests |
| `npm run db:seed` | Seed the SQLite question bank |
| `npm run db:migrate` | Apply Drizzle migrations |

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/create` | Create a game room |
| `/join?code=CODE` | Join with a room code |
| `/host/[code]` | Host dashboard |
| `/tv/[code]` | Big-screen game view |
| `/play/[code]` | Player buzzer and answer screen |
| `/results/[code]` | Final scores and answer review |
| `/how-to` | Rules |
| `/settings` | Preferences and defaults |
| `/parent` | PIN-protected question editor |
| `/history` | Saved games |
| `/daily` | Start today's challenge |

## Game rules

- The answer starts as hidden letter tiles. Spaces and punctuation are shown but cannot be revealed.
- The first valid buzzer press wins the turn; later buzzes are rejected.
- Each revealed letter costs 100 points from that word.
- A correct answer awards the remaining points.
- A wrong answer or timeout applies the configured penalty and locks that player out of the current question.
- If every eligible player is locked out, the answer is revealed and the round ends.

## Architecture

- `src/app`: Next.js App Router pages and shared UI.
- `src/components`: Presentational components, layouts, and game widgets.
- `src/hooks/useGameRoom.ts`: Client hook for room snapshots and Socket.IO events.
- `src/lib/domain.ts`: Shared types and constants.
- `src/lib/scoring.ts`: Answer normalization and scoring helpers.
- `server/game/engine.ts`: Authoritative in-memory game engine.
- `server/sockets.ts`: Socket.IO event contract, authorization, and broadcasts.
- `server/api.ts`: REST endpoints for health, questions, and history.
- `server/db`: SQLite/Drizzle schema, repository, and question seed.

Room state is currently in memory; question and game history are persisted to SQLite in `data/quizlam.db`.
