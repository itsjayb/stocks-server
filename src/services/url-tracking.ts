const DEFAULT_PROMO_URL = 'https://learnstockmarket.online';

function normalizePromoHost(promoUrl: string): string {
  try {
    return new URL(promoUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return DEFAULT_PROMO_URL.replace(/^https?:\/\//, '').toLowerCase();
  }
}

function buildPromoUrlRegex(promoHost: string): RegExp {
  const escapedHost = promoHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`((?:https?:\\/\\/)?(?:www\\.)?${escapedHost}(?::\\d+)?(?:\\/[^\\s]*)?)`, 'gi');
}

function withTrackingPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/tw';
  if (pathname === '/tw' || pathname.startsWith('/tw/')) return pathname;
  return `/tw${pathname.startsWith('/') ? '' : '/'}${pathname}`;
}

/**
 * Ensure any promo website URL includes /tw tracking path.
 */
export function enforcePromoTrackingPath(tweetText: string, promoUrl: string = process.env.PROMO_WEBSITE_URL || DEFAULT_PROMO_URL): string {
  if (!tweetText || !tweetText.includes('.')) return tweetText;

  const promoHost = normalizePromoHost(promoUrl);
  const rx = buildPromoUrlRegex(promoHost);

  return tweetText.replace(rx, (rawMatch: string) => {
    const hasProtocol = /^https?:\/\//i.test(rawMatch);
    const parseTarget = hasProtocol ? rawMatch : `https://${rawMatch}`;

    try {
      const parsed = new URL(parseTarget);
      const parsedHost = parsed.hostname.toLowerCase().replace(/^www\./, '');
      if (parsedHost !== promoHost) return rawMatch;

      const pathname = withTrackingPath(parsed.pathname);
      if (hasProtocol) {
        return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}${parsed.hash}`;
      }
      return `${parsed.host}${pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return rawMatch;
    }
  });
}
