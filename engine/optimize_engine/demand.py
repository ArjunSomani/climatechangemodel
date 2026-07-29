"""Per-region default demand-growth rates.

Historically the model used one demand-growth assumption for the whole US. This
exposes a per-region default derived from each region's own history (see
scripts/compute_region_demand_growth.py), so a run can grow a region at roughly
its observed pace unless the caller overrides it. Rates are clipped, approximate
historical estimates -- a starting point, not a load forecast.
"""
import json
from functools import lru_cache

from optimize_engine import paths

# US-wide fallback when a region is missing from the table (~recent US average).
DEFAULT_GROWTH = 0.02


@lru_cache(maxsize=1)
def _table() -> dict:
    path = paths.data_dir() / "region_demand_growth.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text()).get("regions", {})


def region_demand_growth(region: str) -> float:
    """Default annual demand-growth *rate* for a region, e.g. 0.025 for 2.5%/yr."""
    return float(_table().get(region, {}).get("growth", DEFAULT_GROWTH))


def region_demand_multiplier(region: str) -> float:
    """The same as a yearly multiplier for the demand TweakPair, e.g. 1.025."""
    return 1.0 + region_demand_growth(region)
