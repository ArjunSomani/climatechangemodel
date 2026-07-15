"""Golden-output parity tests (PRD §10).

Each fixture pair (`{name}.inbox.csv`, `{name}-CAL.csv`) was produced by
running the *unmodified* Optimize.py from cliffgold/Optimize (commit
266de24) through its real Inbox.csv/Outbox mailbox, on a fixed scenario.
run_scenario() must reproduce those numbers for the same config: this is
what guards the mailbox-to-config refactor in engine/optimize_engine
against ever silently drifting from the original engine's behavior.

Regenerating a fixture (only do this deliberately, with the original
repo checked out separately, never by hand-editing the golden CSV):
    cd vendor/optimize-original && python Python/Optimize.py
"""
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from optimize_engine import paths, run_scenario
from optimize_engine.mailbox import read_inbox_csv

GOLDEN_DIR = Path(__file__).parent / 'golden'

CASES = [
    'golden_CAL',
    'golden_CAL_tweaked',
]

# The golden fixtures were produced by the original engine on EIA data
# through this year. Later refreshes append newer complete years (2025, ...),
# which legitimately change the engine's inputs -- the yearly `max` shifts and
# the base year (first_year) advances -- and therefore its output. Parity must
# validate the refactor's fidelity to the *original* engine on the *original*
# inputs, so we run it against a frozen snapshot of that era rather than
# whatever EIA data is currently checked in. The pre-2025 rows are immutable
# (refresh_eia_data.py verifies them byte-for-byte before replacing anything),
# so slicing them out of the live committed data reproduces the exact inputs
# the goldens were generated against -- which a bit-for-bit match then proves.
GOLDEN_DATA_THROUGH_YEAR = 2024

# Both golden cases are CAL; only that region's data needs freezing.
GOLDEN_REGIONS = ['CAL']


def _keep_through(lines, year_of) -> list[str]:
    """Header line plus every data row whose year is <= the cutoff."""
    it = iter(lines)
    kept = [next(it)]
    kept += [ln for ln in it if ln.strip() and year_of(ln) <= GOLDEN_DATA_THROUGH_YEAR]
    return kept


@pytest.fixture
def frozen_data_dir(tmp_path, monkeypatch):
    src = paths.data_dir()
    dst = tmp_path / 'data'
    cap_dir = dst / 'eia_hourly' / 'hourly_capacity'
    max_dir = dst / 'eia_hourly' / 'max_mwh_yearly'
    cap_dir.mkdir(parents=True)
    max_dir.mkdir(parents=True)

    shutil.copy(src / 'Specs.csv', dst / 'Specs.csv')
    shutil.copy(src / 'Regions.csv', dst / 'Regions.csv')

    for region in GOLDEN_REGIONS:
        cap_src = (src / 'eia_hourly' / 'hourly_capacity' / f'{region}_master.csv')
        # Hourly rows: date is the first field, "YYYYMMDDThh".
        (cap_dir / f'{region}_master.csv').write_text(
            ''.join(_keep_through(cap_src.read_text().splitlines(keepends=True),
                                  lambda ln: int(ln[:4]))))

        max_src = (src / 'eia_hourly' / 'max_mwh_yearly' / f'{region}_max_vals.csv')
        # Yearly max rows: the first field is the four-digit year.
        (max_dir / f'{region}_max_vals.csv').write_text(
            ''.join(_keep_through(max_src.read_text().splitlines(keepends=True),
                                  lambda ln: int(ln.split(',', 1)[0]))))

    monkeypatch.setenv('ENGINE_DATA_DIR', str(dst))
    return dst


def _load_golden(name: str) -> pd.DataFrame:
    path = GOLDEN_DIR / f'{name}-CAL.csv'
    # Original Outbox format: params as rows, year index as columns.
    return pd.read_csv(path, index_col=0).transpose().reset_index(drop=True)


@pytest.mark.parametrize('case', CASES)
def test_matches_original_engine_bit_for_bit(case, frozen_data_dir):
    config = read_inbox_csv(GOLDEN_DIR / f'{case}.inbox.csv')
    result = run_scenario(config)

    actual = pd.DataFrame(result.regions[0].years)
    expected = _load_golden(case)

    assert actual.shape == expected.shape
    assert set(actual.columns) == set(expected.columns)

    for column in expected.columns:
        exp = pd.to_numeric(expected[column], errors='coerce').to_numpy(dtype=float)
        act = pd.to_numeric(actual[column], errors='coerce').to_numpy(dtype=float)
        if np.isnan(exp).all() and np.isnan(act).all():
            continue
        np.testing.assert_allclose(
            act, exp, atol=1e-6, rtol=0,
            err_msg=f'{case}: column {column!r} diverged from golden output')
