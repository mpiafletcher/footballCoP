# Architecture decisions

## ADR 001 · React, TypeScript, and SVG

**Status** Accepted

SVG provides a shared scene graph for interactive editing, read-only share pages, and PNG export. It supports direct pointer targeting, vector geometry, and coordinate transforms in the browser. Konva offers a managed canvas scene graph and an attractive path for much larger scenes, with extra runtime and separate work for semantic controls. The initial diagram limit is 500 elements, which fits the SVG approach.

Pitch geometry uses metres in the view box and a single SVG transform for vertical orientation. Both axes scale uniformly, so a 42 × 19 m training area retains its aspect ratio. The editor maps screen input back through the inverse transform. Standard-sized pitches use dimensions from IFAB Law 1. Markings scale or fit within undersized practice layouts. Equipment icons remain legible at different pitch sizes.

[IFAB Law 1 · The Field of Play](https://www.theifab.com/laws/latest/the-field-of-play/)

## ADR 002 · A shared, versioned exercise document

**Status** Accepted

One Zod schema validates the JSON document at the HTTP boundary. Stable UUIDs identify elements. Colours, team assignments, and labels are object properties. Position and drawing endpoints use normalized pitch coordinates, so resizing or rotating the view preserves their relative layout. The editor keeps pointer previews and undo/redo history in memory. Only completed edits change the document.

Version 1 stores keyframe durations and optional position maps keyed by element ID. Initial positions live on the elements. Future playback can interpolate sparse positions using the previous resolved position. Assigning a stable identity to a ball or player lets later moments move the same object. Deleting an element clears its keyframe entries. Later schema versions should use explicit readers and migrations.

Future AI integrations should return validated exercise documents or proposed edits through the same application and validation boundary. The editor, library, and rendering require only the canonical model.

## ADR 003 · PostgreSQL owns persistence and authorization

**Status** Accepted

PostgreSQL tables store coach identities, hashed session tokens, exercise metadata, and diagram JSON. The API derives the coach ID from a revocable session and scopes each library operation by author ID. The share endpoint selects only public or unlisted rows and omits identity and account data. Unlisted links use random exercise IDs.

Development can use a persistent embedded PostgreSQL runtime. Production uses a network PostgreSQL adapter and requires a connection URI. Migrations are ordered, tracked in the database, and run under a transaction-scoped advisory lock.

The community migration adds source links, an attribution snapshot column, version snapshots, discussions, reviews, reactions, reporting, and editorial featuring. A future variant operation should validate source visibility, create an independent exercise for the current coach, and capture original attribution in the same transaction. Each variant will use its own exercise ID for versions, feedback, and discussion.
