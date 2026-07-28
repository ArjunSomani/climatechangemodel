"""Regional mortality-intensity weighting (guards a class of weighting bugs).

The Data Explorer's descriptive lens reports the deaths/TWh implied by a
region's real generation mix. The subtle failure mode is weighting the mix by
capacity *fraction* (what fraction of a source's capacity runs) instead of by
*generation* (fraction × capacity MW): that over-weights small-but-often-running
sources like coal and oil and understates big low-capacity-factor ones like
solar. These tests pin the correct method and assert the reviewer's invariant —
a weighted average must lie within the min/max of the sources it averages — for
every region, from the real EIA parquet.
"""
from pathlib import Path

import pytest

from optimize_engine import mortality
from optimize_engine.mortality import EIA_SOURCE_TO_MORTALITY_KEY as EIA_MAP

_PARQUET = (Path(__file__).resolve().parents[1] / 'data' / 'eia_parquet')


def _present_rates(weights: dict, coeffs: dict) -> list[float]:
    return [
        coeffs[EIA_MAP[s]]['central']
        for s, w in weights.items()
        if w > 0 and EIA_MAP.get(s) is not None
    ]


def test_weighted_average_stays_within_present_bounds():
    coeffs = mortality.load_coefficients()
    # A gas-dominated mix with a little coal (like California).
    weights = {'Gas': 46.0, 'Solar': 20.0, 'Hydro': 10.0, 'Nuclear': 8.0,
               'Wind': 9.0, 'Coal': 2.0, 'Oil': 0.7, 'Other': 3.0}
    rate = mortality.mix_weighted_deaths_per_twh(weights, coeffs)['deaths_per_twh']
    rates = _present_rates(weights, coeffs)
    assert min(rates) <= rate <= max(rates)
    # Gas-dominated with tiny coal -> a couple deaths/TWh, not many.
    assert 1.5 < rate < 4.0


def test_generation_weighting_differs_from_capacity_fraction_weighting():
    # The bug: weighting by capacity fraction alone. With coal at a high
    # capacity factor but small capacity, fraction-weighting inflates the rate.
    coeffs = mortality.load_coefficients()
    frac = {'Gas': 0.45, 'Coal': 0.55, 'Solar': 0.25}   # capacity factors
    cap_mw = {'Gas': 32_000, 'Coal': 1_500, 'Solar': 15_000}  # capacity MW

    by_fraction = mortality.mix_weighted_deaths_per_twh(frac, coeffs)['deaths_per_twh']
    gen = {s: frac[s] * cap_mw[s] for s in frac}
    by_generation = mortality.mix_weighted_deaths_per_twh(gen, coeffs)['deaths_per_twh']

    # Fraction-weighting hugely over-weights the small, dirty coal fleet.
    assert by_fraction > 2 * by_generation


def test_other_is_excluded_not_zero_rated():
    coeffs = mortality.load_coefficients()
    with_other = mortality.mix_weighted_deaths_per_twh(
        {'Gas': 10.0, 'Other': 10.0}, coeffs)
    without = mortality.mix_weighted_deaths_per_twh({'Gas': 10.0}, coeffs)
    # "Other" has no coefficient: it lowers coverage but must not dilute the
    # rate toward zero as if it were a zero-death source.
    assert with_other['deaths_per_twh'] == pytest.approx(without['deaths_per_twh'])
    assert with_other['covered_share'] == pytest.approx(0.5)


@pytest.mark.skipif(
    not (_PARQUET / 'hourly_capacity.parquet').exists(),
    reason='eia parquet not present in this checkout',
)
def test_every_region_intensity_is_within_its_source_bounds():
    import pandas as pd

    coeffs = mortality.load_coefficients()
    hourly = pd.read_parquet(_PARQUET / 'hourly_capacity.parquet')
    ymax = pd.read_parquet(_PARQUET / 'max_mwh_yearly.parquet')
    sources = [s for s in EIA_MAP if s in hourly.columns]

    per_region = {}
    for region in sorted(hourly['region'].unique()):
        h = hourly[hourly['region'] == region]
        m = ymax[ymax['region'] == region]
        weights = {
            s: float(h[s].mean()) * float(m[s].mean() if s in m.columns else 0.0)
            for s in sources
        }
        rate = mortality.mix_weighted_deaths_per_twh(weights, coeffs)['deaths_per_twh']
        rates = _present_rates(weights, coeffs)
        # The reviewer's invariant, for every region.
        assert min(rates) <= rate <= max(rates), f'{region}: {rate} outside {min(rates)}..{max(rates)}'
        per_region[region] = rate

    # Sanity anchors: gas-dominated CAL is modest; coal-heavy MIDW is higher.
    assert per_region['CAL'] < 4.0
    assert per_region['MIDW'] > per_region['CAL']
