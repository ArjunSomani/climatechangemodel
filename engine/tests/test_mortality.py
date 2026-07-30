"""Mortality coefficient layer + deaths accounting (feature step 2-3).

These tests intentionally do NOT run the optimizer -- they pin the
coefficient table, the technology mapping, and the MWh->deaths arithmetic
in isolation, so a wrong number or a unit error is caught before it can
reach the model. The zero-price regression that guards the *model* lives in
test_golden_parity.py (test_zero_mortality_price_matches_golden).
"""
import numpy as np
import pytest

from optimize_engine import core, mortality
from optimize_engine.constants import CO2_MT_MWh, Coalx, Gasx, nrgs


# --- Published coefficients, verified against known figures (Level/OWID) ----

# central deaths/TWh, straight from Level's sources.json (do not re-derive).
EXPECTED_CENTRAL = {
    'coal': 24.6, 'oil': 18.4, 'gas': 2.8, 'nuclear': 0.03,
    'hydro': 0.04, 'wind': 0.02, 'solar': 0.01,
}


def test_coefficients_match_published_central_values():
    coeffs = mortality.load_coefficients()
    for key, expected in EXPECTED_CENTRAL.items():
        assert coeffs[key]['central'] == expected, key


def test_coefficients_have_full_band_and_metadata():
    coeffs = mortality.load_coefficients()
    for key in EXPECTED_CENTRAL:
        rec = coeffs[key]
        # low <= central <= high for every source (a band, not a point).
        assert rec['low'] <= rec['central'] <= rec['high'], key
        assert rec['unit'] == 'deaths/TWh'
        assert 0.0 <= rec['modeledShare'] <= 1.0
        # Every coefficient links back to its Level source, so Optimize never
        # becomes a second source of truth for the number.
        assert rec['source'], key


def test_coal_is_an_order_of_magnitude_worse_than_gas_on_deaths():
    # The headline fact the feature turns on: coal is ~9x deadlier than gas
    # per TWh (but only ~1.7x worse on CO2). If this ratio is off, the
    # coefficients are wrong and the carbon-vs-mortality divergence vanishes.
    coeffs = mortality.load_coefficients()
    ratio = coeffs['coal']['central'] / coeffs['gas']['central']
    assert 8.0 < ratio < 10.0

    # Renewables and nuclear are ~3 orders of magnitude below coal.
    assert coeffs['coal']['central'] / coeffs['solar']['central'] > 1000


def test_deaths_and_co2_rank_gas_vs_coal_differently():
    # Divergence at its root (test 2.5.4). The whole feature turns on gas and
    # coal being ranked *differently* by the two externalities: gas is far
    # better than coal on deaths (~9x) but only modestly better on CO2 (~2x).
    # That gap is why a mortality price and a carbon price disagree about gas.
    # If these two rankings were the same, no divergence could exist -- the
    # coefficients would be wrong.
    coeffs = mortality.load_coefficients()
    specxs = core.get_specxs_nrgxs()

    deaths_gas_over_coal = coeffs['gas']['central'] / coeffs['coal']['central']
    co2_gas_over_coal = specxs[CO2_MT_MWh, Gasx] / specxs[CO2_MT_MWh, Coalx]

    # Gas is dramatically better than coal on deaths...
    assert deaths_gas_over_coal < 0.15
    # ...but only modestly better on CO2...
    assert co2_gas_over_coal > 0.4
    # ...so the two externalities rank gas-vs-coal on very different scales.
    assert co2_gas_over_coal > 3 * deaths_gas_over_coal


# --- Technology mapping ----------------------------------------------------

def test_every_engine_source_is_mapped():
    for source in nrgs:
        assert source in mortality.ENGINE_SOURCE_TO_MORTALITY_KEY


def test_battery_carries_no_direct_coefficient():
    # Explicit modeling choice: battery's harm is embodied in the electricity
    # it stores, so it gets no rate of its own (not a silent zero in the data).
    assert mortality.ENGINE_SOURCE_TO_MORTALITY_KEY['Battery'] is None
    assert mortality.death_rate('Battery') == 0.0


def test_oil_and_hydro_exist_in_data_but_are_not_dispatched():
    coeffs = mortality.load_coefficients()
    # Present in the Level mirror (reconcilability)...
    assert 'oil' in coeffs and 'hydro' in coeffs
    # ...but never among the engine's optimized technologies.
    assert 'oil' not in nrgs and 'hydro' not in nrgs
    assert 'oil' not in mortality.ENGINE_SOURCE_TO_MORTALITY_KEY.values()
    assert 'hydro' not in mortality.ENGINE_SOURCE_TO_MORTALITY_KEY.values()


def test_death_rate_maps_engine_names_to_level_values():
    assert mortality.death_rate('Coal') == 24.6
    assert mortality.death_rate('Gas') == 2.8
    assert mortality.death_rate('Nuclear', band='high') == 0.07
    with pytest.raises(KeyError):
        mortality.death_rate('Unobtanium')


# --- The unit conversion (the most likely place for a silent 1e6 error) ----

def test_one_twh_of_coal_is_exactly_the_coal_rate():
    # 1 TWh = 1_000_000 MWh, so a million MWh of coal yields exactly the
    # coal death rate. This is the whole conversion, pinned.
    assert mortality.deaths_from_mwh(1_000_000.0, 24.6) == pytest.approx(24.6)


def test_conversion_is_linear_and_scales_correctly():
    assert mortality.deaths_from_mwh(2_000_000.0, 2.8) == pytest.approx(5.6)
    assert mortality.deaths_from_mwh(0.0, 224.0) == 0.0
    # A realistic annual generation (100 TWh = 1e8 MWh) of coal is thousands
    # of deaths -- not billions (rate not multiplied by 1e6) and not
    # micro-deaths (rate not divided twice).
    assert mortality.deaths_from_mwh(1e8, 24.6) == pytest.approx(2460.0)


def test_conversion_direction_guard():
    # One MWh of coal is a tiny fraction of a death. If the 1e6 were applied
    # in the wrong direction this would be ~2.46e7 instead.
    assert mortality.deaths_from_mwh(1.0, 24.6) == pytest.approx(24.6e-6)


# --- year_deaths: totals, bands, and the counted/modeled split -------------

def test_year_deaths_sums_over_sources_per_band():
    # 1 TWh coal + 1 TWh gas.
    mwh = {'Coal': 1_000_000.0, 'Gas': 1_000_000.0}
    d = mortality.year_deaths(mwh)
    assert d['deaths_central'] == pytest.approx(24.6 + 2.8)
    assert d['deaths_low'] == pytest.approx(24.6 + 2.8)
    assert d['deaths_high'] == pytest.approx(224.0 + 8.5)


def test_year_deaths_ignores_battery():
    with_batt = mortality.year_deaths({'Coal': 1_000_000.0, 'Battery': 5_000_000.0})
    without = mortality.year_deaths({'Coal': 1_000_000.0})
    assert with_batt['deaths_central'] == without['deaths_central']
    assert all(row['source'] != 'Battery' for row in with_batt['by_source'])


def test_counted_and_modeled_split_reconstructs_the_total():
    # Level's counted (accidents) vs modeled (pollution/radiation) split must
    # survive into Optimize: counted + modeled == total, per source and in
    # aggregate, to floating-point tolerance.
    mwh = {s: 1_000_000.0 for s in ('Solar', 'Wind', 'Nuclear', 'Gas', 'Coal')}
    d = mortality.year_deaths(mwh)

    assert d['deaths_counted_central'] + d['deaths_modeled_central'] == pytest.approx(
        d['deaths_central'])

    for row in d['by_source']:
        assert row['deaths_counted_central'] + row['deaths_modeled_central'] == pytest.approx(
            row['deaths_central'])
        # modeled share applied the right way round: coal is mostly modeled
        # (air pollution), solar/wind are all counted (modeledShare 0).
        if row['source'] == 'Coal':
            assert row['deaths_modeled_central'] > row['deaths_counted_central']
        if row['source'] in ('Solar', 'Wind'):
            assert row['deaths_modeled_central'] == 0.0


def test_year_deaths_rejects_an_unknown_source():
    """A typo must fail loudly rather than contribute zero deaths.

    death_rate() has always raised KeyError for an unrecognised engine source,
    but year_deaths() used dict.get() and so treated "Coel" exactly like
    "Battery" -- a source with no coefficient, silently skipped. Those are very
    different situations: one is a modeling decision, the other is a bug that
    would quietly under-report the death toll of whatever was misspelled.
    """
    import pytest

    from optimize_engine import mortality

    with pytest.raises(KeyError):
        mortality.year_deaths({'Coel': 1_000_000.0})

    # Battery stays a deliberate skip, not an error.
    result = mortality.year_deaths({'Battery': 1_000_000.0})
    assert result['deaths_central'] == 0.0
    assert result['by_source'] == []

    # And a real source still counts.
    coal = mortality.year_deaths({'Coal': 1_000_000.0})
    assert coal['deaths_central'] > 0
