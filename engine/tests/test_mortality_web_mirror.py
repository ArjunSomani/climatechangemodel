"""The web app's copy of mortality.json must not drift from the engine's.

mortality.json is canonical in engine/data (it sits with Specs.csv, where the
death math consumes it). The web app can't import across the repo root -- Vercel
only deploys web/ -- so it carries a mirror at web/data/mortality.json. Level is
the single source of truth for the numbers; within Optimize this test keeps the
engine copy and the web mirror byte-reconcilable so neither silently drifts.

Skipped when web/ is absent (e.g. the engine-only Docker build context), so it
guards drift in a full-repo checkout without breaking isolated engine runs.
"""
import json
from pathlib import Path

import pytest

from optimize_engine import paths

_REPO_ROOT = Path(__file__).resolve().parents[2]
_WEB_MIRROR = _REPO_ROOT / 'web' / 'data' / 'mortality.json'


@pytest.mark.skipif(not _WEB_MIRROR.exists(),
                    reason='web mirror not present in this checkout')
def test_web_mirror_matches_engine_canonical():
    engine_data = json.loads(paths.mortality_json().read_text())
    web_data = json.loads(_WEB_MIRROR.read_text())
    assert web_data == engine_data, (
        'web/data/mortality.json has drifted from engine/data/mortality.json; '
        're-copy the engine canonical file.')
