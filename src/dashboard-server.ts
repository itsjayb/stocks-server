/**
 * Serves service APIs and Vue dashboard static files on port 3000.
 * Endpoints:
 *   GET /api/pattern-results     — legacy file-based pattern results
 *   GET /api/smart-movers        — enriched movers (query: ?date=YYYY-MM-DD)
 *   GET /api/pattern-alerts      — pattern alerts
 *   GET /api/sector-momentum     — sector rankings
 *   GET /api/momentum-scans      — momentum scores
 *   GET /api/stock-picks         — stock of the day/week
 *   GET /api/market-insights     — rules-based insights
 *
 * Run: tsx src/dashboard-server.ts
 * Build the dashboard first: cd dashboard && npm run build
 */

import 'dotenv/config';
import express from 'express';
import { readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  fetchSmartMovers,
  fetchPatternAlerts,
  fetchSectorMomentum,
  fetchMomentumScans,
  fetchStockPicks,
  fetchMarketInsights,
} from './db/supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output');
const DASHBOARD_DIST = join(ROOT, 'dashboard', 'dist');

const PORT = Number(process.env.PORT) || 3000;
const app = express();

// Legacy file-based pattern results
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

const MOCK_CARDS = [
  { symbol: 'AAPL', pattern: { type: 'head_shoulders', date: '2025-03-08' }, patternTypes: ['head_shoulders'], patternCount: 1, volume_ratio: 2.8, high_volume: true, temperature: 'hot' as const },
  { symbol: 'TSLA', pattern: { type: 'golden_cross', date: '2025-03-07' }, patternTypes: ['golden_cross', 'breakout'], patternCount: 2, volume_ratio: 1.7, high_volume: false, temperature: 'potential' as const },
  { symbol: 'NVDA', pattern: { type: 'breakout', date: '2025-03-06' }, patternTypes: ['breakout'], patternCount: 1, volume_ratio: 0.9, high_volume: false, temperature: 'cool' as const },
  { symbol: 'META', pattern: { type: 'bullish_engulfing', date: '2025-03-05' }, patternTypes: ['bullish_engulfing'], patternCount: 1, volume_ratio: 3.2, high_volume: true, temperature: 'hot' as const },
  { symbol: 'AMD', pattern: { type: 'double_bottom', date: '2025-03-04' }, patternTypes: ['double_bottom'], patternCount: 1, volume_ratio: 1.2, high_volume: false, temperature: 'cool' as const },
];

// Pattern cards: pattern results merged with volume (smart_movers + momentum_scans)
app.get('/api/pattern-cards', async (req, res) => {
  const date = (req.query.date as string) || undefined;
  const useMock = (req.query.mock as string) === 'true';
  try {
    if (useMock) {
      const today = new Date().toISOString().slice(0, 10);
      return res.json({
        scanDate: today,
        scannedAt: new Date().toISOString(),
        totalScanned: 100,
        withPatternsCount: 5,
        cards: MOCK_CARDS,
      });
    }
    const json = await readFile(join(OUTPUT_DIR, 'latest.json'), 'utf8');
    const patternData = JSON.parse(json);
    const [movers, scans] = await Promise.all([
      fetchSmartMovers(date),
      fetchMomentumScans(date),
    ]);
    const volumeBySymbol = new Map<string, { volume_ratio: number; unusual_volume: boolean }>();
    for (const m of movers as Array<{ symbol: string; volume_ratio?: number; unusual_volume?: boolean }>) {
      volumeBySymbol.set(m.symbol, {
        volume_ratio: m.volume_ratio ?? 0,
        unusual_volume: m.unusual_volume ?? false,
      });
    }
    for (const s of scans as Array<{ symbol: string; volume_ratio?: number }>) {
      if (!volumeBySymbol.has(s.symbol)) {
        volumeBySymbol.set(s.symbol, {
          volume_ratio: s.volume_ratio ?? 0,
          unusual_volume: (s.volume_ratio ?? 0) >= 2,
        });
      }
    }
    const mergedBySymbol = new Map<string, { symbol: string; patterns: Array<{ type: string; date: string }> }>();
    for (const item of (patternData.withPatterns ?? []) as Array<{ symbol: string; patterns: Array<{ type: string; date: string }> }>) {
      const existing = mergedBySymbol.get(item.symbol);
      if (!existing) {
        mergedBySymbol.set(item.symbol, {
          symbol: item.symbol,
          patterns: [...item.patterns],
        });
        continue;
      }
      existing.patterns.push(...item.patterns);
    }

    const cards = Array.from(mergedBySymbol.values()).map(
      (item) => {
        const uniquePatterns = [
          ...new Map(
            item.patterns.map((p) => [`${p.type}::${p.date}`, p] as const),
          ).values(),
        ];
        const vol = volumeBySymbol.get(item.symbol) ?? { volume_ratio: 0, unusual_volume: false };
        const primaryPattern = uniquePatterns[0];
        let temperature: 'hot' | 'potential' | 'cool' = 'cool';
        if (vol.unusual_volume || vol.volume_ratio >= 2) temperature = 'hot';
        else if (vol.volume_ratio >= 1.5 || uniquePatterns.length > 1) temperature = 'potential';
        return {
          symbol: item.symbol,
          pattern: primaryPattern ? { type: primaryPattern.type, date: primaryPattern.date } : null,
          patternTypes: [...new Set(uniquePatterns.map((p) => p.type))],
          patternCount: uniquePatterns.length,
          volume_ratio: vol.volume_ratio,
          high_volume: vol.unusual_volume || vol.volume_ratio >= 2,
          temperature,
        };
      }
    );
    res.json({
      scanDate: patternData.scanDate,
      scannedAt: patternData.scannedAt,
      totalScanned: patternData.totalScanned ?? 0,
      withPatternsCount: cards.length,
      cards,
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      const today = new Date().toISOString().slice(0, 10);
      return res.json({
        scanDate: today,
        scannedAt: new Date().toISOString(),
        totalScanned: 0,
        withPatternsCount: 5,
        cards: MOCK_CARDS,
      });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

// Smart Movers
app.get('/api/smart-movers', async (req, res) => {
  const date = (req.query.date as string) || undefined;
  const data = await fetchSmartMovers(date);
  res.json({ date: date || new Date().toISOString().slice(0, 10), count: data.length, movers: data });
});

// Pattern Alerts
app.get('/api/pattern-alerts', async (req, res) => {
  const date = (req.query.date as string) || undefined;
  const data = await fetchPatternAlerts(date);
  res.json({ date: date || new Date().toISOString().slice(0, 10), count: data.length, alerts: data });
});

// Sector Momentum
app.get('/api/sector-momentum', async (req, res) => {
  const date = (req.query.date as string) || undefined;
  const data = await fetchSectorMomentum(date);
  res.json({ date: date || new Date().toISOString().slice(0, 10), count: data.length, sectors: data });
});

// Momentum Scans
app.get('/api/momentum-scans', async (req, res) => {
  const date = (req.query.date as string) || undefined;
  const data = await fetchMomentumScans(date);
  res.json({ date: date || new Date().toISOString().slice(0, 10), count: data.length, scans: data });
});

// Stock Picks
app.get('/api/stock-picks', async (req, res) => {
  const date = (req.query.date as string) || undefined;
  const data = await fetchStockPicks(date);
  res.json({ date: date || new Date().toISOString().slice(0, 10), count: data.length, picks: data });
});

// Market Insights
app.get('/api/market-insights', async (req, res) => {
  const date = (req.query.date as string) || undefined;
  const data = await fetchMarketInsights(date);
  res.json({ date: date || new Date().toISOString().slice(0, 10), count: data.length, insights: data });
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
