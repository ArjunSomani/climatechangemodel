"""The web app's variable-cost mirror must not drift from the engine spec.

Same rationale as test_co2_mirror.py, for the other recomputed cost component.
The website computes annual variable O&M cost web-side (per-year generation x
Variable_M$_MWh) instead of reading the engine's `{source}_Variable_M$` output,
which is summed over sample_years and never normalized (faithful to the original
Optimize.py, locked by the golden parity tests). To do that math web-side, the
site keeps a hand-maintained mirror of the per-source variable costs in the
VARIABLE_COST object in web/lib/costs.ts.

Those costs are canonical in engine/data/Specs.csv (the Variable_M$_MWh row).
Because the web copy is maintained by hand, it can silently drift from the engine
spec, and unlike CO2 nothing tied the two together until now. This test parses
VARIABLE_COST out of web/lib/costs.ts and asserts every per-source value EXACTLY
equals the engine's Specs.csv Variable_M$_MWh (via get_specxs_nrgxs), so any
divergence fails CI instead of shipping a wrong dollar figure.

Skipped when web/ is absent (e.g. the engine-only Docker build context), so it
guards drift in a full-repo checkout without breaking isolated engine runs.
"""
import math
import re
from pathlib import Path

import pytest

from optimize_engine.core import get_specxs_nrgxs
from optimize_engine.constants import Variable_M_MWh, nrg2nrgx_lu, nrgs

_REPO_ROOT = Path(__file__).resolve().parents[2]
_WEB_MIRROR = _REPO_ROOT / 'web' / 'lib' / 'costs.ts'

# Match `Nuclear: 1.04477e-5,` and `Solar: 0,` style entries.
_ENTRY_RE = re.compile(
    r'(?P<source>[A-Za-z]+)\s*:\s*(?P<value>[0-9][0-9eE.+-]*)\s*,')


def _parse_web_variable_costs() -> dict:
    text = _WEB_MIRROR.read_text()
    match = re.search(
        r'VARIABLE_COST\s*:\s*Record<[^>]*>\s*=\s*\{(?P<body>.*?)\}',
        text, re.DOTALL)
    assert match, 'could not locate VARIABLE_COST object in web/lib/costs.ts'
    body = match.group('body')
    return {m.group('source'): float(m.group('value'))
            for m in _ENTRY_RE.finditer(body)}


@pytest.mark.skipif(not _WEB_MIRROR.exists(),
                    reason='web mirror not present in this checkout')
def test_web_variable_cost_matches_engine_spec():
    web = _parse_web_variable_costs()
    specxs_nrgxs = get_specxs_nrgxs()

    expected_sources = set(nrgs)  # Solar, Wind, Nuclear, Gas, Coal, Battery
    assert set(web) == expected_sources, (
        f'web/lib/costs.ts VARIABLE_COST sources {sorted(web)} do not match '
        f'engine sources {sorted(expected_sources)}')

    for nrg in nrgs:
        engine_value = float(specxs_nrgxs[Variable_M_MWh, nrg2nrgx_lu[nrg]])
        web_value = web[nrg]
        assert math.isclose(web_value, engine_value, rel_tol=1e-12, abs_tol=0.0), (
            f'{nrg}: web/lib/costs.ts VARIABLE_COST={web_value!r} has drifted from '
            f'engine Specs.csv Variable_M$_MWh={engine_value!r}; re-sync the web '
            f'mirror.')
