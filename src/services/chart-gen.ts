/**
 * Generate stock chart images via QuickChart.io API for tweet media attachments.
 * Uses Alpaca bars data to render simple, clean price charts.
 */

import { fetchAlpacaBars } from './alpaca-bars.js';
import type { OhlcBar } from '../types.js';

const QUICKCHART_URL = (process.env.QUICKCHART_BASE_URL || 'https://quickchart.io').replace(/\/$/, '');
const CHART_WIDTH = 800;
const CHART_HEIGHT = 418;

interface ChartConfig {
  type: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor?: string;
      fill?: boolean;
      pointRadius?: number;
      borderWidth?: number;
      tension?: number;
    }>;
  };
  options: Record<string, unknown>;
}

function buildPriceChartConfig(symbol: string, bars: OhlcBar[]): ChartConfig {
  const recent = bars.slice(-60);
  const labels = recent.map((b) => {
    const d = new Date(b.t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const prices = recent.map((b) => b.c);

  const firstPrice = prices[0] ?? 0;
  const lastPrice = prices[prices.length - 1] ?? 0;
  const isUp = lastPrice >= firstPrice;

  const borderColor = isUp ? '#22c55e' : '#ef4444';
  const bgColor = isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `$${symbol}`,
          data: prices,
          borderColor,
          backgroundColor: bgColor,
          fill: true,
          pointRadius: 0,
          borderWidth: 2.5,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `$${symbol} — ${recent.length} Day Price Action`,
          font: { size: 18, weight: 'bold' },
          color: '#e2e8f0',
        },
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', maxTicksLimit: 10 },
          grid: { color: 'rgba(148,163,184,0.1)' },
        },
        y: {
          ticks: {
            color: '#94a3b8',
            callback: (val: number) => `$${val.toFixed(2)}`,
          },
          grid: { color: 'rgba(148,163,184,0.15)' },
        },
      },
      layout: { padding: 10 },
    },
  };
}

/**
 * Generate a price chart image for a symbol. Returns a PNG buffer or null on failure.
 */
export async function generateChartImage(symbol: string, days = 60): Promise<Buffer | null> {
  try {
    const barsMap = await fetchAlpacaBars([symbol], { days });
    const bars = barsMap[symbol];
    if (!bars?.length || bars.length < 5) {
      console.warn(`[chart-gen] Not enough bars for ${symbol} (got ${bars?.length ?? 0})`);
      return null;
    }

    const config = buildPriceChartConfig(symbol, bars);

    const res = await fetch(`${QUICKCHART_URL}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chart: config,
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
        backgroundColor: '#1e293b',
        format: 'png',
      }),
    });

    if (!res.ok) {
      console.error('[chart-gen] QuickChart API error:', res.status);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('[chart-gen] Failed to generate chart:', (err as Error).message);
    return null;
  }
}

/**
 * Pick a symbol for chart generation based on tweet type and available data.
 * For news: use the first cash-tagged symbol found in the tweet text.
 * For pattern/strategy: use a trending or popular symbol.
 */
export function extractChartSymbol(tweetText: string, candidates: string[]): string | null {
  const match = tweetText.match(/\$([A-Z]{1,5})\b/);
  if (match) return match[1];
  if (candidates.length > 0) return candidates[0];
  return 'SPY';
}
