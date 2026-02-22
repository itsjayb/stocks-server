/**
 * Supabase client and storage helpers for all services.
 * Server-side jobs use SUPABASE_SERVICE_KEY (full write access).
 * If no key is available, operations are skipped gracefully so local dev still works.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  SmartMover,
  PatternAlert,
  SectorMomentumRow,
  MomentumScanRow,
  StockPick,
  MarketInsight,
  ServiceTierRow,
} from '../types.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[supabase] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY – DB writes disabled.');
    return null;
  }
  _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Smart Movers
// ---------------------------------------------------------------------------

export async function storeSmartMovers(movers: SmartMover[]): Promise<void> {
  const sb = getSupabase();
  if (!sb || movers.length === 0) return;

  const scanDate = today();
  const scannedAt = new Date().toISOString();
  const rows = movers.map((m) => ({ scan_date: scanDate, scanned_at: scannedAt, ...m }));

  const { error } = await sb.from('smart_movers').insert(rows);
  if (error) console.error('[supabase] storeSmartMovers error:', error.message);
  else console.log(`[supabase] Stored ${rows.length} smart movers for ${scanDate}`);
}

export async function fetchSmartMovers(date?: string) {
  const sb = getSupabase();
  if (!sb) return [];
  const d = date || today();
  const { data, error } = await sb.from('smart_movers').select('*').eq('scan_date', d);
  if (error) { console.error('[supabase] fetchSmartMovers error:', error.message); return []; }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Pattern Alerts
// ---------------------------------------------------------------------------

export async function storePatternAlerts(alerts: PatternAlert[]): Promise<void> {
  const sb = getSupabase();
  if (!sb || alerts.length === 0) return;

  const scanDate = today();
  const scannedAt = new Date().toISOString();
  const rows = alerts.map((a) => ({ scan_date: scanDate, scanned_at: scannedAt, ...a }));

  const { error } = await sb.from('pattern_alerts').insert(rows);
  if (error) console.error('[supabase] storePatternAlerts error:', error.message);
  else console.log(`[supabase] Stored ${rows.length} pattern alerts for ${scanDate}`);
}

export async function fetchPatternAlerts(date?: string) {
  const sb = getSupabase();
  if (!sb) return [];
  const d = date || today();
  const { data, error } = await sb.from('pattern_alerts').select('*').eq('scan_date', d);
  if (error) { console.error('[supabase] fetchPatternAlerts error:', error.message); return []; }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Sector Momentum
// ---------------------------------------------------------------------------

export async function storeSectorMomentum(sectors: SectorMomentumRow[]): Promise<void> {
  const sb = getSupabase();
  if (!sb || sectors.length === 0) return;

  const scanDate = today();
  const scannedAt = new Date().toISOString();
  const rows = sectors.map((s) => ({ scan_date: scanDate, scanned_at: scannedAt, ...s }));

  const { error } = await sb.from('sector_momentum').insert(rows);
  if (error) console.error('[supabase] storeSectorMomentum error:', error.message);
  else console.log(`[supabase] Stored ${rows.length} sector momentum rows for ${scanDate}`);
}

export async function fetchSectorMomentum(date?: string) {
  const sb = getSupabase();
  if (!sb) return [];
  const d = date || today();
  const { data, error } = await sb.from('sector_momentum').select('*').eq('scan_date', d).order('rank');
  if (error) { console.error('[supabase] fetchSectorMomentum error:', error.message); return []; }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Momentum Scans
// ---------------------------------------------------------------------------

export async function storeMomentumScans(scans: MomentumScanRow[]): Promise<void> {
  const sb = getSupabase();
  if (!sb || scans.length === 0) return;

  const scanDate = today();
  const scannedAt = new Date().toISOString();
  const rows = scans.map((s) => ({ scan_date: scanDate, scanned_at: scannedAt, ...s }));

  const { error } = await sb.from('momentum_scans').insert(rows);
  if (error) console.error('[supabase] storeMomentumScans error:', error.message);
  else console.log(`[supabase] Stored ${rows.length} momentum scans for ${scanDate}`);
}

export async function fetchMomentumScans(date?: string) {
  const sb = getSupabase();
  if (!sb) return [];
  const d = date || today();
  const { data, error } = await sb.from('momentum_scans').select('*').eq('scan_date', d).order('score', { ascending: false });
  if (error) { console.error('[supabase] fetchMomentumScans error:', error.message); return []; }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Stock Picks
// ---------------------------------------------------------------------------

export async function storeStockPicks(picks: StockPick[]): Promise<void> {
  const sb = getSupabase();
  if (!sb || picks.length === 0) return;

  const pickDate = today();
  const createdAt = new Date().toISOString();
  const rows = picks.map((p) => ({ pick_date: pickDate, created_at: createdAt, ...p }));

  const { error } = await sb.from('stock_picks').insert(rows);
  if (error) console.error('[supabase] storeStockPicks error:', error.message);
  else console.log(`[supabase] Stored ${rows.length} stock picks for ${pickDate}`);
}

export async function fetchStockPicks(date?: string) {
  const sb = getSupabase();
  if (!sb) return [];
  const d = date || today();
  const { data, error } = await sb.from('stock_picks').select('*').eq('pick_date', d).order('rank');
  if (error) { console.error('[supabase] fetchStockPicks error:', error.message); return []; }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Market Insights
// ---------------------------------------------------------------------------

export async function storeMarketInsights(insights: MarketInsight[]): Promise<void> {
  const sb = getSupabase();
  if (!sb || insights.length === 0) return;

  const insightDate = today();
  const createdAt = new Date().toISOString();
  const rows = insights.map((i) => ({ insight_date: insightDate, created_at: createdAt, ...i }));

  const { error } = await sb.from('market_insights').insert(rows);
  if (error) console.error('[supabase] storeMarketInsights error:', error.message);
  else console.log(`[supabase] Stored ${rows.length} market insights for ${insightDate}`);
}

export async function fetchMarketInsights(date?: string) {
  const sb = getSupabase();
  if (!sb) return [];
  const d = date || today();
  const { data, error } = await sb.from('market_insights').select('*').eq('insight_date', d).order('priority');
  if (error) { console.error('[supabase] fetchMarketInsights error:', error.message); return []; }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Service tiers (pricing: free, 4_99, 9_99)
// ---------------------------------------------------------------------------

export async function fetchServiceTiers(): Promise<ServiceTierRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('service_tiers').select('*').order('sort_order');
  if (error) {
    console.error('[supabase] fetchServiceTiers error:', error.message);
    return [];
  }
  return (data ?? []) as ServiceTierRow[];
}
