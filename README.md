# Optimize — Energy Grid Model Web Application

Web app for exploring US electricity-grid decarbonization scenarios, built
around the optimization engine from
[cliffgold/Optimize](https://github.com/cliffgold/Optimize) (vendored
locally at `vendor/optimize-original/`, gitignored, for reference).

See `PRD.md`-equivalent brief (not checked in here) for the full product
spec. Current status: **Phase 0-2 done.** Phase 0 (engine refactor +
golden parity + data conversion), Phase 1 (read-only site: Landing, How
It Works, Library, Data Explorer, Methodology), and Phase 2 (Compare) are
all live in production at https://climatechangemodel.vercel.app. Phase 3
(on-demand custom runs, needs a job queue + Python-capable host) and
Phase 4 (admin) are the only phases not started — both intentionally
deferred, v1 is library-browsing only.

## Hosting

- **GitHub**: https://github.com/arjunthegodly/climatechangemodel (private)
- **Vercel**: https://climatechangemodel.vercel.app — auto-deploys `web/`
  on every push to `main` (project's Root Directory is set to `web`,
  since the Next.js app doesn't live at the repo root).
- **Neon** (Postgres, via Vercel Marketplace): `climatechangemodel-db`,
  free plan. Holds the `library_cases` catalog (see
  `engine/scripts/setup_library_schema.py`) — 134 pre-computed scenarios
  as of 2026-07-10, each row versioned by `eia_version`/`specs_version`/
  `engine_version`.
- **Vercel Blob**: private store `climatechangemodel-blob` (region
  `iad1`), free tier. Holds each case's year-by-year result JSON, fetched
  server-side via `web/app/api/library/[...caseId]`.
- Both write their connection env vars to `web/.env.local` via
  `vercel env pull` (already gitignored).
- No backend host yet. v1 is library-browsing only (no on-demand runs),
  so the Python engine only needs to run offline/locally to pre-generate
  library results (`engine/scripts/generate_library.py`), not as an
  always-on service. A Python-capable host (Render, most likely, for its
  free background-worker tier) is deferred to Phase 3, when on-demand
  runs need a real job queue.

## Layout

```
engine/
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
    refresh_eia_data.py        pulls hourly generation from the live EIA API v2
    convert_eia_to_parquet.py  raw EIA CSVs -> engine/data/eia_parquet/
    generate_eia_explorer_data.py  pre-aggregates parquet -> small per-region JSON blobs
    setup_library_schema.py    creates the Neon library_cases table
    generate_library.py        runs scenarios, upserts Neon + uploads Vercel Blob
vendor/optimize-original/  pristine clone of cliffgold/Optimize (gitignored)
web/                      Next.js frontend (live at climatechangemodel.vercel.app)
  app/
    page.tsx                 Landing
    how-it-works/            How It Works
    library/, library/[...caseId]/  Library browse + single-case view
    compare/                 Compare
    data-explorer/           Data Explorer (raw EIA data, aggregated)
    methodology/             Methodology (assumptions/limitations/versioning)
    api/library/[...caseId]  server-side fetch of a case's result blob
  lib/
    db.ts, library.ts          server-only (import pg/@vercel/blob) -- see note below
    eiaExplorer.ts, metrics.ts, regions.ts, sources.ts, format.ts   shared helpers
  components/                 ScenarioPicker, CasePicker, charts, Nav, etc.
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
(regenerable source data — see `.gitignore` for why). Current data covers
January 2020 through December 2025 (complete calendar years only).

To bootstrap from the vendored clone's original 2020-2024 snapshot:

```bash
mkdir -p engine/data/eia_hourly/hourly_capacity engine/data/eia_hourly/max_mwh_yearly
cp vendor/optimize-original/csv/Eia_Hourly/Latest/Hourly_Capacity_values/*.csv \
   engine/data/eia_hourly/hourly_capacity/
cp vendor/optimize-original/csv/Eia_Hourly/Latest/max_MWh_values_yearly/*.csv \
   engine/data/eia_hourly/max_mwh_yearly/
python engine/scripts/convert_eia_to_parquet.py
```

To pull newer complete years from the live EIA API instead (requires an
EIA API key in repo-root `.env`, e.g. `EIA_API_KEY=...`):

```bash
python engine/scripts/refresh_eia_data.py
```

This fetches incrementally (only years not already present), verifies
CAL byte-for-byte against the previous data before replacing anything,
and regenerates `eia_parquet/` + bumps `eia_version`. After a refresh,
re-run `generate_library.py` (regenerates any case whose stored
`eia_version` no longer matches — see below) and
`generate_eia_explorer_data.py` (Data Explorer's pre-aggregated blobs).

### Running the parity tests

```bash
cd engine && source .venv/bin/activate && pytest tests/ -v
```

### Regenerating the pre-computed library

```bash
python engine/scripts/generate_library.py
```

Idempotent: each row in Neon's `library_cases` is stamped with the
`eia_version`/`specs_version` it was generated under, and a case is only
skipped if both still match current values — so refreshing the EIA data
or editing `Specs.csv` correctly forces every affected case to
regenerate rather than silently serving a stale result. Runs ~45-60s per
case that actually needs (re)computing; a full regeneration from empty
is well over an hour, so it opens a fresh Postgres connection for each
case's upsert rather than holding one connection for the whole run
(Neon will drop a connection held open that long).

### Frontend server/client split

`web/lib/db.ts` and `web/lib/library.ts` are server-only (they import
`pg`/`@vercel/blob`). Pure helpers usable from client components (e.g.
`totalCO2MT`, `caseLabel`) live in `web/lib/metrics.ts` instead —
importing a real (non-type) export from `library.ts` into a client
component pulls `pg` into the browser bundle and breaks the build.

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
