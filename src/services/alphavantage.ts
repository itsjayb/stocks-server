import { env, requireAlphaVantage } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

type AvTickerRow = {
  ticker: string;
  price: string;
  change_amount: string;
  change_percentage: string;
  volume: string;
};

type TopGainersLosersResponse = {
  "Meta Data"?: Record<string, string>;
  last_updated?: string;
  top_gainers?: AvTickerRow[];
  top_losers?: AvTickerRow[];
  most_actively_traded?: AvTickerRow[];
  Note?: string;
  Information?: string;
};

function parseNum(s: string): number {
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parsePct(s: string): number {
  return parseNum(String(s).replace("%", ""));
}

export type NormalizedMover = {
  symbol: string;
  price: number;
  change: number;
  percent_change: number;
  volume?: number;
};

export type AlphaVantageMarketSnapshot = {
  source: "alphavantage";
  last_updated?: string;
  gainers: NormalizedMover[];
  losers: NormalizedMover[];
  most_active: NormalizedMover[];
};

export async function getTopGainersLosers(): Promise<AlphaVantageMarketSnapshot> {
  const key = requireAlphaVantage();
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TOP_GAINERS_LOSERS");
  url.searchParams.set("apikey", key);

  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpError(res.status, `Alpha Vantage request failed: ${res.statusText}`, {
      code: "alphavantage_error",
    });
  }

  const data = (await res.json()) as TopGainersLosersResponse;
  if (data.Note || data.Information) {
    throw new HttpError(429, "Alpha Vantage rate limit or quota message returned", {
      code: "alphavantage_rate_limit",
      details: data.Note ?? data.Information,
    });
  }

  const mapRow = (r: AvTickerRow): NormalizedMover => ({
    symbol: r.ticker,
    price: parseNum(r.price),
    change: parseNum(r.change_amount),
    percent_change: parsePct(r.change_percentage),
    volume: r.volume ? parseNum(r.volume) : undefined,
  });

  return {
    source: "alphavantage",
    last_updated: data.last_updated,
    gainers: (data.top_gainers ?? []).map(mapRow),
    losers: (data.top_losers ?? []).map(mapRow),
    most_active: (data.most_actively_traded ?? []).map(mapRow),
  };
}

export function isAlphaVantageConfigured(): boolean {
  return Boolean(env.alphaVantageApiKey);
}
