"""Pre-compute a small (carbon price × mortality price) lattice for the
two-slider playground.

The playground needs an *instant* response as the user drags two sliders, but
each optimizer run takes tens of seconds — far too slow to run live, and the
preview site has no always-on engine anyway. So we bake a coarse grid of runs
for one region here and ship the results as a static JSON the web reads. The UI
snaps the sliders to grid points and reads the nearest cell.

This is deliberately a small demo lattice (one region, a coarse grid). Widening
it to more regions / a finer grid is a generation-pipeline concern, exactly as
the pre-computed library is; see MORTALITY.md.

Run:  python scripts/generate_playground_lattice.py
Out:  web/data/playground_lattice.json
"""
import json
from pathlib import Path

from optimize_engine import ScenarioConfig, TweakPair, mortality, run_scenario
from optimize_engine.constants import nrgs

REGION = 'MIDW'  # coal and gas both large -> the carbon-vs-mortality story shows
YEARS = 6
# Finer grid so the sliders have real resolution (the old 3x3 snapped too
# coarsely to see coal phase out gradually). Carbon in even $50 steps; mortality
# anchored to zero + the three HHS 2026 VSL presets so every notch is a real,
# self-describing price rather than an arbitrary interpolation.
CARBON_PRICES = [0.0, 50.0, 100.0, 150.0, 200.0, 250.0, 300.0, 350.0]  # $/ton CO2
MORTALITY_PRICES = [0.0, 6_600_000.0, 14_100_000.0, 21_500_000.0]  # $/death (0, low, central, high VSL)

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


def main() -> None:
    cells: dict[str, dict] = {}
    total = len(CARBON_PRICES) * len(MORTALITY_PRICES)
    n = 0
    for ci, carbon in enumerate(CARBON_PRICES):
        for mi, mort in enumerate(MORTALITY_PRICES):
            n += 1
            print(f'[{n}/{total}] carbon={carbon} mortality={mort} ...', flush=True)
            result = run_scenario(_config(carbon, mort))
            cells[f'{ci}_{mi}'] = _cell(result)

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
