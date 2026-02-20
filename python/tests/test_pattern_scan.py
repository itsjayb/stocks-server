"""Tests for pattern_scan: load_ohlc, bars_to_dataframe, scan_patterns, and full pipeline."""

import json
import sys
from pathlib import Path

# Allow importing pattern_scan from parent
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from pattern_scan import load_ohlc, bars_to_dataframe, scan_patterns


def test_load_ohlc_from_dict():
    data = {"AAPL": [{"t": "2024-01-01", "o": 100, "h": 101, "l": 99, "c": 100.5}]}
    out = load_ohlc(None)
    # load_ohlc with None reads from stdin; pass a dict via a different code path
    # We test load_ohlc by checking it returns dict for dict input when we pass data
    # Actually load_ohlc(input_source) with "-" reads stdin. So we need to test with a temp file.
    import tempfile
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(data, f)
        path = f.name
    try:
        result = load_ohlc(path)
        assert result == data
    finally:
        Path(path).unlink(missing_ok=True)


def test_bars_to_dataframe_empty():
    df = bars_to_dataframe([])
    assert df is None


def test_bars_to_dataframe_too_few():
    bars = [{"t": f"2024-01-{i:02d}", "o": 100, "h": 101, "l": 99, "c": 100} for i in range(1, 16)]
    df = bars_to_dataframe(bars)
    assert df is None


def test_bars_to_dataframe_ok():
    bars = [{"t": f"2024-01-{i:02d}", "o": 100 + i, "h": 101 + i, "l": 99 + i, "c": 100 + i} for i in range(1, 26)]
    df = bars_to_dataframe(bars)
    assert df is not None
    assert len(df) == 25
    assert list(df.columns) == ["date", "Open", "High", "Low", "Close"]
    assert df["Open"].iloc[0] == 100
    assert df["High"].iloc[0] == 101


def test_scan_patterns_returns_list():
    import pandas as pd
    n = 25
    df = pd.DataFrame({
        "date": [f"2024-01-{i:02d}" for i in range(1, n + 1)],
        "Open": [100.0] * n,
        "High": [101.0] * n,
        "Low": [99.0] * n,
        "Close": [100.0] * n,
    })
    result = scan_patterns(df, "TEST")
    assert isinstance(result, list)
    for p in result:
        assert "type" in p
        assert "date" in p


def test_full_pipeline_with_file(tmp_path):
    """Load fixture from file, build DataFrame, run scan_patterns; check structure."""
    fixture = {
        "AAPL": [
            {"t": f"2024-01-{i:02d}", "o": 185 + i * 0.1, "h": 186 + i * 0.1, "l": 184 + i * 0.1, "c": 185 + i * 0.1}
            for i in range(25)
        ]
    }
    path = tmp_path / "ohlc.json"
    path.write_text(json.dumps(fixture))

    ohlc = load_ohlc(str(path))
    assert "AAPL" in ohlc
    df = bars_to_dataframe(ohlc["AAPL"])
    assert df is not None
    res = scan_patterns(df, "AAPL")
    assert isinstance(res, list)
