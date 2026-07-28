"""Coefficient versioning + reported-deaths parity (feature backbone).

`mortality_version` is the stamp a pre-computed result carries so a coefficient
change invalidates stale cases (the same role eia_version/specs_version play).
The parity test proves the deaths attached to a run equal an independent
recompute from that run's generation -- which is exactly what the web does
client-side, so it also guards that the two paths can't diverge.
"""
import copy
import json

import pytest

from optimize_engine import ScenarioConfig, TweakPair, mortality, run_scenario
from optimize_engine.constants import nrgs


def test_mortality_version_is_deterministic_and_content_derived():
    base = mortality.load_coefficients()
    v = mortality.mortality_version(base)

    assert isinstance(v, str) and len(v) == 12
    int(v, 16)  # hex
    assert v == mortality.mortality_version(base)  # deterministic

    # Changing any coefficient changes the version.
    mutated = copy.deepcopy(base)
    mutated['coal']['central'] = 99.0
    assert mortality.mortality_version(mutated) != v

    # Key order does not (canonicalized before hashing).
    reordered = dict(reversed(list(base.items())))
    assert mortality.mortality_version(reordered) == v


def test_default_data_file_version_matches_its_contents():
    assert mortality.mortality_version() == mortality.mortality_version(
        mortality.load_coefficients())


def test_reported_deaths_equal_independent_recompute():
    # A small real run. The deaths attached to the result must equal a fresh
    # recompute from the {Source}_MWh in the year records -- the identical
    # formula the web applies client-side.
    config = ScenarioConfig(
        region='CAL',
        years=2,
        co2_price=TweakPair(initial=0, yearly=0),
        interest=TweakPair(initial=0.12, yearly=1),
        demand=TweakPair(initial=1.0, yearly=1.0),
        mortality_price=TweakPair(initial=0, yearly=1),
    )
    result = run_scenario(config)

    for region in result.regions:
        assert region.deaths is not None
        assert len(region.deaths) == len(region.years)
        for year_row, death_row in zip(region.years, region.deaths):
            annual_mwh = {s: year_row.get(f'{s}_MWh', 0.0) for s in nrgs}
            recomputed = mortality.year_deaths(annual_mwh)
            for key in ('deaths_low', 'deaths_central', 'deaths_high',
                        'deaths_counted_central', 'deaths_modeled_central'):
                assert death_row[key] == pytest.approx(recomputed[key]), key


def test_mortality_json_is_valid_and_covers_every_dispatched_source():
    # The stamp is only meaningful if the file it hashes is well-formed.
    coeffs = json.loads((mortality.paths.mortality_json()).read_text())
    for source, key in mortality.ENGINE_SOURCE_TO_MORTALITY_KEY.items():
        if key is None:
            continue
        assert key in coeffs, f'{source} maps to missing key {key!r}'
