/**
 * Tweet analytics: log engagement data and track tweet performance over time.
 * Fetches metrics from X API v2 and appends to a JSONL log file for analysis.
 */

import { readFile, appendFile, writeFile } from 'fs/promises';
import { fetchTweetMetrics } from './x-post.js';
import type { TweetEngagement } from '../types.js';

const LOG_PATH = new URL('../../config/tweet-engagement.jsonl', import.meta.url);

/**
 * Log a newly posted tweet's metadata. Engagement metrics are fetched later.
 */
export async function logTweetPosted(entry: Omit<TweetEngagement, 'impressions' | 'likes' | 'retweets' | 'replies' | 'quotes'>): Promise<void> {
  try {
    const row: TweetEngagement = {
      ...entry,
      impressions: 0,
      likes: 0,
      retweets: 0,
      replies: 0,
      quotes: 0,
    };
    await appendFile(LOG_PATH, JSON.stringify(row) + '\n', 'utf8');
    console.log('[analytics] Logged tweet:', entry.tweet_id);
  } catch (err) {
    console.warn('[analytics] Failed to log tweet:', (err as Error).message);
  }
}

/**
 * Refresh engagement metrics for recent tweets that were logged.
 * Fetches updated metrics from X API and rewrites the log file.
 */
export async function refreshEngagement(maxAge = 7): Promise<void> {
  try {
    const raw = await readFile(LOG_PATH, 'utf8').catch(() => '');
    if (!raw.trim()) return;

    const lines = raw.trim().split('\n');
    const entries: TweetEngagement[] = [];

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as TweetEngagement);
      } catch {
        // skip malformed lines
      }
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAge);

    const updated: TweetEngagement[] = [];
    for (const entry of entries) {
      const entryDate = new Date(entry.created_at);
      if (entryDate < cutoff) continue;

      const metrics = await fetchTweetMetrics(entry.tweet_id);
      if (metrics) {
        updated.push({
          ...entry,
          impressions: metrics.impressions,
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          quotes: metrics.quotes,
        });
      } else {
        updated.push(entry);
      }
    }

    await writeFile(LOG_PATH, updated.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    console.log(`[analytics] Refreshed ${updated.length} entries (dropped ${entries.length - updated.length} old).`);
  } catch (err) {
    console.warn('[analytics] Refresh failed:', (err as Error).message);
  }
}

/**
 * Get a summary of engagement stats grouped by tweet type, poll usage, and media usage.
 */
export async function getEngagementSummary(): Promise<Record<string, { count: number; avgLikes: number; avgReplies: number; avgImpressions: number }>> {
  try {
    const raw = await readFile(LOG_PATH, 'utf8').catch(() => '');
    if (!raw.trim()) return {};

    const entries: TweetEngagement[] = raw.trim().split('\n').map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean) as TweetEngagement[];

    const groups: Record<string, TweetEngagement[]> = {};
    for (const e of entries) {
      const key = `${e.tweet_type}${e.had_poll ? '+poll' : ''}${e.had_media ? '+media' : ''}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    const summary: Record<string, { count: number; avgLikes: number; avgReplies: number; avgImpressions: number }> = {};
    for (const [key, items] of Object.entries(groups)) {
      const count = items.length;
      summary[key] = {
        count,
        avgLikes: Math.round(items.reduce((s, e) => s + (e.likes ?? 0), 0) / count),
        avgReplies: Math.round(items.reduce((s, e) => s + (e.replies ?? 0), 0) / count),
        avgImpressions: Math.round(items.reduce((s, e) => s + (e.impressions ?? 0), 0) / count),
      };
    }

    return summary;
  } catch {
    return {};
  }
}
