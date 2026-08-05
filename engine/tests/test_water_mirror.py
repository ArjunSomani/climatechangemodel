"""The web app's copy of water.json must not drift from the engine's.

water.json holds the Macknick et al. (2012) operational water withdrawal and
consumption factors (gal/MWh) per source. Like mortality.json it is canonical in
engine/data and mirrored to web/data (Vercel only deploys web/), and the two are
kept byte-reconcilable so neither silently drifts. Water is reported, not priced
into the objective, so the engine doesn't consume this file today -- but keeping
it beside the other coefficient tables means a future priced-water term reads the
same canonical numbers the site displays.

Skipped when web/ is absent (e.g. the engine-only Docker build context).
"""
import json
from pathlib import Path

import pytest

from optimize_engine import paths

_REPO_ROOT = Path(__file__).resolve().parents[2]
_WEB_MIRROR = _REPO_ROOT / 'web' / 'data' / 'water.json'


@pytest.mark.skipif(not _WEB_MIRROR.exists(),
                    reason='web mirror not present in this checkout')
def test_web_mirror_matches_engine_canonical():
    engine_data = json.loads(paths.water_json().read_text())
    web_data = json.loads(_WEB_MIRROR.read_text())
    assert web_data == engine_data, (
        'web/data/water.json has drifted from engine/data/water.json; '
        're-copy the engine canonical file.')


def test_dispatched_sources_present_and_ordered_by_withdrawal():
    """The five dispatched sources must all carry factors, and nuclear must have
    the highest withdrawal while wind/solar are near-dry -- the shape that makes
    water a *different* axis from carbon (which would favor nuclear)."""
    data = json.loads(paths.water_json().read_text())
    for src in ('coal', 'gas', 'nuclear', 'solar', 'wind'):
        assert src in data, f'water.json missing {src}'
        assert 'withdrawal' in data[src] and 'consumption' in data[src]
        # Consumption never exceeds withdrawal (you can't evaporate more than you take).
        assert data[src]['consumption'] <= data[src]['withdrawal'], src

    assert data['nuclear']['withdrawal'] >= data['coal']['withdrawal']
    assert data['wind']['withdrawal'] <= data['solar']['withdrawal']
    assert data['gas']['withdrawal'] < data['nuclear']['withdrawal']
