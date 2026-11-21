import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { diagramSchema, moveElements, newExercise, type FieldElement } from '../src/model';
import { buildMoments, deleteMoment, sampleMoments, updateMoment } from '../src/animation';


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

test('sparse moments interpolate over their own durations and preserve surviving poses on deletion', () => {
  const { diagram } = newExercise();
  const player: FieldElement = { id: randomUUID(), kind: 'player', colour: '#ffffff', position: { x: .25, y: .5 } };
  const ball: FieldElement = { ...player, kind: 'ball', id: randomUUID() };
  const cone: FieldElement = { ...player, kind: 'cone', id: randomUUID() };
  diagram.elements = [player, ball, cone];
  diagram.keyframes = [
    { durationMs: 1000, positions: { [player.id]: { x: .75, y: .5 }, [cone.id]: { x: 0, y: 0 } } },
    { durationMs: 2000, positions: { [ball.id]: { x: .75, y: .5 } } },
  ];
  const moments = buildMoments(diagram);
  assert.deepEqual(moments.map(moment => moment.at), [0, 1000, 3000]);
  assert.deepEqual(sampleMoments(moments, 500).map(item => item.position.x), [.5, .25, .25]);
  assert.deepEqual(sampleMoments(moments, 2000).map(item => item.position.x), [.75, .5, .25]);
  assert.deepEqual(sampleMoments(moments, 10000), moments[2].elements);
  assert.deepEqual(buildMoments(deleteMoment(diagram, 1))[1].elements, moments[2].elements);

  const moved = moveElements(moments[1].elements, new Set([ball.id]), .25, 0);
  const edited = updateMoment(diagram, 1, moments[1].elements, moved);
  assert.deepEqual(edited.elements, diagram.elements);
  assert.deepEqual(edited.keyframes[0].positions[ball.id], { x: .5, y: .5 });
  assert.equal(diagram.keyframes[0].positions[ball.id], undefined);
});
