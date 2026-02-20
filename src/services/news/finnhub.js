/**
 * Fetch market news from Finnhub API.
 * Returns items in shared shape: { headline, summary, url, source, date }[]
 */

const API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';

export async function fetchFinnhubNews(options = {}) {
  const category = options.category || 'general';

  if (!API_KEY) {
    console.warn('Finnhub: missing FINNHUB_API_KEY');
    return [];
  }

  const url = new URL(`${BASE_URL}/news`);
  url.searchParams.set('category', category);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-Finnhub-Token': API_KEY,
      },
    });

    if (!res.ok) {
      console.warn('Finnhub news API error:', res.status, await res.text());
      return [];
    }

    const items = await res.json();
    if (!Array.isArray(items)) return [];

    return items.map((item) => ({
      headline: item.headline || '',
      summary: item.summary || '',
      url: item.url || '',
      source: 'Finnhub',
      date: item.datetime ? new Date(item.datetime * 1000).toISOString() : '',
    }));
  } catch (err) {
    console.warn('Finnhub news fetch failed:', err.message);
    return [];
  }
}
