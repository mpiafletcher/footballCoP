import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { diagramSchema, moveElements, newExercise, type FieldElement } from '../src/model';

test('moving a selection to a boundary preserves spacing and drawing endpoints', () => {
  const player: FieldElement = { id: randomUUID(), kind: 'player', colour: '#123456', position: { x: .25, y: .3 } };
  const arrow: FieldElement = { id: randomUUID(), kind: 'movement', colour: '#123456', position: { x: .5, y: .5 }, end: { x: .75, y: .8 } };
  const moved = moveElements([player, arrow], new Set([player.id, arrow.id]), 1, 1);
  assert.ok(Math.abs(moved[0].position.y - .5) < 1e-9);
  assert.equal(moved[0].position.x, .5);
  assert.deepEqual('end' in moved[1] && moved[1].end, { x: 1, y: 1 });
  assert.deepEqual(player.position, { x: .25, y: .3 });
});

test('diagram parsing preserves stable IDs and rejects invalid coordinates or duplicate IDs', () => {
  const diagram = newExercise().diagram;
  const player: FieldElement = { id: randomUUID(), kind: 'player', position: { x: .2, y: .9 }, colour: '#123abc', team: 'neutral', number: 4 };
  diagram.elements.push(player);
  diagram.keyframes.push({ durationMs: 500, positions: { [player.id]: { x: .4, y: .5 } } });
  assert.deepEqual(diagramSchema.parse(JSON.parse(JSON.stringify(diagram))), diagram);
  assert.equal(diagramSchema.safeParse({ ...diagram, elements: [player, player] }).success, false);
  assert.equal(diagramSchema.safeParse({ ...diagram, elements: [{ ...player, position: { x: 1.1, y: 0 } }] }).success, false);
});
