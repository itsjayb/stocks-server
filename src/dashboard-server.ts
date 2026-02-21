/**
 * Serves the pattern-results API and Vue dashboard static files on port 3000.
 * Run: tsx src/dashboard-server.ts
 * Build the dashboard first: cd dashboard && npm run build
 */

import 'dotenv/config';
import express from 'express';
import { readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output');
const DASHBOARD_DIST = join(ROOT, 'dashboard', 'dist');

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.get('/api/pattern-results', async (_req, res) => {
  try {
    const json = await readFile(join(OUTPUT_DIR, 'latest.json'), 'utf8');
    const data = JSON.parse(json);
    res.json(data);
  } catch (err) {
    res.status(404).json({
      error: 'No pattern results yet',
      message: (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'Run the pattern scan job first.' : (err as Error).message,
    });
  }
});

let dashboardBuilt = true;
try {
  await access(join(DASHBOARD_DIST, 'index.html'));
} catch {
  dashboardBuilt = false;
}

if (dashboardBuilt) {
  app.use(express.static(DASHBOARD_DIST));
  // SPA fallback: serve index.html for any non-API GET (Express 5 does not support app.get('*', ...))
  app.use((_req, res) => {
    res.sendFile(join(DASHBOARD_DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('html').send(`
      <!DOCTYPE html><html><head><title>Dashboard</title></head><body>
        <h1>Pattern Scanner Dashboard</h1>
        <p>Build the dashboard first: <code>cd dashboard && npm run build</code></p>
        <p><a href="/api/pattern-results">/api/pattern-results</a></p>
      </body></html>
    `);
  });
}

app.listen(PORT, () => {
  console.log(`[dashboard] Server at http://localhost:${PORT}`);
});
