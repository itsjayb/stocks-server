/**
 * Free-tier feature keys aligned with `stocksforbeginner/src/lib/tiers.ts`.
 * Keep in sync when changing visitor vs free-account rules.
 */

export type FreeTierFeatureId =
  | "gainers_losers"
  | "unusual_volume"
  | "compact_watchlist"
  | "headline_news"
  | "education_on_screen";

/** Features available to anonymous visitors (no account). */
export const VISITOR_PREVIEW_FREE_FEATURE_IDS: readonly FreeTierFeatureId[] = [
  "gainers_losers",
  "compact_watchlist",
  "headline_news",
] as const;

export function isVisitorPreviewFreeFeature(id: FreeTierFeatureId): boolean {
  return (VISITOR_PREVIEW_FREE_FEATURE_IDS as readonly string[]).includes(id);
}

export function canAccessFreeTierFeature(
  id: FreeTierFeatureId,
  opts: { hasFreeAccount: boolean },
): boolean {
  if (opts.hasFreeAccount) return true;
  return isVisitorPreviewFreeFeature(id);
}
