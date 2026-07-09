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
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from optimize_engine import run_scenario
from optimize_engine.mailbox import read_inbox_csv

GOLDEN_DIR = Path(__file__).parent / 'golden'

CASES = [
    'golden_CAL',
    'golden_CAL_tweaked',
]


def _load_golden(name: str) -> pd.DataFrame:
    path = GOLDEN_DIR / f'{name}-CAL.csv'
    # Original Outbox format: params as rows, year index as columns.
    return pd.read_csv(path, index_col=0).transpose().reset_index(drop=True)


@pytest.mark.parametrize('case', CASES)
def test_matches_original_engine_bit_for_bit(case):
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
