# FootballCoP backlog

## Delivered · Studio save and reopen

- Configurable SVG pitch presets and drawing tools with player and equipment placement, touch, selection, undo/redo, and PNG export.
- Sign-in, private library, exercise metadata, duplication, deletion, public and unlisted links, and owner-scoped database operations.
- Versioned exercise schema and database groundwork for animation and community.
- Build, domain, authorization, persistence, and desktop and tablet checks.

## Recommended next milestone · Manual animation

1. Add **Next moment** to copy the current player and ball positions into an editable moment while retaining element IDs.
2. Add Play, Pause, and duration controls with deterministic interpolation.
3. Save and reopen animated drills and verify that undo, duplication, and removal keep snapshots consistent.
4. Extend sharing to read-only playback. Schedule GIF and MP4 export after playback is stable.

## Later

- Add folders, collections, tagging workflows, and YouTube bookmarks with timestamped notes.
- Add coach profiles, exercise discovery, attributed variants, comments, practical reviews, reactions, and moderation.
- Track version history and introduce optimistic concurrency for edits from multiple devices.
- Add email verification, account recovery, and distributed authentication throttling before a general public rollout.
- Explore paid generation and adaptation behind the shared schema after the free manual workflow is established.

## Known limitations

- The library is a flat list. Diagram undo history is limited to 100 operations per editing session. A diagram supports up to 500 elements.
- The schema and server storage support keyframe data. Studio currently edits and exports static diagrams.
- Public and unlisted links show a read-only diagram. Community tables are prepared for future workflows.
- Touch testing uses Chromium’s emulated tablet input. Physical tablet and Safari checks remain.
- Desktop and tablet editors support pointer placement and dragging. Keyboard shortcuts cover editing selected objects, with keyboard-only placement pending.
