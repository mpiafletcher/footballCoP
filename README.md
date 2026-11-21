# FootballCoP Studio

FootballCoP is a football coaching community of practice. Studio gives coaches a free workspace to draw training exercises and build a private library. Animate player and ball movement in Studio and share diagrams or animations through unlisted or public read-only links.

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
- Use **Players & ball**, **Equipment**, or **Drawing** to find a tool. Tap or click the pitch to place the selected element, or drag to draw an arrow, path, line, or zone. Keep the player tool active to place several players.
- Switch to **Select** to reposition elements. Hold Shift while selecting with a mouse or toggle **Multi-select** on touch. Change colour, team, or selection from the controls below the pitch.
- Use Ctrl/Command+Z to undo, Ctrl/Command+Shift+Z to redo, arrow keys to nudge selected elements, and Delete to remove them. Ctrl/Command+S saves.
- Give the exercise a title and save it. To resume, choose it from **My library**. Exercise details contains metadata, visibility, and duplicate and delete actions. A saved public or unlisted exercise has a share link.

## Draw and animate on a phone

- Turn your phone sideways and choose **Pitch view** for a larger canvas. **More tools** opens equipment and drawing controls. Pinch to zoom, then move two fingers together to pan.
- Pick **Movement arrow** and tap the start and end points. Drag either white handle to adjust the line. Dragging across the pitch also works for drawing.
- Tap a moment thumbnail to edit it. Toggle **Previous positions** to see where players and the ball were in the preceding moment.
- Select the ball, choose **Quick pass**, then tap a player or a spot. Studio inserts a moment with the ball at that destination.
- Choose **Random passing drill** from **My library** for an editable four-player exercise. Studio varies the passing pattern, orientation, and timing. Press **Play** immediately, or customize the drill and save a copy to your library.

## Try a run and pass

1. Create an exercise in Studio. Add a player and a ball in different places on the pitch.
2. Click **Next moment**. Drag the player to where the run should end. Change **Seconds from previous moment** to `2` and press Enter.
3. Click **Next moment** again. Drag the ball to the player. The player stays at the end of their run.
4. Click **Play**. The player should run first and the ball should move second. Try **Pause**, **Resume**, and **Stop**. Tap a moment thumbnail to revisit and edit any pose. Undo and redo also cover animation edits.
5. Save the exercise, reload the page, and reopen it from **My library**. Confirm the three moments and two-second first transition are still there, then play it again.
6. To test sharing, set visibility to **Unlisted** in Exercise details, save, and open the share link in a private browser window. Press **Play** to see the same sequence.

The first moment is where you add, remove, and recolour elements. Later moments edit player and ball positions. Equipment and drawings stay fixed. PNG export captures the displayed pose.

## Run checks

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Unit and API integration tests default to an isolated in-memory database. Point `DATABASE_URL` to a **disposable PostgreSQL test database** to exercise the production adapter and SQL. API tests apply migrations and create test accounts. Browser checks start isolated services and cover desktop mouse and keyboard input, tablet touch input, PNG export, save/reopen, and playback of saved and shared animations.

## Production

Create a PostgreSQL database and provide its connection URI in `DATABASE_URL`. Build with `npm ci && npm run build`, then start with `NODE_ENV=production npm start`. The server serves the built UI and API from the same origin and applies the checked-in SQL migrations at startup. The migration account needs DDL privileges. Configure HTTPS at the reverse proxy for secure cookies and browsers’ secure-context APIs.

The production listener defaults to `0.0.0.0:3001`. Set `PORT` or `HOST` to override. Set `TRUST_PROXY_HOPS` to the known proxy hop count when deploying behind a trusted fixed-length proxy chain so the authentication rate limit can use client addresses.

Authentication currently uses email and password with scrypt-hashed credentials and revocable database-backed sessions. It has an in-process rate limiter. Email verification, account recovery, and distributed rate limiting are planned before a general public rollout.

[Architecture decisions](docs/architecture.md) · [Backlog and milestone scope](docs/backlog.md)
