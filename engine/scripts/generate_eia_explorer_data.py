"""Generate aggregated EIA views for the Data Explorer (PRD §6.7, §7.5).

The Data Explorer must never ship raw hourly EIA data to the browser
(570k rows across 13 regions) -- it shows pre-aggregated views instead.
This reads the Parquet store built by convert_eia_to_parquet.py and
uploads one JSON blob per region containing:
  - typical_day: 24-hour average capacity fraction per source, averaged
    across every year in the store (the "what does a normal day look
    like" view)
  - weekly: weekly-average capacity fraction per source across the full
    span (~52 points per year, per source -- the "how does it change
    across seasons/years" view). The span is whatever the Parquet store
    holds; it reached 2025 after a refresh, so hard-coded year counts
    here went stale and are now described relatively.
  - yearly_max_mw: yearly max MW per source, straight from the source data

Requires engine/data/eia_parquet/ to exist locally (see
convert_eia_to_parquet.py) and BLOB_READ_WRITE_TOKEN in web/.env.local.
"""
import json
from pathlib import Path

import pandas as pd
from dotenv import dotenv_values

from optimize_engine.blob import upload_json_blob

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


# Uploads go through optimize_engine.blob, which is the module that exists so
# this logic lives in one place. This script used to shell out to the `vercel`
# CLI instead, write the payload to a temp file, and then recover the resulting
# URL by scanning stdout for a line starting "> Success!". That is three failure
# modes the REST path doesn't have: the CLI must be installed and linked, the
# temp file must survive, and the human-readable output format must never
# change. blob.py was written precisely to avoid the CLI (the worker runs on a
# non-Vercel host where it isn't available); this file was simply missed.


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

        url = upload_json_blob(f'eia-explorer/{region}.json', payload, env['BLOB_READ_WRITE_TOKEN'])
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
    index_url = upload_json_blob('eia-explorer/index.json', index_payload, env['BLOB_READ_WRITE_TOKEN'])
    print(f'index -> {index_url}')


if __name__ == '__main__':
    main()
