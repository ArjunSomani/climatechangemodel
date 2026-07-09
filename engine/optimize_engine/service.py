"""run_scenario(config) -> ScenarioResult (PRD §8.1).

Wraps the original do_region()/main() flow from Optimize.py: same
per-year loop (fig_tweakxs -> demand growth -> fig_decadence via
run_minimizer -> update_data -> add_output_year), just returning an
in-memory result instead of writing to Mailbox/Outbox.

Fanning out across all 13 regions for a "US" run is done as a plain
sequential loop here (matching the original's `kill_parallel=True`
fallback path) rather than multiprocessing — per PRD §8.2, real
parallelism across regions belongs to the job queue (one Celery subtask
per region), not to this function. Callers that want region-level
parallelism should call run_scenario once per single region concurrently,
not pass region="US" from inside one process.
"""
from typing import Callable, Optional

import numpy as np
import pandas as pd

from . import core
from .constants import Fixed_M_MW, Variable_M_MWh, nrgxs
from .schemas import RegionResult, ScenarioConfig, ScenarioResult

ProgressCB = Callable[[str, int, int], None]


def _do_region(region: str, inbox: pd.DataFrame, specxs_nrgxs: np.ndarray,
                progress_cb: Optional[ProgressCB] = None) -> pd.DataFrame:
    years = inbox.at['Years', 'Initial']

    hourly_cap_pct_nrgxs, MW_nrgxs, sample_years, sample_hours, first_year = core.get_eia_data(region)

    MWh_nrgxs, hourly_target_MWh = core.init_data(hourly_cap_pct_nrgxs, MW_nrgxs, sample_hours)

    output_matrix = core.init_output_matrix()

    sum_cost_per_hour = 0.
    for nrgx in nrgxs:
        sum_cost_per_hour += MWh_nrgxs[nrgx] * specxs_nrgxs[Variable_M_MWh, nrgx] / (365.25 * 24)
        sum_cost_per_hour += MW_nrgxs[nrgx] * specxs_nrgxs[Fixed_M_MW, nrgx] / (365.25 * 24)
    expensive = sum_cost_per_hour

    battery_stored = 0.
    outage_MWh = 0.

    tweaked_globalxs, tweaked_nrgxs = core.init_tweakxs(specxs_nrgxs, inbox)

    output_matrix = core.add_output_year(
        MW_nrgxs=MW_nrgxs,
        MWh_nrgxs=MWh_nrgxs,
        tweaked_globalxs=tweaked_globalxs,
        tweaked_nrgxs=tweaked_nrgxs,
        expensive=expensive,
        outage_MWh=outage_MWh,
        output_matrix=output_matrix,
        year=0,
        first_start_knobs=np.zeros(nrgxs.shape[0], dtype=float),
        knobs_nrgxs=np.zeros(nrgxs.shape[0], dtype=float),
        max_add_nrgxs=np.ones(nrgxs.shape[0], dtype=float),
        hourly_target_MWh=hourly_target_MWh,
        iterations=0,
        sample_years=sample_years,
        first_year=first_year,
    )

    knobs_nrgxs = core.init_knobs(tweaked_globalxs=tweaked_globalxs, tweaked_nrgxs=tweaked_nrgxs)

    if years > 0:
        for year in range(1, int(years) + 1):
            iterations = 0
            if progress_cb:
                progress_cb(region, year, int(years))

            tweaked_globalxs, tweaked_nrgxs = core.fig_tweakxs(
                tweaked_globalxs=tweaked_globalxs, tweaked_nrgxs=tweaked_nrgxs, inbox=inbox, year=year)

            hourly_target_MWh = hourly_target_MWh * tweaked_globalxs[core.Demand]

            knobs_nrgxs, max_add_nrgxs, first_start_knobs, iterations = core.run_minimizer(
                hourly_cap_pct_nrgxs=hourly_cap_pct_nrgxs,
                MW_nrgxs=MW_nrgxs,
                battery_stored=battery_stored,
                hourly_target_MWh=hourly_target_MWh,
                tweaked_globalxs=tweaked_globalxs,
                tweaked_nrgxs=tweaked_nrgxs,
                specxs_nrgxs=specxs_nrgxs,
                expensive=expensive,
                knobs_nrgxs=knobs_nrgxs,
                region=region,
                iterations=iterations,
                year=year,
                sample_hours=sample_hours,
            )

            MW_nrgxs, battery_stored, outage_MWh, MWh_nrgxs = core.update_data(
                knobs_nrgxs=knobs_nrgxs,
                hourly_cap_pct_nrgxs=hourly_cap_pct_nrgxs,
                MW_nrgxs=MW_nrgxs,
                tweaked_nrgxs=tweaked_nrgxs,
                tweaked_globalxs=tweaked_globalxs,
                specxs_nrgxs=specxs_nrgxs,
                battery_stored=battery_stored,
                hourly_target_MWh=hourly_target_MWh,
                sample_hours=sample_hours,
            )

            output_matrix = core.add_output_year(
                MW_nrgxs=MW_nrgxs,
                MWh_nrgxs=MWh_nrgxs,
                tweaked_globalxs=tweaked_globalxs,
                tweaked_nrgxs=tweaked_nrgxs,
                expensive=expensive,
                outage_MWh=outage_MWh,
                output_matrix=output_matrix,
                year=year,
                first_start_knobs=first_start_knobs,
                knobs_nrgxs=knobs_nrgxs,
                max_add_nrgxs=max_add_nrgxs,
                hourly_target_MWh=hourly_target_MWh,
                iterations=iterations,
                sample_years=sample_years,
                first_year=first_year,
            )

    return output_matrix


def run_scenario(config: ScenarioConfig, progress_cb: Optional[ProgressCB] = None) -> ScenarioResult:
    inbox = config.to_inbox_df()
    specxs_nrgxs = core.get_specxs_nrgxs()

    regions = list(core.get_all_regions()) if config.region == 'US' else [config.region]

    region_results = []
    for region in regions:
        output_matrix = _do_region(region, inbox, specxs_nrgxs, progress_cb)
        records = output_matrix.round(8).reset_index(drop=True).to_dict(orient='records')
        region_results.append(RegionResult(region=region, years=records))

    return ScenarioResult(config=config, regions=region_results)
