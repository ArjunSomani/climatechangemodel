"""Derive a per-region default annual demand-growth rate from the historical
EIA data, so each region can grow at roughly its own observed pace instead of a
single US-wide assumption.

IMPORTANT — these are rough estimates, deliberately clipped. The 6-year
per-region series (2020-2025) carries real data artifacts: SE jumps ~60% in a
single year (2025), FLA spikes mid-window and returns. So an unclipped endpoint
CAGR produces implausible defaults (SE ~13.6%/yr -> ~27x demand over 25 years).
We therefore:
  * use endpoint CAGR of total generation (historical supply == demand here),
  * clip to a plausible band [MIN, MAX], and
  * round to 0.1%,
and document that they are approximate, overridable starting points, not
authoritative regional load forecasts (for which EIA AEO regional projections
would be the better source -- a possible future swap).

Run:  python scripts/compute_region_demand_growth.py
Out:  engine/data/region_demand_growth.json
"""
import json
from pathlib import Path

import pandas as pd

from optimize_engine import paths

# Plausible annual demand-growth band. Guards against single-year data artifacts
# in the short historical window without flattening genuine regional differences.
MIN_GROWTH = 0.005  # 0.5%/yr
MAX_GROWTH = 0.040  # 4.0%/yr

OUT = Path(__file__).resolve().parent.parent / "data" / "region_demand_growth.json"


def main() -> None:
    df = pd.read_parquet(paths.data_dir() / "eia_parquet" / "max_mwh_yearly.parquet")
    sources = [c for c in df.columns if c not in ("region", "year")]
    df["total"] = df[sources].sum(axis=1)

    years = sorted(df["year"].unique())
    y0, y1 = years[0], years[-1]
    span = y1 - y0

    regions = {}
    for region, g in df.groupby("region"):
        g = g.set_index("year")
        t0, t1 = g.loc[y0, "total"], g.loc[y1, "total"]
        cagr = (t1 / t0) ** (1 / span) - 1
        clipped = min(MAX_GROWTH, max(MIN_GROWTH, cagr))
        regions[region] = {
            "growth": round(clipped, 3),          # clipped, used as the default
            "raw_cagr": round(float(cagr), 4),     # unclipped, for transparency
            "clipped": bool(clipped != cagr),
        }

    payload = {
        "note": (
            f"Per-region annual demand-growth defaults, endpoint CAGR of total "
            f"generation {y0}-{y1}, clipped to [{MIN_GROWTH:.1%}, {MAX_GROWTH:.1%}]. "
            f"Approximate historical estimates from a short, noisy window; "
            f"overridable per run."
        ),
        "window": [int(y0), int(y1)],
        "min_growth": MIN_GROWTH,
        "max_growth": MAX_GROWTH,
        "regions": dict(sorted(regions.items())),
    }
    OUT.write_text(json.dumps(payload, indent=2))
    print(f"wrote {OUT}")
    for r, v in payload["regions"].items():
        flag = " (clipped)" if v["clipped"] else ""
        print(f'  {r:6s} {v["growth"]*100:+.1f}%  (raw {v["raw_cagr"]*100:+.1f}%){flag}')


if __name__ == "__main__":
    main()
