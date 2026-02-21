/**
 * User IDs to exclude from web visit / page-view counts (e.g. your own when testing).
 * Use shouldCountVisit(userId) before recording a visit.
 */

const EXCLUDED_VISIT_USER_IDS = new Set(
  (process.env.EXCLUDED_VISIT_USER_IDS || '23dacf76-a9a7-4bbb-ab99-205eb1a5e342')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

/**
 * Returns false if this user's visits should not be counted (e.g. you when logged in).
 * Call before incrementing or storing a visit.
 */
export function shouldCountVisit(userId: string | undefined): boolean {
  if (!userId) return true; // anonymous visits are counted unless you decide otherwise
  return !EXCLUDED_VISIT_USER_IDS.has(userId);
}
