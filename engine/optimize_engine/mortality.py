"""Mortality externality: death coefficients and the deaths accounting.

The insight this feature is built on is that a carbon price and a mortality
price are the same kind of object: both take a harm the market does not
charge for, attach a dollar figure to it, and let the optimizer respond.
CO2 is already priced (core.fig_cost adds `MWh * CO2_MT_MWh * CO2_M_MT`);
mortality is one more coefficient, one more linear term. This module owns
the coefficient half -- the death rates and the MWh->deaths arithmetic --
so both the reported-output layer (service.py) and, later, the objective
term reuse exactly one implementation.

Coefficients are NOT re-derived here. They are imported verbatim from the
sibling site Level (levelmodel.vercel.app), whose `sources.json` is the
descriptive source of truth for these figures; `data/mortality.json`
mirrors that file exactly so the two stay reconcilable. Every coefficient
keeps its `source` id (e.g. "owid-safest-sources") so the UI can link each
number back to its Level source page. Optimize must not become a second
source of truth for these numbers.
"""
import hashlib
import json
from typing import Optional

import numpy as np

from . import paths
from .constants import nrgx2nrg_lu, nrgxs

# 1 TWh = 1,000,000 MWh. The coefficients are deaths per TWh; the engine's
# generation figures ({Source}_MWh in the output matrix) are annual MWh. This
# single constant is the whole unit conversion, isolated here and unit-tested
# separately, because an off-by-1e6 here is silent and catastrophic (it would
# scale every death figure by a million).
MWH_PER_TWH = 1_000_000.0

# The three published uncertainty bands, mirroring how carbon-price
# uncertainty is handled: a run produces a band, not a point.
BANDS = ('low', 'central', 'high')

# Optimize's optimizer builds and dispatches exactly these six technologies
# (constants.nrgs). Each maps onto one Level mortality key -- except Battery.
#
# Battery deliberately carries NO direct death coefficient. A battery
# generates nothing of its own; it time-shifts electricity that some source
# already produced, and that source's deaths are already counted against the
# MWh when it was generated. Giving battery its own rate would double-count.
# This is an explicit modeling choice, recorded here rather than silently
# expressed as a zero in the data file.
ENGINE_SOURCE_TO_MORTALITY_KEY: dict[str, Optional[str]] = {
    'Solar': 'solar',
    'Wind': 'wind',
    'Nuclear': 'nuclear',
    'Gas': 'gas',
    'Coal': 'coal',
    'Battery': None,
}

# `oil` and `hydro` exist in mortality.json (Level's national model includes
# them, and the mirror must match sources.json exactly to stay reconcilable),
# but Optimize's optimizer never builds them -- they are not in nrgs -- so
# they never contribute to an Optimize mix. Kept in the data, absent from the
# mapping above by design.


def load_coefficients(path=None) -> dict:
    """Load the raw Level-mirrored coefficient table (deaths/TWh per source)."""
    p = path or paths.mortality_json()
    with open(p) as f:
        return json.load(f)


def mortality_version(coeffs: Optional[dict] = None) -> str:
    """Short content hash of the coefficient table.

    A stamp for pre-computed results (alongside eia_version/specs_version), so
    that changing any coefficient invalidates cases generated under the old
    numbers rather than silently serving a stale death figure. Content-derived
    rather than a hand-maintained semver, so it can never drift out of sync
    with the data it names. Order-independent (keys sorted before hashing).
    """
    coeffs = coeffs if coeffs is not None else load_coefficients()
    canonical = json.dumps(coeffs, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()[:12]


def death_rate(source: str, band: str = 'central', coeffs: Optional[dict] = None) -> float:
    """deaths/TWh for an ENGINE source name (constants.nrgs).

    Battery -> 0.0 (see ENGINE_SOURCE_TO_MORTALITY_KEY). Raises KeyError for
    an unknown engine source, so a typo fails loudly rather than silently
    contributing zero deaths.
    """
    if source not in ENGINE_SOURCE_TO_MORTALITY_KEY:
        raise KeyError(f'unknown engine source {source!r}')
    key = ENGINE_SOURCE_TO_MORTALITY_KEY[source]
    if key is None:
        return 0.0
    coeffs = coeffs if coeffs is not None else load_coefficients()
    return float(coeffs[key][band])


# The objective's per-source cost intensity packs BOTH unit conversions into
# the coefficient, so that intensity * mortality_price[$/death] lands in M$/MWh
# -- exactly mirroring how the CO2 term's CO2_MT_MWh * CO2_M_MT lands in M$/MWh
# (see core.fig_cost). The chain is:
#     deaths/TWh --(/1e6)--> deaths/MWh --(x $/death)--> $/MWh --(/1e6)--> M$/MWh
# so the deaths/TWh rate is divided by 1e12. Getting this scale wrong would put
# the mortality term on a different footing from every real cost, so it is
# isolated here as one named constant and asserted in the objective-scale test.
OBJECTIVE_COST_SCALE = 1e12


def objective_intensity_nrgxs(band: str = 'central',
                              coeffs: Optional[dict] = None) -> np.ndarray:
    """Per-source mortality cost intensity for the objective, indexed by nrgx.

    Positional over constants.nrgxs (Solar, Wind, Nuclear, Gas, Coal, Battery),
    so it drops straight into core.fig_cost / core.update_data next to the CO2
    coefficient. Battery is 0 (no direct coefficient). Multiply by the global
    mortality price ($ per death) to get M$/MWh.
    """
    coeffs = coeffs if coeffs is not None else load_coefficients()
    intensity = np.zeros(nrgxs.shape[0], dtype=float)
    for nrgx in nrgxs:
        key = ENGINE_SOURCE_TO_MORTALITY_KEY.get(nrgx2nrg_lu[nrgx])
        if key is None:
            continue
        intensity[nrgx] = float(coeffs[key][band]) / OBJECTIVE_COST_SCALE
    return intensity


def deaths_from_mwh(mwh: float, rate_per_twh: float) -> float:
    """deaths = generation[TWh] * rate[deaths/TWh].

    generation arrives in MWh; convert to TWh exactly once (divide by
    MWH_PER_TWH). This is the single most likely place for a silent 1e6 error,
    which is why it is one tiny function with its own unit test.
    """
    return (mwh / MWH_PER_TWH) * rate_per_twh


def year_deaths(annual_mwh_by_source: dict[str, float],
                coeffs: Optional[dict] = None) -> dict:
    """Deaths implied by one year's per-source generation.

    `annual_mwh_by_source` maps engine source names -> annual MWh (the
    {Source}_MWh columns of the output matrix). Returns total deaths across
    the three bands plus the counted/modeled split, and a per-source
    breakdown carrying each source's modeledShare through untouched.

    Level distinguishes counted deaths (accidents -- recorded events) from
    modeled deaths (air-pollution and radiation attributions from
    epidemiological models). `modeledShare` is the fraction of a source's
    deaths that are modeled; the rest are counted. That split is not
    decoration -- it must survive into every figure Optimize reports -- so it
    is computed here, not left to the UI.
    """
    coeffs = coeffs if coeffs is not None else load_coefficients()

    totals = {b: 0.0 for b in BANDS}
    counted_central = 0.0
    modeled_central = 0.0
    by_source = []

    for source, mwh in annual_mwh_by_source.items():
        key = ENGINE_SOURCE_TO_MORTALITY_KEY.get(source)
        if key is None:
            # Battery (or any non-death-bearing tech): contributes nothing,
            # by design. Skipped rather than emitted as a zero row.
            continue
        rec = coeffs[key]
        share = float(rec['modeledShare'])
        per_band = {b: deaths_from_mwh(mwh, float(rec[b])) for b in BANDS}
        for b in BANDS:
            totals[b] += per_band[b]
        counted = per_band['central'] * (1.0 - share)
        modeled = per_band['central'] * share
        counted_central += counted
        modeled_central += modeled
        by_source.append({
            'source': source,
            'deaths_low': per_band['low'],
            'deaths_central': per_band['central'],
            'deaths_high': per_band['high'],
            'modeled_share': share,
            'deaths_counted_central': counted,
            'deaths_modeled_central': modeled,
            'source_id': rec.get('source'),
        })

    return {
        'deaths_low': totals['low'],
        'deaths_central': totals['central'],
        'deaths_high': totals['high'],
        'deaths_counted_central': counted_central,
        'deaths_modeled_central': modeled_central,
        'by_source': by_source,
    }
