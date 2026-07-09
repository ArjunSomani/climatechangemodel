"""CSV mailbox compatibility shim (PRD §8.3).

Lets the researcher's existing Excel front-ends (Overlord/Lib_Gen) keep
working during the transition: read an Inbox.csv-shaped file into a
ScenarioConfig, and write a RegionResult back out in the original
transposed Outbox CSV shape (params as rows, years as columns).

Reflects the engine's actual required rows (Region, SubDir, Years,
CO2_Price, Interest, Demand, MW_Mult, {Source}_{Field} x 6 x 5) rather
than the stale Samples/Inbox.csv, which is missing SubDir and MW_Mult.
"""
from pathlib import Path

import pandas as pd

from .schemas import SOURCES, RegionResult, ScenarioConfig, SourceTweaks, TweakPair


def _tweak_pair(inbox: pd.DataFrame, row: str, default: TweakPair = None) -> TweakPair:
    if row not in inbox.index:
        if default is not None:
            return default
        raise KeyError(f'Inbox is missing required row {row!r}')
    return TweakPair(initial=float(inbox.at[row, 'Initial']), yearly=float(inbox.at[row, 'Yearly']))


def inbox_df_to_config(inbox: pd.DataFrame) -> ScenarioConfig:
    sources = {}
    for source in SOURCES:
        sources[source] = SourceTweaks(
            capital=_tweak_pair(inbox, f'{source}_Capital'),
            fixed=_tweak_pair(inbox, f'{source}_Fixed'),
            variable=_tweak_pair(inbox, f'{source}_Variable'),
            lifetime=_tweak_pair(inbox, f'{source}_Lifetime'),
            max_pct=_tweak_pair(inbox, f'{source}_Max_PCT'),
        )

    return ScenarioConfig(
        region=inbox.at['Region', 'Text'],
        sub_dir=inbox.at['SubDir', 'Text'] if 'SubDir' in inbox.index else None,
        years=int(inbox.at['Years', 'Initial']),
        co2_price=_tweak_pair(inbox, 'CO2_Price'),
        interest=_tweak_pair(inbox, 'Interest'),
        demand=_tweak_pair(inbox, 'Demand'),
        mw_mult=_tweak_pair(inbox, 'MW_Mult', default=TweakPair(initial=1, yearly=1)),
        sources=sources,
        directory=inbox.at['Directory', 'Text'] if 'Directory' in inbox.index else None,
        title=inbox.at['Title', 'Text'] if 'Title' in inbox.index else None,
    )


def read_inbox_csv(path) -> ScenarioConfig:
    inbox = pd.read_csv(path, header=0, sep=',', index_col=0)
    return inbox_df_to_config(inbox)


def write_outbox_csv(config: ScenarioConfig, region_result: RegionResult, out_dir) -> Path:
    """Write one region's results in the original transposed Outbox shape:
    param names as rows, year index (0..years) as columns."""
    df = pd.DataFrame(region_result.years)
    matrix_t = df.round(8).transpose()

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    file_path = out_dir / f'{config.resolved_sub_dir()}-{region_result.region}.csv'
    matrix_t.to_csv(file_path)
    return file_path
