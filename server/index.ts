import express from 'express';
import { fileURLToPath } from 'node:url';
import { makeApp } from './app';
import { migrate, openDatabase } from './db';

const production = process.env.NODE_ENV === 'production';
const db = await openDatabase();
await migrate(db);
const app = makeApp(db, production);
if (production) {
  app.use(express.static(fileURLToPath(new URL('../dist/', import.meta.url))));
  app.get('/share/:id', (_req, res) => res.sendFile(fileURLToPath(new URL('../dist/index.html', import.meta.url))));
}
app.listen(Number(process.env.PORT || 3001), process.env.HOST || (production ? '0.0.0.0' : '127.0.0.1'), () => {
  console.log('FootballCoP API is ready');
});
