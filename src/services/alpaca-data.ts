import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

export type AlpacaMover = {
  symbol: string;
  percent_change: number;
  change: number;
  price: number;
};

export type AlpacaMoversResponse = {
  gainers: AlpacaMover[];
  losers: AlpacaMover[];
  market_type: string;
  last_updated: string;
};

export type AlpacaMostActive = {
  symbol: string;
  volume: number;
  trade_count: number;
};

export type AlpacaMostActivesResponse = {
  most_actives: AlpacaMostActive[];
  last_updated: string;
};

function headers(): Record<string, string> {
  const id = env.alpacaApiKeyId;
  const secret = env.alpacaApiSecretKey;
  if (!id || !secret) {
    throw new HttpError(503, "Alpaca market data is not configured", { code: "alpaca_unconfigured" });
  }
  return {
    "APCA-API-KEY-ID": id,
    "APCA-API-SECRET-KEY": secret,
  };
}

async function alpacaGet<T>(path: string, search?: URLSearchParams): Promise<T> {
  const url = new URL(path, env.alpacaDataBaseUrl);
  if (search) url.search = search.toString();
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(res.status, `Alpaca request failed: ${res.statusText}`, {
      code: "alpaca_error",
      details: body.slice(0, 500),
    });
  }
  return (await res.json()) as T;
}

export async function getStockMovers(top: number): Promise<AlpacaMoversResponse> {
  const search = new URLSearchParams({ top: String(top) });
  return alpacaGet<AlpacaMoversResponse>(`/v1beta1/screener/stocks/movers`, search);
}

export async function getMostActives(
  top: number,
  by: "volume" | "trades",
): Promise<AlpacaMostActivesResponse> {
  const search = new URLSearchParams({ top: String(top), by });
  return alpacaGet<AlpacaMostActivesResponse>(`/v1beta1/screener/stocks/most-actives`, search);
}
