"""Convert the vendored EIA CSVs into the Parquet data store (PRD §9, §12).

This is a one-time/manual bridge from the hand-copied CSVs in
engine/data/eia_hourly/ to a Parquet layout the future scheduled EIA
ingestion job (refactored EIA_Downloader.py) will maintain going forward.
It does not touch how optimize_engine.core.get_eia_data() reads its
inputs -- that stays on the CSV path the golden parity tests validate
against. Consider this the seed for a `/eia` data store, not a change
to the engine's own I/O contract.

Output layout (engine/data/eia_parquet/):
  hourly_capacity.parquet   columns: region, date, Solar, Wind, Nuclear,
                             Gas, Coal, Hydro, Other, Oil (capacity
                             fraction 0-1, negative Solar values NOT
                             floored here -- that normalization is
                             engine-specific behavior, kept only in
                             optimize_engine.core.get_eia_data so this
                             store stays a faithful copy of the source)
  max_mwh_yearly.parquet    columns: region, year, Solar, Wind, Nuclear,
                             Gas, Coal, Hydro, Other, Oil (MW)
  meta.json                 regions covered, date range, row counts,
                             source file hashes, generated_at
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
HOURLY_CAPACITY_DIR = DATA_DIR / 'eia_hourly' / 'hourly_capacity'
MAX_MWH_YEARLY_DIR = DATA_DIR / 'eia_hourly' / 'max_mwh_yearly'
OUT_DIR = DATA_DIR / 'eia_parquet'


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def convert() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    hourly_frames = []
    max_frames = []
    source_hashes = {}
    regions = sorted(p.stem.removesuffix('_master') for p in HOURLY_CAPACITY_DIR.glob('*_master.csv'))

    for region in regions:
        hourly_path = HOURLY_CAPACITY_DIR / f'{region}_master.csv'
        max_path = MAX_MWH_YEARLY_DIR / f'{region}_max_vals.csv'

        hourly = pd.read_csv(hourly_path)
        hourly.insert(0, 'region', region)
        hourly['date'] = pd.to_datetime(hourly['date'], format='%Y%m%dT%H')
        hourly_frames.append(hourly)

        max_vals = pd.read_csv(max_path)
        max_vals = max_vals.rename(columns={'years': 'year'})
        max_vals.insert(0, 'region', region)
        max_frames.append(max_vals)

        source_hashes[region] = {
            'hourly_capacity_sha256': _sha256(hourly_path),
            'max_mwh_yearly_sha256': _sha256(max_path),
        }

    hourly_all = pd.concat(hourly_frames, ignore_index=True)
    max_all = pd.concat(max_frames, ignore_index=True)

    hourly_all.to_parquet(OUT_DIR / 'hourly_capacity.parquet', index=False)
    max_all.to_parquet(OUT_DIR / 'max_mwh_yearly.parquet', index=False)

    meta = {
        'version': datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'),
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'regions': regions,
        'date_range': [
            hourly_all['date'].min().isoformat(),
            hourly_all['date'].max().isoformat(),
        ],
        'hourly_row_count': len(hourly_all),
        'source_file_hashes': source_hashes,
    }
    (OUT_DIR / 'meta.json').write_text(json.dumps(meta, indent=2))

    print(f'Wrote {len(hourly_all):,} hourly rows and {len(max_all):,} yearly-max rows '
          f'for {len(regions)} regions to {OUT_DIR}')


if __name__ == '__main__':
    convert()
