# Devdle Backend

Express + TypeScript API for [Devdle](../devdle-frontend/README.md) — a Wordle-inspired daily coding challenge.

Every day at 00:05 UTC, 6 problems are generated via the Gemini 2.5 Flash API: one beginner + one advanced for each of JavaScript, Python, and Ruby. Problems are stored in MongoDB and served to the frontend. Test cases are split into public (shown to users) and internal (fetched by in-browser code runners at run time, never exposed in the public API).

## Stack

- **Node.js + Express 5** — HTTP server
- **TypeScript** — compiled with `tsc`, run in dev via `tsx watch`
- **MongoDB + Mongoose** — problem storage
- **Gemini 2.5 Flash** (`@google/generative-ai`) — problem generation
- **node-cron** — daily pre-generation job
- **Zod** — env var validation

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file
cp .env.example .env   # or create manually — see Environment Variables below

# 3. Start the dev server (restarts on file save)
npm run dev
```

The server starts on `http://localhost:3001` by default.

You'll need a running MongoDB instance. The easiest way is Docker:

```bash
docker run -d -p 27017:27017 --name devdle-mongo mongo:8
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017/devdle` | MongoDB connection string |
| `PORT` | `3001` | Port the server listens on |
| `GEMINI_API_KEY` | — | Required for problem generation. Get one at [aistudio.google.com](https://aistudio.google.com) |
| `NODE_ENV` | `development` | `development` or `production` |
| `CORS_ORIGIN` | `*` | Allowed origin for CORS (set to your frontend URL in production) |

## Scripts

```bash
npm run dev    # Start dev server with hot reload (tsx watch)
npm run build  # Compile TypeScript to dist/
npm run start  # Run compiled output (production)
npm run lint   # Type-check without emitting (tsc --noEmit)
```

## API Endpoints

All routes are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/problems/:date` | Get the problem set for a date (`YYYY-MM-DD`). Returns 202 if today's problems are still being generated. |
| `GET` | `/api/internal/testcases/:problemId` | Internal test cases for a problem (used by in-browser runners). No CORS headers — only reachable same-origin. |

Problem IDs follow the format `YYYY-MM-DD_language_difficulty` (e.g. `2026-05-12_javascript_beginner`).

## Production Deployment

It's recommended to run this with Docker Compose alongside the frontend and MongoDB. A `docker-compose.yml` is provided at the root of the monorepo.

The CI pipeline (`.github/workflows/publish.yml`) builds and pushes `arthurllbender/devdle-backend:latest` to Docker Hub on every push to `master`. Set the `DOCKERPASS` secret in the repository settings to enable it.
