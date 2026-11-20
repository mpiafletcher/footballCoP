import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import express, { type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { exerciseSchema } from '../src/model';
import { type Database } from './db';

const derive = promisify(scrypt);
const sessionMs = 7 * 24 * 60 * 60 * 1000;
const credentials = z.object({ email: z.email().max(254).transform(email => email.toLowerCase()), password: z.string().min(12).max(128) });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const fields = 'id, title, description, objective, age, player_count AS "playerCount", tags, visibility, diagram, updated_at';
const cookieName = 'footballcop_session';
const dummyHash = '0'.repeat(32) + ':' + '0'.repeat(128);

function token(req: Request) {
  return req.headers.cookie?.match(/(?:^|;\s*)footballcop_session=([a-f0-9]{64})(?:;|$)/)?.[1];
}

async function hash(password: string, salt: string) {
  return await derive(password, salt, 64) as Buffer;
}

export function makeApp(db: Database, production = false) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
  const cookie = { httpOnly: true, sameSite: 'lax' as const, secure: production, path: '/' };
  const api = express.Router();
  app.use('/api', api);
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method) && req.get('X-FootballCoP') !== 'studio') {
      res.status(403).json({ error: 'Invalid request origin.' });
      return;
    }
    next();
  });
  api.use(express.json({ limit: '768kb' }));

  async function coach(req: Request) {
    const session = token(req);
    if (!session) return undefined;
    const result = await db.query(
      'SELECT coaches.id, coaches.email FROM coaches JOIN sessions ON sessions.coach_id = coaches.id WHERE sessions.digest = $1 AND expires_at > now()',
      [digest(session)],
    );
    return result.rows[0];
  }

  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in 15 minutes.' } });

  api.post('/auth/:action', authLimit, async (req, res) => {
    const action = req.params.action;
    if (action !== 'register' && action !== 'login') {
      res.sendStatus(404);
      return;
    }
    const result = credentials.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Enter a valid email and a password of 12–128 characters.' });
      return;
    }
    const { email, password } = result.data;
    let id: string;
    if (action === 'register') {
      id = randomUUID();
      const salt = randomBytes(16).toString('hex');
      const passwordHash = salt + ':' + (await hash(password, salt)).toString('hex');
      const created = await db.query('INSERT INTO coaches (id, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id', [id, email, passwordHash]);
      if (!created.rows.length) {
        res.status(409).json({ error: 'Account could not be created. Try signing in.' });
        return;
      }
    } else {
      const { rows: [account] } = await db.query('SELECT id, password_hash FROM coaches WHERE email = $1', [email]);
      const [salt, expected] = String(account?.password_hash ?? dummyHash).split(':');
      const valid = timingSafeEqual(await hash(password, salt), Buffer.from(expected, 'hex'));
      if (!valid || !account) {
        res.status(401).json({ error: 'Email or password is incorrect.' });
        return;
      }
      id = String(account.id);
    }
    const session = randomBytes(32).toString('hex');
    await db.transaction(async transaction => {
      const previous = token(req);
      if (previous) await transaction.query('DELETE FROM sessions WHERE digest = $1', [digest(previous)]);
      await transaction.query('DELETE FROM sessions WHERE expires_at <= now()');
      await transaction.query('INSERT INTO sessions VALUES ($1, $2, $3)', [digest(session), id, new Date(Date.now() + sessionMs)]);
    });
    res.cookie(cookieName, session, { ...cookie, maxAge: sessionMs }).json({ id, email });
  });

  api.get('/session', async (req, res) => { res.json(await coach(req) ?? null); });
  api.post('/session/logout', async (req, res) => {
    const session = token(req);
    if (session) await db.query('DELETE FROM sessions WHERE digest = $1', [digest(session)]);
    res.clearCookie(cookieName, cookie).sendStatus(204);
  });

  api.get('/shared/:id', async (req, res) => {
    if (!z.uuid().safeParse(req.params.id).success) { res.sendStatus(404); return; }
    const { rows: [row] } = await db.query(
      'SELECT ' + fields + ' FROM exercises WHERE id = $1 AND visibility IN (\'public\', \'unlisted\')', [req.params.id],
    );
    if (row) res.json(row);
    else res.sendStatus(404);
  });

  const library = express.Router();
  api.use('/exercises', library);
  library.use(async (req, res, next) => {
    const account = await coach(req);
    if (!account) { res.sendStatus(401); return; }
    res.locals.coach = account.id;
    next();
  });
  library.param('id', (_req, res, next, id) => {
    if (!z.uuid().safeParse(id).success) { res.sendStatus(404); return; }
    next();
  });
  library.get('/', async (_req, res) => {
    const { rows } = await db.query(
      'SELECT id, title, visibility, updated_at FROM exercises WHERE author_id = $1 ORDER BY updated_at DESC',
      [res.locals.coach],
    );
    res.json(rows);
  });
  library.get('/:id', async (req, res) => {
    const { rows: [row] } = await db.query(
      'SELECT ' + fields + ' FROM exercises WHERE id = $1 AND author_id = $2', [req.params.id, res.locals.coach],
    );
    if (row) res.json(row);
    else res.sendStatus(404);
  });
  const save: express.RequestHandler<{ id?: string }> = async (req, res) => {
    const parsed = exerciseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Check the exercise title, metadata and pitch settings.' });
      return;
    }
    const { title, description, objective, age, playerCount, tags, visibility, diagram } = parsed.data;
    const values = [req.params.id ?? randomUUID(), res.locals.coach, title, description, objective, age, playerCount, tags, visibility, JSON.stringify(diagram)];
    const { rows: [row] } = await db.query(req.params.id
      ? 'UPDATE exercises SET title=$3, description=$4, objective=$5, age=$6, player_count=$7, tags=$8, visibility=$9, diagram=$10, updated_at=now() WHERE id=$1 AND author_id=$2 RETURNING ' + fields
      : 'INSERT INTO exercises (id, author_id, title, description, objective, age, player_count, tags, visibility, diagram) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ' + fields,
    values);
    if (row) res.status(req.params.id ? 200 : 201).json(row);
    else res.sendStatus(404);
  };
  library.post('/', save);
  library.put('/:id', save);
  library.delete('/:id', async (req, res) => {
    const result = await db.query('DELETE FROM exercises WHERE id = $1 AND author_id = $2 RETURNING id', [req.params.id, res.locals.coach]);
    res.sendStatus(result.rows.length ? 204 : 404);
  });
  api.use((_req, res) => { res.sendStatus(404); });
  const onError: express.ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
    if (status === 500) console.error('API request failed', error.code ?? error.name);
    res.status(status).json({ error: status === 500 ? 'The server couldn’t complete the request.' : 'Invalid or oversized request.' });
  };
  api.use(onError);
  return app;
}
