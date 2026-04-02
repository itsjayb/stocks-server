import { requireFinnhub } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

const BASE = "https://finnhub.io/api/v1";

async function finnhubGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = requireFinnhub();
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("token", token);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(res.status, `Finnhub request failed: ${res.statusText}`, {
      code: "finnhub_error",
      details: body.slice(0, 500),
    });
  }
  return (await res.json()) as T;
}

export async function getQuote(symbol: string): Promise<unknown> {
  return finnhubGet("/quote", { symbol: symbol.toUpperCase() });
}

export async function getCompanyNews(
  symbol: string,
  from: string,
  to: string,
): Promise<unknown> {
  return finnhubGet("/company-news", {
    symbol: symbol.toUpperCase(),
    from,
    to,
  });
}

export async function getEarningsCalendar(from: string, to: string): Promise<unknown> {
  return finnhubGet("/calendar/earnings", { from, to });
}

export async function getProfile(symbol: string): Promise<unknown> {
  return finnhubGet("/stock/profile2", { symbol: symbol.toUpperCase() });
}

export async function getInsiderTransactions(symbol: string): Promise<unknown> {
  return finnhubGet("/stock/insider-transactions", { symbol: symbol.toUpperCase() });
}
