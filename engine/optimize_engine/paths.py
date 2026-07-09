"""Data directory resolution.

The original Optimize.py located its CSVs by mutating the process's
current working directory (os.chdir) and reading fixed relative paths
with inconsistent casing (./CSV/Specs.csv, .../Max_MWh_values_yearly/...)
that only resolved because macOS/Windows filesystems are case-insensitive.
That's incompatible with a long-lived server process handling concurrent
requests, and breaks on case-sensitive Linux. This module resolves the
same files by absolute path instead, matching actual on-disk casing.

Set ENGINE_DATA_DIR to point at an alternate data directory (e.g. one
populated by the EIA ingestion pipeline); defaults to the data/ folder
checked in alongside this package.
"""
import os
from pathlib import Path

_PACKAGE_DIR = Path(__file__).resolve().parent
_DEFAULT_DATA_DIR = _PACKAGE_DIR.parent / 'data'


def data_dir() -> Path:
    override = os.environ.get('ENGINE_DATA_DIR')
    return Path(override) if override else _DEFAULT_DATA_DIR


def specs_csv() -> Path:
    return data_dir() / 'Specs.csv'


def regions_csv() -> Path:
    return data_dir() / 'Regions.csv'


def hourly_capacity_csv(region: str) -> Path:
    return data_dir() / 'eia_hourly' / 'hourly_capacity' / f'{region}_master.csv'


def max_mwh_yearly_csv(region: str) -> Path:
    return data_dir() / 'eia_hourly' / 'max_mwh_yearly' / f'{region}_max_vals.csv'
