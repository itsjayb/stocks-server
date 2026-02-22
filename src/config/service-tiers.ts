/**
 * Service tier mapping: which services belong to free, $4.99, and $9.99.
 * Mirrors the `service_tiers` table in Supabase so the backend can use it
 * without a DB round-trip. Frontend should read from Supabase for display copy.
 */

import type { ServiceKey, ServiceTierKey } from '../types.js';

export const SERVICE_TIERS: Record<ServiceKey, ServiceTierKey> = {
  smart_movers: 'free',
  momentum_scans: 'free',
  sector_momentum: 'free',
  pattern_scan: '4_99',
  pattern_alerts: '4_99',
  stock_picks: '4_99',
  market_insights: '9_99',
  tweet: '9_99',
} as const;

/** Supabase table that stores this service's results (null = not in DB, e.g. tweet). */
export const SERVICE_TABLE: Record<ServiceKey, string | null> = {
  smart_movers: 'smart_movers',
  momentum_scans: 'momentum_scans',
  sector_momentum: 'sector_momentum',
  pattern_scan: null, // currently file-based (output/latest.json); can add table later
  pattern_alerts: 'pattern_alerts',
  stock_picks: 'stock_picks',
  market_insights: 'market_insights',
  tweet: null,
} as const;

export function getTierForService(serviceKey: ServiceKey): ServiceTierKey {
  return SERVICE_TIERS[serviceKey];
}

export function getTableForService(serviceKey: ServiceKey): string | null {
  return SERVICE_TABLE[serviceKey];
}
