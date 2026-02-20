#!/usr/bin/env python3
"""
Read OHLC JSON from stdin or a file, run pattern detection, print JSON results.
Input: { "SYMBOL": [ { "t": "date", "o": float, "h": float, "l": float, "c": float }, ... ], ... }
Output: { "results": [ { "symbol": str, "patterns": [ { "type": str, "date": str } ] }, ... ], "errors": [ str ] }
"""

import json
import sys
from pathlib import Path


def load_ohlc(input_source):
    """Load OHLC data from file path or stdin. Returns dict symbol -> list of bars."""
    if input_source and input_source != "-":
        with open(input_source, "r") as f:
            data = json.load(f)
    else:
        data = json.load(sys.stdin)
    return data if isinstance(data, dict) else {}


def bars_to_dataframe(bars):
    """Convert list of { t, o, h, l, c } to pandas DataFrame with Open, High, Low, Close (tradingpattern expects capitals)."""
    import pandas as pd

    rows = []
    for b in bars:
        rows.append({
            "date": b.get("t", b.get("date", "")),
            "Open": float(b.get("o", b.get("open", 0))),
            "High": float(b.get("h", b.get("high", 0))),
            "Low": float(b.get("l", b.get("low", 0))),
            "Close": float(b.get("c", b.get("close", 0))),
        })
    df = pd.DataFrame(rows)
    if df.empty or len(df) < 20:
        return None
    return df


def scan_patterns(df, symbol):
    """
    Run pattern detection on OHLC DataFrame. Returns list of { "type": str, "date": str }.
    Uses tradingpattern/tradingpatterns (head & shoulders, inverse) when available.
    """
    import pandas as pd

    patterns = []
    detector = None
    try:
        from tradingpatterns.tradingpatterns import detect_head_shoulder as detector
    except ImportError:
        try:
            from tradingpattern import detect_head_shoulder as detector
        except ImportError:
            try:
                from tradingpatterns import detect_head_shoulder as detector
            except ImportError:
                return patterns

    if detector is None:
        return patterns

    try:
        # detect_head_shoulder expects DataFrame with High, Low (and adds head_shoulder_pattern)
        result = detector(df.copy(), window=20)
        if result is None:
            return patterns
        col = "head_shoulder_pattern"
        if col not in result.columns:
            return patterns
        for idx, val in result[col].items():
            if pd.notna(val) and str(val).strip():
                date_val = result.loc[idx, "date"] if "date" in result.columns else ""
                if hasattr(date_val, "strftime"):
                    date_val = date_val.strftime("%Y-%m-%d")
                patterns.append({"type": str(val).strip(), "date": str(date_val)})
    except Exception:
        pass

    return patterns


def main():
    input_path = sys.argv[1] if len(sys.argv) > 1 else "-"
    ohlc_by_symbol = load_ohlc(input_path)
    results = []
    errors = []

    for symbol, bars in ohlc_by_symbol.items():
        if not bars or not isinstance(bars, list):
            continue
        df = bars_to_dataframe(bars)
        if df is None:
            errors.append(f"{symbol}: not enough bars (need at least 20)")
            continue
        try:
            found = scan_patterns(df, symbol)
            results.append({"symbol": symbol, "patterns": found})
        except Exception as e:
            errors.append(f"{symbol}: {e}")
            results.append({"symbol": symbol, "patterns": []})

    out = {"results": results, "errors": errors}
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
