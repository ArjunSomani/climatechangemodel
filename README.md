# Optimize — Energy Grid Model Web Application

Web app for exploring US electricity-grid decarbonization scenarios, built
around the optimization engine from
[cliffgold/Optimize](https://github.com/cliffgold/Optimize) (vendored
locally at `vendor/optimize-original/`, gitignored, for reference).

See `PRD.md`-equivalent brief (not checked in here) for the full product
spec. Current status: **Phase 0 — Foundations** (engine refactor + golden
parity + data conversion). No API/frontend yet.

## Layout

```
engine/                  Python optimization engine
  optimize_engine/        run_scenario(config) -> ScenarioResult
    core.py                unmodified port of Optimize.py's numeric logic
    schemas.py              ScenarioConfig / ScenarioResult (Pydantic)
    service.py               do_region-equivalent, in-memory, no CSV mailbox
    mailbox.py                Inbox.csv/Outbox compat shim for Excel front-ends
  data/
    Specs.csv, Regions.csv   committed (small, authoritative)
    eia_hourly/, eia_parquet/  gitignored (regenerate, see below)
  tests/
    test_golden_parity.py    engine output must match the original bit-for-bit
    golden/                  fixed scenarios + their known-correct outputs
  scripts/
    convert_eia_to_parquet.py
vendor/optimize-original/  pristine clone of cliffgold/Optimize (gitignored)
```

## Setup

Requires Python 3.11+ (the vendored engine's debug.py uses `match`/`case`,
which needs 3.10+; numba wants a well-supported recent version).

```bash
cd engine
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

### Getting the EIA data locally

`engine/data/eia_hourly/` and `engine/data/eia_parquet/` are gitignored
(79MB/17MB of vendored source data — see `.gitignore` for why). To
populate them from the vendored clone:

```bash
mkdir -p engine/data/eia_hourly/hourly_capacity engine/data/eia_hourly/max_mwh_yearly
cp vendor/optimize-original/csv/Eia_Hourly/Latest/Hourly_Capacity_values/*.csv \
   engine/data/eia_hourly/hourly_capacity/
cp vendor/optimize-original/csv/Eia_Hourly/Latest/max_MWh_values_yearly/*.csv \
   engine/data/eia_hourly/max_mwh_yearly/
python engine/scripts/convert_eia_to_parquet.py
```

### Running the parity tests

```bash
cd engine && source .venv/bin/activate && pytest tests/ -v
```

## Known deviations from the original repo (all verified not to change results)

- File paths are resolved explicitly (`paths.py`) instead of via
  `os.chdir()` + fixed relative strings — the original mixed casing
  (`./CSV/Specs.csv`, `Max_MWh_values_yearly`) only worked because macOS/
  Windows filesystems are case-insensitive; this breaks on Linux
  containers.
- `sample_hours` is passed explicitly into `update_data` (numba jit)
  instead of being read as a mutable module global — the original's
  global-capture pattern only reproduces correctly across regions with
  different hour counts *by accident*, because production runs use one
  OS process per region (multiprocessing). See `core.py`'s module
  docstring for the full explanation.
- No multiprocessing inside the engine. Fanning out across all 13
  regions for a `region="US"` run is a plain sequential loop here;
  real parallelism is a job-queue concern for a later phase.
- The checked-in `Samples/Inbox.csv` in the source repo is stale: it's
  missing `SubDir` and `MW_Mult` rows that `Optimize.py` actually reads
  via `inbox.at[...]`. `ScenarioConfig`/`mailbox.py` reflect what the
  code reads, not the stale sample.

Golden parity is verified against two scenarios run through the
**unmodified** original engine (see `engine/tests/golden/`): the
default 27-year/CO2=500 case from PRD §10, and a second case exercising
non-default per-source tweaks, higher CO2 step, and `MW_Mult=2`. Both
match to zero absolute difference.
