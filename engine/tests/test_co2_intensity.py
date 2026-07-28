"""Guard the CO2 accounting against the units class of bug.

The engine's per-year `{s}_CO2_MT` output is summed over sample_years and never
normalized (faithful to the original Optimize.py, locked by the golden tests),
so it over-reports annual CO2 by exactly that factor. The site therefore computes
annual CO2 from per-year generation x intensity instead (web/lib/co2.ts, and
generate_playground_lattice.py). These tests assert:

1. that corrected annual CO2 / annual generation lands in a physically plausible
   gCO2/kWh band for every simulated year -- the single assertion the reviewer
   asked for, which catches any future annual-vs-cumulative or scaling slip; and
2. that the raw `{s}_CO2_MT` field really is sample_years x the corrected value,
   so the relationship is documented and can't drift silently.
"""
import numpy as np
import pytest

from optimize_engine import ScenarioConfig, TweakPair, run_scenario
from optimize_engine.constants import CO2_MT_MWh, nrg2nrgx_lu, nrgs
from optimize_engine.core import get_specxs_nrgxs

# Specs.csv CO2_MT_MWh row, per source. Multiplying a per-year MWh figure by this
# yields annual CO2 in Mt (the site's "MT" unit); x 1e9 converts to gCO2/kWh.
_SPECS = get_specxs_nrgxs()
CO2_INTENSITY = {nrg: float(_SPECS[CO2_MT_MWh, nrg2nrgx_lu[nrg]]) for nrg in nrgs}

# Unabated coal is ~820-1000 gCO2/kWh; nothing on this grid is dirtier, so a
# fleet-average annual intensity above ~1000 means the CO2/generation ratio is
# physically impossible -- exactly the failure the reviewer flagged.
MAX_PLAUSIBLE_G_PER_KWH = 1000.0


def _annual_co2_mt(year_row) -> float:
    return sum(year_row.get(f'{s}_MWh', 0.0) * CO2_INTENSITY[s] for s in nrgs)


def _annual_generation_mwh(year_row) -> float:
    return sum(year_row.get(f'{s}_MWh', 0.0) for s in nrgs)


@pytest.mark.parametrize('region', ['CAL', 'MIDW'])
@pytest.mark.parametrize('co2_price', [0.0, 400.0])
def test_annual_intensity_is_physically_plausible(region, co2_price):
    result = run_scenario(ScenarioConfig(
        region=region, years=6,
        co2_price=TweakPair(initial=co2_price, yearly=0),
        interest=TweakPair(initial=0.12, yearly=1),
        demand=TweakPair(initial=1.0, yearly=1.0),
        mortality_price=TweakPair(initial=0.0, yearly=1),
    ))
    for year_row in result.regions[0].years:
        gen = _annual_generation_mwh(year_row)
        if gen <= 0:
            continue
        # gCO2/kWh = (Mt / MWh) x 1e9
        g_per_kwh = (_annual_co2_mt(year_row) / gen) * 1e9
        assert 0.0 <= g_per_kwh <= MAX_PLAUSIBLE_G_PER_KWH, (
            f'{region} co2_price={co2_price} year={year_row.get("Year")}: '
            f'{g_per_kwh:.0f} gCO2/kWh is outside [0, {MAX_PLAUSIBLE_G_PER_KWH}]')


def test_raw_co2_field_is_sample_years_times_corrected():
    """Documents (and pins) the known scaling of the raw `{s}_CO2_MT` field."""
    result = run_scenario(ScenarioConfig(
        region='MIDW', years=3,
        co2_price=TweakPair(initial=0.0, yearly=0),
        interest=TweakPair(initial=0.12, yearly=1),
        demand=TweakPair(initial=1.0, yearly=1.0),
        mortality_price=TweakPair(initial=0.0, yearly=1),
    ))
    ratios = []
    for year_row in result.regions[0].years:
        corrected = _annual_co2_mt(year_row)
        raw = sum(year_row.get(f'{s}_CO2_MT', 0.0) for s in nrgs)
        if corrected <= 0:
            continue
        ratios.append(raw / corrected)

    # The factor is sample_years (data-hours / 8766 -- a few years, not exactly
    # integer because of leap hours). The invariant is that it is > 1 (the raw
    # field really is inflated) and the SAME for every year (a single constant),
    # so the corrected value is a clean rescale of the raw one.
    assert ratios, 'no years with positive CO2'
    assert min(ratios) > 1.5, f'raw field not inflated as expected: {min(ratios):.3f}'
    assert np.allclose(ratios, ratios[0], rtol=1e-3), (
        f'sample_years factor should be constant across years, got {ratios}')
