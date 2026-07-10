"""Generate aggregated EIA views for the Data Explorer (PRD §6.7, §7.5).

The Data Explorer must never ship raw hourly EIA data to the browser
(570k rows across 13 regions) -- it shows pre-aggregated views instead.
This reads the Parquet store built by convert_eia_to_parquet.py and
uploads one JSON blob per region containing:
  - typical_day: 24-hour average capacity fraction per source, averaged
    across all 5 years (the "what does a normal day look like" view)
  - weekly: weekly-average capacity fraction per source across the full
    2020-2024 span (~261 points/source -- the "how does it change
    across seasons/years" view)
  - yearly_max_mw: yearly max MW per source, straight from the source data

Requires engine/data/eia_parquet/ to exist locally (see
convert_eia_to_parquet.py) and `vercel` CLI linked in web/.
"""
import json
import subprocess
import tempfile
from pathlib import Path

import pandas as pd
from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIR = REPO_ROOT / 'web'
ENGINE_DIR = REPO_ROOT / 'engine'
PARQUET_DIR = ENGINE_DIR / 'data' / 'eia_parquet'

SOURCES = ['Solar', 'Wind', 'Nuclear', 'Gas', 'Coal', 'Hydro', 'Other', 'Oil']


def _env() -> dict:
    env = dotenv_values(WEB_DIR / '.env.local')
    if not env.get('BLOB_READ_WRITE_TOKEN'):
        raise RuntimeError('web/.env.local is missing BLOB_READ_WRITE_TOKEN')
    return env


def _upload_blob(pathname: str, payload: dict, rw_token: str) -> str:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(payload, f)
        tmp_path = f.name

    try:
        result = subprocess.run(
            [
                'vercel', 'blob', 'put', tmp_path,
                '--access', 'private',
                '--pathname', pathname,
                '--allow-overwrite', 'true',
                '--rw-token', rw_token,
            ],
            cwd=WEB_DIR,
            capture_output=True,
            text=True,
            timeout=60,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if result.returncode != 0:
        raise RuntimeError(f'vercel blob put failed for {pathname}:\n{result.stdout}\n{result.stderr}')

    for line in (result.stdout + result.stderr).splitlines():
        if line.strip().startswith('> Success!'):
            return line.split('Success!', 1)[1].strip()

    raise RuntimeError(f'Could not parse blob URL for {pathname}:\n{result.stdout}\n{result.stderr}')


def main() -> None:
    env = _env()

    hourly = pd.read_parquet(PARQUET_DIR / 'hourly_capacity.parquet')
    yearly_max = pd.read_parquet(PARQUET_DIR / 'max_mwh_yearly.parquet')
    meta = json.loads((PARQUET_DIR / 'meta.json').read_text())

    regions = sorted(hourly['region'].unique())
    blob_urls = {}

    for region in regions:
        df = hourly[hourly['region'] == region].copy()
        df['hour'] = df['date'].dt.hour
        df['week'] = df['date'].dt.to_period('W').apply(lambda p: p.start_time.date().isoformat())

        # fillna(0): a source can be legitimately absent for a region (see
        # csv/Eia_Hourly/Readme.txt's "In_EIA:false" cases upstream) --
        # NaN isn't valid JSON and would break JSON.parse on the frontend.
        typical_day = (
            df.groupby('hour')[SOURCES].mean().fillna(0).round(4).reset_index()
            .to_dict(orient='records')
        )
        weekly = (
            df.groupby('week')[SOURCES].mean().fillna(0).round(4).reset_index()
            .rename(columns={'week': 'date'})
            .to_dict(orient='records')
        )
        region_max = (
            yearly_max[yearly_max['region'] == region][['year'] + SOURCES]
            .fillna(0)
            .sort_values('year')
            .to_dict(orient='records')
        )

        payload = {
            'region': region,
            'typical_day': typical_day,
            'weekly': weekly,
            'yearly_max_mw': region_max,
        }

        url = _upload_blob(f'eia-explorer/{region}.json', payload, env['BLOB_READ_WRITE_TOKEN'])
        blob_urls[region] = url
        print(f'{region}: typical_day={len(typical_day)} weekly={len(weekly)} '
              f'yearly_max={len(region_max)} -> {url}')

    index_payload = {
        'regions': regions,
        'sources': SOURCES,
        'eia_version': meta['version'],
        'date_range': meta['date_range'],
        'blob_urls': blob_urls,
    }
    index_url = _upload_blob('eia-explorer/index.json', index_payload, env['BLOB_READ_WRITE_TOKEN'])
    print(f'index -> {index_url}')


if __name__ == '__main__':
    main()
