"""The web app's CO2 intensity mirror must not drift from the engine spec.

The website computes annual CO2 correctly (per-year generation x intensity)
rather than reading the engine's `{source}_CO2_MT` output field, which is summed
over sample_years and never normalized back to per-year (faithful to the original
Optimize.py and locked by the golden parity tests). To do that math web-side, the
site keeps a hand-maintained mirror of the per-source CO2 intensities in the
CO2_INTENSITY object in web/lib/co2.ts.

Those intensities are canonical in engine/data/Specs.csv (the CO2_MT_MWh row).
Because the web copy is maintained by hand, it can silently drift from the engine
spec. This test parses CO2_INTENSITY out of web/lib/co2.ts and asserts every
per-source value EXACTLY equals the engine's Specs.csv CO2_MT_MWh (via
get_specxs_nrgxs), so any divergence fails CI instead of shipping a wrong number.

Skipped when web/ is absent (e.g. the engine-only Docker build context), so it
guards drift in a full-repo checkout without breaking isolated engine runs.
"""
import math
import re
from pathlib import Path

import pytest

from optimize_engine.core import get_specxs_nrgxs
from optimize_engine.constants import CO2_MT_MWh, nrg2nrgx_lu, nrgs

_REPO_ROOT = Path(__file__).resolve().parents[2]
_WEB_MIRROR = _REPO_ROOT / 'web' / 'lib' / 'co2.ts'

# Match `Solar: 6.4e-8,` style entries inside the CO2_INTENSITY object.
_ENTRY_RE = re.compile(
    r'(?P<source>[A-Za-z]+)\s*:\s*(?P<value>[0-9][0-9eE.+-]*)\s*,')


def _parse_web_intensities() -> dict:
    text = _WEB_MIRROR.read_text()
    match = re.search(
        r'CO2_INTENSITY\s*:\s*Record<[^>]*>\s*=\s*\{(?P<body>.*?)\}',
        text, re.DOTALL)
    assert match, 'could not locate CO2_INTENSITY object in web/lib/co2.ts'
    body = match.group('body')
    return {m.group('source'): float(m.group('value'))
            for m in _ENTRY_RE.finditer(body)}


@pytest.mark.skipif(not _WEB_MIRROR.exists(),
                    reason='web mirror not present in this checkout')
def test_web_co2_intensity_matches_engine_spec():
    web = _parse_web_intensities()
    specxs_nrgxs = get_specxs_nrgxs()

    expected_sources = set(nrgs)  # Solar, Wind, Nuclear, Gas, Coal, Battery
    assert set(web) == expected_sources, (
        f'web/lib/co2.ts CO2_INTENSITY sources {sorted(web)} do not match '
        f'engine sources {sorted(expected_sources)}')

    for nrg in nrgs:
        engine_value = float(specxs_nrgxs[CO2_MT_MWh, nrg2nrgx_lu[nrg]])
        web_value = web[nrg]
        assert math.isclose(web_value, engine_value, rel_tol=1e-12, abs_tol=0.0), (
            f'{nrg}: web/lib/co2.ts CO2_INTENSITY={web_value!r} has drifted from '
            f'engine Specs.csv CO2_MT_MWh={engine_value!r}; re-sync the web mirror.')
