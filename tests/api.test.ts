import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { makeApp } from '../server/app';
import { migrate, openDatabase } from '../server/db';
import { newExercise } from '../src/model';

test('account sessions, owner-only library and diagram persistence', async t => {
  const embedded = process.env.DATABASE_URL ? undefined : new PGlite();
  const db = embedded ?? await openDatabase();
  if (embedded) t.after(() => embedded.close());
  await migrate(db);
  await migrate(db);
  const server = makeApp(db, true).listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const request = (path: string, method = 'GET', cookie = '', body?: unknown, csrf = true) =>
    fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method, headers: {
        Cookie: cookie, ...(csrf ? { 'X-FootballCoP': 'studio' } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      }, body: body === undefined ? undefined : JSON.stringify(body),
    });
  const first = { email: `${randomUUID()}@example.com`, password: 'football-test-password' };
  const second = { ...first, email: `${randomUUID()}@example.com` };
  async function register(account: typeof first) {
    const response = await request('/auth/register', 'POST', '', account);
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Secure/);
    return cookie.split(';')[0];
  }
  const owner = await register(first);
  const stranger = await register(second);
  assert.equal((await request('/exercises')).status, 401);
  assert.equal((await request('/session/logout', 'POST', owner, undefined, false)).status, 403);

  const exercise = newExercise();
  exercise.title = '10-player transition';
  exercise.diagram.pitch = { preset: 'custom', orientation: 'vertical', length: 52, width: 37, colour: '#224433' };
  exercise.diagram.elements = Array.from({ length: 10 }, (_, number) => ({
    id: randomUUID(), kind: 'player', colour: '#ffcc00', team: 'home', number: number + 1,
    position: { x: number / 11, y: .6 },
  }));
  exercise.diagram.elements.push({ id: randomUUID(), kind: 'cone', colour: '#cc8800', position: { x: .42, y: .5 } });
  exercise.diagram.keyframes = [{ durationMs: 600, positions: { [exercise.diagram.elements[0].id]: { x: .3, y: .3 } } }];
  const created = await request('/exercises', 'POST', owner, exercise);
  assert.equal(created.status, 201);
  const saved = await created.json();
  const path = '/exercises/' + saved.id;
  const shared = '/shared/' + saved.id;
  assert.equal((await request(path, 'GET', owner)).status, 200);
  assert.deepEqual((await (await request(path, 'GET', owner)).json()).diagram, exercise.diagram);
  assert.deepEqual(await (await request('/exercises', 'GET', stranger)).json(), []);
  for (const method of ['GET', 'PUT', 'DELETE']) {
    assert.equal((await request(path, method, stranger, method === 'PUT' ? exercise : undefined)).status, 404);
  }
  assert.equal((await request(shared)).status, 404);
  exercise.diagram.elements[0].colour = '#9966aa';
  exercise.diagram.elements[0].position.x = .36;
  exercise.visibility = 'unlisted';
  assert.equal((await request(path, 'PUT', owner, exercise)).status, 200);
  assert.deepEqual((await (await request(shared)).json()).diagram, exercise.diagram);
  exercise.visibility = 'private';
  assert.equal((await request(path, 'PUT', owner, exercise)).status, 200);
  assert.equal((await request(shared)).status, 404);
  assert.equal((await request('/auth/login', 'POST', '', { ...first, password: 'wrong-password' })).status, 401);
  assert.equal((await request('/session/logout', 'POST', owner)).status, 204);
  assert.equal((await request(path, 'GET', owner)).status, 401);
  const login = await request('/auth/login', 'POST', '', first);
  assert.equal(login.status, 200);
  const fresh = login.headers.get('set-cookie')!.split(';')[0];
  assert.deepEqual((await (await request(path, 'GET', fresh)).json()).diagram, exercise.diagram);
  assert.equal((await request(path, 'DELETE', fresh)).status, 204);
});
