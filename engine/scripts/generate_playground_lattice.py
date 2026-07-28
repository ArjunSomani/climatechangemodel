"""Pre-compute a (carbon price × mortality price) lattice for the two-slider
playground.

The playground needs an *instant* response as the user drags two sliders, but
each optimizer run takes ~15s — far too slow to run live, and the preview site
has no always-on engine anyway. So we bake a grid of runs for one region here
and ship the results as a static JSON the web reads. The UI snaps the sliders to
grid points and reads the nearest cell.

The grid is deliberately fine so the sliders feel near-continuous. Each cell is
one independent optimizer run, so we fan them out across CPU cores with a process
pool (each cell is ~15s single-threaded; the pool turns a ~55-min serial run into
~15 min on 4 cores). Widening to more regions is a further generation-pipeline
concern; see MORTALITY.md.

Run:  python scripts/generate_playground_lattice.py [--workers N]
Out:  web/data/playground_lattice.json
"""
# Keep every worker single-threaded so N processes fill N cores cleanly instead
# of each spawning its own BLAS/numba thread pool and oversubscribing. Must be
# set before numpy/numba are imported (below, via optimize_engine).
import os

os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
os.environ.setdefault('MKL_NUM_THREADS', '1')
os.environ.setdefault('NUMBA_NUM_THREADS', '1')

import argparse
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from optimize_engine import ScenarioConfig, TweakPair, mortality, run_scenario
from optimize_engine.constants import nrgs

REGION = 'MIDW'  # coal and gas both large -> the carbon-vs-mortality story shows
YEARS = 6
# Fine grid so both sliders drag with near-continuous resolution. Carbon in $25
# steps to $400; mortality in $2M steps to $24M (spanning zero through past the
# high VSL preset). 17 x 13 = 221 cells.
CARBON_PRICES = [float(c) for c in range(0, 401, 25)]           # $/ton CO2
MORTALITY_PRICES = [float(2_000_000 * i) for i in range(0, 13)]  # $/death

OUT = Path(__file__).resolve().parent.parent.parent / 'web' / 'data' / 'playground_lattice.json'


def _config(carbon: float, mort: float) -> ScenarioConfig:
    return ScenarioConfig(
        region=REGION,
        years=YEARS,
        co2_price=TweakPair(initial=carbon, yearly=0),
        interest=TweakPair(initial=0.12, yearly=1),
        demand=TweakPair(initial=1.0, yearly=1.0),
        mortality_price=TweakPair(initial=mort, yearly=1),
    )


def _cell(result) -> dict:
    region = result.regions[0]
    last = region.years[-1]
    final_mix = {s: round(last.get(f'{s}_MWh', 0.0), 3) for s in nrgs}
    co2_final = round(sum(last.get(f'{s}_CO2_MT', 0.0) for s in nrgs), 4)
    deaths_final = region.deaths[-1]
    cumulative = sum(row['deaths_central'] for row in region.deaths)
    return {
        'finalMixMWh': final_mix,
        'co2FinalMT': co2_final,
        'deathsCentral': round(deaths_final['deaths_central'], 3),
        'deathsLow': round(deaths_final['deaths_low'], 3),
        'deathsHigh': round(deaths_final['deaths_high'], 3),
        'cumulativeDeathsCentral': round(cumulative, 3),
    }


def _compute(task: tuple[int, float, int, float]) -> tuple[str, dict]:
    """Top-level so ProcessPoolExecutor can dispatch it. One optimizer run."""
    ci, carbon, mi, mort = task
    return f'{ci}_{mi}', _cell(run_scenario(_config(carbon, mort)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--workers', type=int, default=os.cpu_count() or 1,
        help='parallel optimizer processes (default: all cores)')
    args = parser.parse_args()

    tasks = [
        (ci, carbon, mi, mort)
        for ci, carbon in enumerate(CARBON_PRICES)
        for mi, mort in enumerate(MORTALITY_PRICES)
    ]
    total = len(tasks)
    print(f'{total} cells ({len(CARBON_PRICES)} carbon x {len(MORTALITY_PRICES)} '
          f'mortality) on {args.workers} workers', flush=True)

    cells: dict[str, dict] = {}
    done = 0
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        for key, cell in pool.map(_compute, tasks):
            cells[key] = cell
            done += 1
            if done % 10 == 0 or done == total:
                print(f'[{done}/{total}] cells done', flush=True)

    payload = {
        'region': REGION,
        'years': YEARS,
        'sources': list(nrgs),
        'carbonPrices': CARBON_PRICES,
        'mortalityPrices': MORTALITY_PRICES,
        'mortalityVersion': mortality.mortality_version(),
        'cells': cells,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2))
    print(f'wrote {OUT} ({total} cells)')


if __name__ == '__main__':
    main()
