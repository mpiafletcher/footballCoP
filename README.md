# FootballCoP Studio

FootballCoP is a football coaching community of practice. Studio gives coaches a free workspace to draw training exercises and build a private library. An exercise can also have an unlisted or public read-only link.

## Run locally

Requires Node.js 24 LTS and npm. From the repository root:

```sh
npm ci
npm run dev:api
```

In a second terminal:

```sh
npm run dev
```

Open the URL printed by Vite, create an account, and sign in. The API applies migrations at startup and stores development data in local PostgreSQL-compatible PGlite files under `.data/`. Set `DATA_DIR` on the API process to use another development directory. Set `DATABASE_URL` to use a PostgreSQL server instead.

## Use Studio

- Choose a pitch preset. Open **Pitch settings** for dimensions, orientation, colour, numbers, and metre-grid snapping.
- Select a player or equipment tool and tap or click the pitch. Keep the player tool active to place several players. Select a drawing tool and drag to create an arrow, path, line, or zone.
- Switch to **Select** to reposition elements. Hold Shift while selecting with a mouse or toggle **Multi-select** on touch. Change colour, team, or selection from the controls below the pitch.
- Use Ctrl/Command+Z to undo, Ctrl/Command+Shift+Z to redo, arrow keys to nudge selected elements, and Delete to remove them. Ctrl/Command+S saves.
- Give the exercise a title and save it. To resume, choose it from **My library**. Exercise details contains metadata, visibility, and duplicate and delete actions. A saved public or unlisted exercise has a share link.

## Run checks

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Unit and API integration tests default to an isolated in-memory database. Point `DATABASE_URL` to a **disposable PostgreSQL test database** to exercise the production adapter and SQL. API tests apply migrations and create test accounts. Browser checks start isolated services and cover desktop mouse and keyboard input, tablet touch input, export, and save/reopen.

## Production

Create a PostgreSQL database and provide its connection URI in `DATABASE_URL`. Build with `npm ci && npm run build`, then start with `NODE_ENV=production npm start`. The server serves the built UI and API from the same origin and applies the checked-in SQL migrations at startup. The migration account needs DDL privileges. Configure HTTPS at the reverse proxy for secure cookies and browsers’ secure-context APIs.

The production listener defaults to `0.0.0.0:3001`. Set `PORT` or `HOST` to override. Set `TRUST_PROXY_HOPS` to the known proxy hop count when deploying behind a trusted fixed-length proxy chain so the authentication rate limit can use client addresses.

Authentication currently uses email and password with scrypt-hashed credentials and revocable database-backed sessions. It has an in-process rate limiter. Email verification, account recovery, and distributed rate limiting are planned before a general public rollout.

[Architecture decisions](docs/architecture.md) · [Backlog and milestone scope](docs/backlog.md)
