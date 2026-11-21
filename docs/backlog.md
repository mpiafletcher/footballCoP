# FootballCoP backlog

## Delivered · Studio save and reopen

- Configurable SVG pitch presets and drawing tools with player and equipment placement, touch, selection, undo/redo, and PNG export.
- Sign-in, private library, exercise metadata, duplication, deletion, public and unlisted links, and owner-scoped database operations.
- Versioned exercise schema and database groundwork for animation and community.
- Build, domain, authorization, persistence, and desktop and tablet checks.

## Delivered · Manual animation

- Create, edit, and delete moments with stable player and ball identities.
- Set transition durations, interpolate movements, pause and resume, and replay from the first moment.
- Reopen saved moments and watch animations on read-only share links.
- Verify animation history, interpolation, timing, persistence, and guest playback with automated tests.

## Recommended next milestone · Library organization

1. Add private folders and collections.
2. Add tag filtering and search to help coaches find diagrams and animations.
3. Add YouTube bookmarks and timestamped coaching notes.

## Later

- Add GIF and MP4 export after validating manual playback with coaches.
- Add coach profiles, exercise discovery, attributed variants, comments, practical reviews, reactions, and moderation.
- Track version history and introduce optimistic concurrency for edits from multiple devices.
- Add email verification, account recovery, and distributed authentication throttling before a general public rollout.
- Explore paid generation and adaptation behind the shared schema after the free manual workflow is established.

## Known limitations

- The library is a flat list. Diagram undo history is limited to 100 operations per editing session. A diagram supports up to 500 elements.
- Animations support up to 100 transitions. Player and ball movements interpolate in straight lines. PNG export captures one pose.
- Public and unlisted links offer read-only playback. Community tables are prepared for future workflows.
- Touch testing uses Chromium’s emulated tablet input. Physical tablet and Safari checks remain.
- Desktop and tablet editors support pointer placement and dragging. Keyboard shortcuts cover editing selected objects, with keyboard-only placement pending.
