"""Refresh EIA hourly generation data (PRD §9).

Extends engine/data/eia_hourly/{hourly_capacity,max_mwh_yearly}/*.csv with
newly available complete calendar years from the live EIA API v2, instead
of relying on the vendor repo's static 2020-2024 snapshot forever. Ported
from vendor/optimize-original/Python/EIA_Downloader.py -- same fuel-code
mapping, same per-year normalization, same 24-hour-shift gap fill -- but
reads EIA_API_KEY from the repo-root .env (never a local password file)
and fetches only the missing years instead of the full 2020-present range
on every run.

Deliberately conservative like the original: only pulls complete past
calendar years (through Jan 1 of the current year), never a partial
in-progress year -- an incomplete year's observed max would understate
that source's true yearly peak and skew every other hour's capacity-factor
normalization for that year.

After running this, re-run convert_eia_to_parquet.py and
generate_eia_explorer_data.py to refresh the derived Parquet/Blob stores,
then generate_library.py to regenerate every case against the new
first_year baseline.
"""
import datetime as dt
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENGINE_DIR = REPO_ROOT / 'engine'
HOURLY_DIR = ENGINE_DIR / 'data' / 'eia_hourly' / 'hourly_capacity'
MAX_DIR = ENGINE_DIR / 'data' / 'eia_hourly' / 'max_mwh_yearly'

LENGTH_QUERY = 5000
BASE_URL = 'https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/'
REQUEST_TIMEOUT = 60
SLEEP_BETWEEN_REQUESTS = 0.15

# Ported verbatim from vendor/optimize-original/Python/EIA_Downloader.py's
# region_dict (fuel code -> available in that region's EIA data).
REGION_DICT: dict[str, dict[str, bool]] = {
    'CAL':  {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'CAR':  {'SUN': True, 'NUC': True, 'WND': False, 'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'CENT': {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'FLA':  {'SUN': True, 'NUC': True, 'WND': False, 'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'MIDA': {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'MIDW': {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': False},
    'NE':   {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'NW':   {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'NY':   {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'SE':   {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'SW':   {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'TEN':  {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': True},
    'TEX':  {'SUN': True, 'NUC': True, 'WND': True,  'COL': True, 'WAT': True, 'NG': True, 'OTH': True, 'OIL': False},
}
FUEL_TITLES = {
    'SUN': 'Solar', 'NUC': 'Nuclear', 'WND': 'Wind', 'COL': 'Coal',
    'WAT': 'Hydro', 'NG': 'Gas', 'OTH': 'Other', 'OIL': 'Oil',
}
# Column order matching the existing CSVs (not alphabetical -- preserved
# for diffability against files fetched by the original downloader).
SOURCE_ORDER = ['Solar', 'Nuclear', 'Wind', 'Coal', 'Hydro', 'Gas', 'Other', 'Oil']


def _api_key() -> str:
    env = dotenv_values(REPO_ROOT / '.env')
    key = env.get('EIA_API_KEY')
    if not key:
        raise RuntimeError('.env is missing EIA_API_KEY (see .env.example)')
    return key


def _fetch_hourly(region: str, fuel_code: str, start: dt.datetime, end: dt.datetime, api_key: str) -> dict:
    """Fetch raw hourly MWh values in [start, end) as {period_str: value}."""
    records: dict[str, float] = {}
    offset = 0
    while True:
        params = {
            'api_key': api_key,
            'frequency': 'hourly',
            'data[0]': 'value',
            'facets[respondent][]': region,
            'facets[fueltype][]': fuel_code,
            'start': start.strftime('%Y-%m-%dT%H'),
            'end': end.strftime('%Y-%m-%dT%H'),
            'sort[0][column]': 'period',
            'sort[0][direction]': 'asc',
            'offset': offset,
            'length': LENGTH_QUERY,
        }
        resp = requests.get(BASE_URL, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        rows = resp.json()['response']['data']
        if not rows:
            break
        for row in rows:
            v = row['value']
            records[row['period']] = float(v) if v not in (None, '') else np.nan
        if len(rows) < LENGTH_QUERY:
            break
        offset += LENGTH_QUERY
        time.sleep(SLEEP_BETWEEN_REQUESTS)
    return records


def _clean_series(s: pd.Series) -> pd.Series:
    """Fill gaps from the same hour 24h before/after, matching the
    original clean_energy()'s intent without its O(n) python loop."""
    s = s.copy()
    for _ in range(10):
        if not s.isna().any():
            break
        s = s.fillna(s.shift(24))
    for _ in range(10):
        if not s.isna().any():
            break
        s = s.fillna(s.shift(-24))
    return s.fillna(0)


def _fetch_region_range(region: str, start: dt.datetime, end: dt.datetime, api_key: str) -> pd.DataFrame:
    """Raw (un-normalized) hourly MWh for one region over [start, end),
    one column per source, gaps filled."""
    idx = pd.date_range(start, end, freq='h', inclusive='left')
    fuel_map = REGION_DICT[region]
    out = pd.DataFrame(index=idx)

    for fuel_code, available in fuel_map.items():
        source = FUEL_TITLES[fuel_code]
        if not available:
            print(f'  {region} {source} -- zero filled (not in EIA for this region)')
            out[source] = 0.0
            continue

        print(f'  {region} {source} -- fetching...')
        records = _fetch_hourly(region, fuel_code, start, end, api_key)
        s = pd.Series(index=idx, dtype='float64')
        for period_str, value in records.items():
            ts = pd.to_datetime(period_str, format='%Y-%m-%dT%H')
            if ts in s.index:
                s.loc[ts] = value
        out[source] = _clean_series(s)

    return out[SOURCE_ORDER]


def _normalize_new_years(raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Per-year normalize (matching normalize_per_year) and return
    (normalized_hourly, yearly_max) for whatever years raw spans."""
    normalized = raw.copy()
    years = sorted(set(raw.index.year))
    max_rows = []
    for year in years:
        mask = raw.index.year == year
        row = {'year': year}
        for col in SOURCE_ORDER:
            col_max = raw.loc[mask, col].max()
            row[col] = col_max if pd.notna(col_max) else 0.0
            if col_max and col_max > 0:
                normalized.loc[mask, col] = raw.loc[mask, col] / col_max
        max_rows.append(row)
    return normalized, pd.DataFrame(max_rows)


def refresh_region(region: str, target_end: dt.datetime, api_key: str) -> bool:
    """Returns True if new data was fetched and written for this region."""
    hourly_path = HOURLY_DIR / f'{region}_master.csv'
    max_path = MAX_DIR / f'{region}_max_vals.csv'

    existing_hourly = pd.read_csv(hourly_path)
    existing_hourly['date'] = pd.to_datetime(existing_hourly['date'], format='%Y%m%dT%H')
    existing_max = pd.read_csv(max_path)

    last_existing = existing_hourly['date'].max()
    fetch_start = last_existing + pd.Timedelta(hours=1)

    if fetch_start >= target_end:
        print(f'{region}: already up to date through {last_existing} -- skipping')
        return False

    print(f'{region}: fetching {fetch_start} through {target_end} (exclusive)')
    raw = _fetch_region_range(region, fetch_start.to_pydatetime(), target_end, api_key)
    normalized, new_max = _normalize_new_years(raw)

    new_hourly_rows = normalized.reset_index().rename(columns={'index': 'date'})
    new_hourly_rows['date'] = new_hourly_rows['date'].dt.strftime('%Y%m%dT%H')

    combined_hourly = pd.concat(
        [existing_hourly.assign(date=existing_hourly['date'].dt.strftime('%Y%m%dT%H')), new_hourly_rows],
        ignore_index=True,
    )
    combined_max = pd.concat([existing_max, new_max.rename(columns={'year': 'years'})], ignore_index=True)

    combined_hourly.to_csv(hourly_path, index=False)
    combined_max.to_csv(max_path, index=False)
    print(f'{region}: wrote {len(new_hourly_rows)} new hourly rows, {len(new_max)} new yearly-max rows')
    return True


def main() -> None:
    api_key = _api_key()
    # Conservative like the original: only complete past calendar years.
    target_end = dt.datetime(dt.date.today().year, 1, 1)

    any_updated = False
    for region in REGION_DICT:
        if refresh_region(region, target_end, api_key):
            any_updated = True

    if not any_updated:
        print('\nAll regions already up to date -- nothing fetched.')
    else:
        print('\nDone. Now re-run convert_eia_to_parquet.py, '
              'generate_eia_explorer_data.py, and generate_library.py.')


if __name__ == '__main__':
    main()
