/**
 * Ensure Twitter promo tweets include our /tw/ referral path (tracking) and never only the site root.
 */

import type { TweetType } from './aggregate-news.js';

const DEFAULT_PROMO = 'https://learnstockmarket.online';

export function getPromoBaseUrl(): string {
  return (process.env.PROMO_WEBSITE_URL || DEFAULT_PROMO).replace(/\/$/, '');
}

/** True if text contains our base URL followed by /tw/ (referral segment). */
export function hasTwReferralLink(text: string, baseUrl: string = getPromoBaseUrl()): boolean {
  const escaped = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}/tw/`, 'i').test(text);
}

export interface PatternOrStrategyRef {
  url: string;
  kind: 'pattern' | 'strategy';
}

/**
 * If a pattern/strategy tweet is missing a /tw/ URL, append a lesson URL or list page (never homepage).
 */
export function ensureTwReferralInTweet(
  text: string,
  tweetType: TweetType,
  patternOrStrategy: PatternOrStrategyRef | null,
  baseUrl: string = getPromoBaseUrl()
): string {
  if (tweetType === 'news') return text;
  if (hasTwReferralLink(text, baseUrl)) return text;
  const fallback =
    patternOrStrategy?.url ??
    (tweetType === 'pattern' ? `${baseUrl}/tw/patterns` : `${baseUrl}/tw/strategies`);
  const combined = `${text.trim()} ${fallback}`.trim();
  if (combined.length <= 280) return combined;
  return combined.slice(0, 277) + '…';
}
