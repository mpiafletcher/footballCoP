import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  use: { baseURL: 'http://127.0.0.1:5177' },
  webServer: [
    { command: 'npm start', env: { PORT: '3017', DATA_DIR: 'memory://', DATABASE_URL: '' }, url: 'http://127.0.0.1:3017/api/session' },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5177 --strictPort', env: { API_TARGET: 'http://127.0.0.1:3017' }, url: 'http://127.0.0.1:5177' },
  ],
});
