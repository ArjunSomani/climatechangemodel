"""Optimization engine core.

This is a port of cliffgold/Optimize's Python/Optimize.py. Every numeric
computation (fig_tweakxs, fig_decadence, run_minimizer, solve_this,
update_data, fig_hourly, fig_cost, sort_costliest, add_output_year) is
unchanged from the original: same formulas, same operation order, same
bounds/tolerances for the minimizer. Do not "clean up" the math here
without re-validating against the golden-output parity test in
engine/tests/test_golden_parity.py — see PRD §10.

What *is* different from the original, deliberately:

1. No Inbox.csv/Outbox mailbox I/O and no os.chdir(). File paths are
   resolved via paths.py instead of relying on process-wide CWD state,
   which is unsafe for a long-lived server handling concurrent requests.
2. `sample_years` / `sample_hours` / `first_year` are no longer mutable
   module globals set by get_eia_data() — they're threaded through as
   explicit arguments. In the original, these are read inside a
   @jit(nopython=True) function (update_data); numba treats module
   globals as compile-time constants baked in at first call, so if a
   process ever handled two regions with different hour counts in
   sequence (the `kill_parallel=True` / non-multiprocessing fallback
   path in the original main()), the second region would silently reuse
   the first region's baked-in value. Passing sample_hours explicitly
   makes update_data's compiled signature depend on the value like any
   other argument, which removes that trap. This changes nothing about
   the arithmetic for the common case (multiprocessing / one-region-
   per-process) where the bug never triggered.
3. No debug.py instrumentation (debug_option is always 'None' in
   production; those branches were dead code in that mode).
4. No multiprocessing fan-out inside the engine itself. Fanning out
   across the 13 regions for a "US" run is a job-queue concern (PRD
   §8.2: one Celery subtask per region), not an in-process concern.
5. Minimizer failure raises RuntimeError with context instead of
   dumping a CSV to a Mailbox/Outbox directory that no longer exists.
"""
import warnings

import numpy as np
import numpy_financial as npf
import pandas as pd
from numba import jit
from scipy.optimize import Bounds, minimize

from . import paths
from .constants import (
    Batteryx, CO2_M_MT, CO2_MT_MWh, Capital_M_MW, Capital_Total_M_MW,
    Demand, Efficiency, Fixed_M_MW, Hours, Interest, Lifetime, MW_Mult,
    Max_PCT, Variable_M_MWh, delete_chars, nrg2nrgx_lu, nrgs, nrg_sources,
    nrgx2nrg_lu, nrgx_sources, nrgxs, output_header, param_order, specxs,
    tweakxs,
)

warnings.filterwarnings('error', module=r'.*optimize_engine.*')


# ---------------------------------------------------------------------------
# Reference data loaders
# ---------------------------------------------------------------------------

def get_specxs_nrgxs() -> np.ndarray:
    specs_pd = pd.read_csv(paths.specs_csv(), header=0, skiprows=1, sep=',', index_col=0)

    specxs_nrgxs = np.zeros((specxs.shape[0], nrgxs.shape[0]), dtype=float)
    specx2spec_lu = {
        Capital_Total_M_MW: 'Capital_Total_M$_MW',
        Fixed_M_MW: 'Fixed_M$_MW',
        Variable_M_MWh: 'Variable_M$_MWh',
        CO2_MT_MWh: 'CO2_MT_MWh',
        Lifetime: 'Lifetime',
        Max_PCT: 'Max_PCT',
        Efficiency: 'Efficiency',
        Hours: 'Hours',
    }
    for nrgx in nrgxs:
        nrg = nrgx2nrg_lu[nrgx]
        for specx in specxs:
            spec = specx2spec_lu[specx]
            specxs_nrgxs[specx, nrgx] = specs_pd.at[spec, nrg]

    return specxs_nrgxs


def get_all_regions() -> np.ndarray:
    regions_temp = np.genfromtxt(
        paths.regions_csv(),
        delimiter=',',
        dtype=('U5, U20'),
        names=True,
        deletechars=delete_chars,
    )
    return regions_temp['Abbr']


# There are two sets of EIA data for each region:
#   1. hourly_cap_pct_nrgxs: Hourly capacity percentages used historically
#      for each nrg. These percentages do not change for each year run.
#   2. MW_nrgxs: Maximum MW for each nrg. Starts at the maximum MWh for the
#      historical data, then is adjusted each year as plants are retired,
#      new plants are built, and demand changes.
#
# 'Hydro', 'Oil' and 'Other' are not used in the optimization; they're
# assumed to grow with demand. Gas and Battery are figured as fill-in at
# the end of each test run.
def get_eia_data(region: str):
    eia_cap_csv = pd.read_csv(paths.hourly_capacity_csv(region), header=0, skiprows=0)

    # Sometimes Solar has small negative values, which are not useful.
    for nrg in nrg_sources:
        eia_cap_csv[nrg] = eia_cap_csv[nrg].where(eia_cap_csv[nrg] > 0, 0)

    eia_max_csv = pd.read_csv(paths.max_mwh_yearly_csv(region), header=0, skiprows=0)
    eia_max = eia_max_csv.max(axis=0)

    MW_nrgxs = np.zeros(nrgxs.shape[0], dtype=float)
    sample_years = len(eia_cap_csv) / (365.25 * 24)
    sample_hours = len(eia_cap_csv)
    first_year = int(eia_cap_csv['date'][len(eia_cap_csv) - 1000][0:4])
    hourly_cap_pct_nrgxs = np.zeros((eia_cap_csv.index.shape[0], nrgxs.shape[0]), dtype=float)
    for nrgx in nrgx_sources:
        hourly_cap_pct_nrgxs[:, nrgx] = eia_cap_csv[nrgx2nrg_lu[nrgx]]
        MW_nrgxs[nrgx] = eia_max[nrgx2nrg_lu[nrgx]]

    MW_nrgxs[Batteryx] = 0
    return hourly_cap_pct_nrgxs, MW_nrgxs, sample_years, sample_hours, first_year


def init_output_matrix() -> pd.DataFrame:
    output_header_loc = output_header
    for nrg in nrgs:
        output_header_loc = pd.concat([output_header_loc, pd.Series(nrg)], axis=0, ignore_index=True)
        for param in param_order:
            output_header_loc = pd.concat(
                [output_header_loc, pd.Series([nrg + '_' + param])], axis=0, ignore_index=True)
    return pd.DataFrame(columns=output_header_loc, dtype=float)


def init_data(hourly_cap_pct_nrgxs, MW_nrgxs, sample_hours):
    MWh_nrgxs = np.zeros(nrgxs.shape[0], dtype=float)
    hourly_target_MWh = np.zeros(sample_hours, dtype=float)

    for nrgx in nrgx_sources:
        MWh_nrgxs[nrgx] = hourly_cap_pct_nrgxs[:, nrgx].sum() * MW_nrgxs[nrgx]
        hourly_target_MWh += hourly_cap_pct_nrgxs[:, nrgx] * MW_nrgxs[nrgx]

    return MWh_nrgxs, hourly_target_MWh


# ---------------------------------------------------------------------------
# Tweaks (config -> per-year economic parameters)
# ---------------------------------------------------------------------------

def init_tweakxs(specxs_nrgxs, inbox):
    tweaked_nrgxs = np.ones((tweakxs.shape[0], nrgs.shape[0]), dtype=float)

    for nrgx in nrgxs:
        for specx in specxs:
            tweaked_nrgxs[specx, nrgx] = specxs_nrgxs[specx, nrgx]

        tweaked_nrgxs[Capital_M_MW, nrgx] = \
            -4 * npf.pmt(inbox.at['Interest', 'Initial'] / 4,
                         specxs_nrgxs[Lifetime, nrgx] * 4,
                         specxs_nrgxs[Capital_Total_M_MW, nrgx])

    tweaked_globalxs = np.zeros(4, dtype=float)
    tweaked_globalxs[CO2_M_MT] = 0.
    tweaked_globalxs[Demand] = 1
    tweaked_globalxs[Interest] = 0.

    return tweaked_globalxs, tweaked_nrgxs


def fig_tweakxs(tweaked_nrgxs, tweaked_globalxs, inbox, year):
    if year == 1:
        loc_ = 'Initial'
        tweaked_globalxs[CO2_M_MT] = inbox.at['CO2_Price', loc_]
        tweaked_globalxs[Demand] = inbox.at['Demand', loc_]
        tweaked_globalxs[Interest] = inbox.at['Interest', loc_]
        tweaked_globalxs[MW_Mult] = inbox.at['MW_Mult', loc_]
    else:
        loc_ = 'Yearly'
        if tweaked_globalxs[CO2_M_MT] < inbox.at['CO2_Price', loc_]:
            tweaked_globalxs[CO2_M_MT] += inbox.at['CO2_Price', 'Initial']

        tweaked_globalxs[Demand] *= inbox.at['Demand', loc_]
        tweaked_globalxs[Interest] *= inbox.at['Interest', loc_]
        tweaked_globalxs[MW_Mult] *= inbox.at['MW_Mult', loc_]

    for nrgx in nrgxs:
        nrg = nrgx2nrg_lu[nrgx]
        tweaked_nrgxs[Capital_Total_M_MW, nrgx] *= inbox.at[nrg + '_Capital', loc_]
        tweaked_nrgxs[Fixed_M_MW, nrgx] *= inbox.at[nrg + '_Fixed', loc_]
        tweaked_nrgxs[Variable_M_MWh, nrgx] *= inbox.at[nrg + '_Variable', loc_]
        tweaked_nrgxs[Lifetime, nrgx] *= inbox.at[nrg + '_Lifetime', loc_]
        tweaked_nrgxs[Max_PCT, nrgx] *= inbox.at[nrg + '_Max_PCT', loc_]

        tweaked_nrgxs[Capital_M_MW, nrgx] = (
            -4 * npf.pmt(tweaked_globalxs[Interest] / 4,
                         tweaked_nrgxs[Lifetime, nrgx] * 4,
                         tweaked_nrgxs[Capital_Total_M_MW, nrgx]))

    return tweaked_globalxs, tweaked_nrgxs


def fig_decadence(MW_nrgxs, tweaked_nrgxs):
    for nrgx in nrgxs:
        MW_nrgxs[nrgx] *= 1 - (1 / tweaked_nrgxs[Lifetime, nrgx])
    return MW_nrgxs


# ---------------------------------------------------------------------------
# Hourly dispatch / cost (numba jit)
# ---------------------------------------------------------------------------

@jit(nopython=True)
def sort_costliest(costly_nrgxs, cost_per_MWh):
    for end_nrgx in range(costly_nrgxs.shape[0] - 1, 0, -1):
        for current_nrgx in range(end_nrgx):
            if cost_per_MWh[costly_nrgxs[current_nrgx]] < cost_per_MWh[costly_nrgxs[current_nrgx + 1]]:
                temp = costly_nrgxs[current_nrgx + 1]
                costly_nrgxs[current_nrgx + 1] = costly_nrgxs[current_nrgx]
                costly_nrgxs[current_nrgx] = temp
    return costly_nrgxs


@jit(nopython=True)
def fig_hourly(hourly_MWh_required, costly_nrgxs, hourly_MWh_avail_nrgxs,
               battery_max, battery_stored, battery_efficiency, battery_MW, Batteryx):
    battery_used = 0.
    battery_empty = battery_max - battery_stored
    MWh_used_nrgxs = np.zeros((nrgxs).shape[0], dtype=np.float32)

    for nrgx in nrgx_sources:
        MWh_used_nrgxs[nrgx] = hourly_MWh_avail_nrgxs[:, nrgx].sum()
        hourly_MWh_required -= hourly_MWh_avail_nrgxs[:, nrgx]

    for hour in range(hourly_MWh_required.shape[0]):
        MWh_needed = hourly_MWh_required[hour]
        if (MWh_needed < 0) and (battery_empty > 0):
            battery_avail = min(battery_empty / battery_efficiency, -MWh_needed, battery_MW) * battery_efficiency
            battery_empty -= battery_avail
            battery_stored += battery_avail
            MWh_needed += battery_avail
        elif (MWh_needed > 0) and (battery_stored > 0):
            MWh_avail = min(battery_stored, MWh_needed, battery_MW)
            battery_used += MWh_avail
            battery_stored -= MWh_avail
            MWh_needed -= MWh_avail

        hourly_MWh_required[hour] = MWh_needed

    MWh_used_nrgxs[Batteryx] = battery_used

    hourly_excess = -np.where(hourly_MWh_required < 0, hourly_MWh_required, 0)
    outage_MWh = np.sum(hourly_MWh_required[hourly_MWh_required > 0])

    for nrgx in costly_nrgxs:
        hourly_excess = hourly_excess - hourly_MWh_avail_nrgxs[:, nrgx]
        MWh_used_nrgxs[nrgx] = -hourly_excess[hourly_excess < 0].sum()
        hourly_excess = np.where(hourly_excess > 0, hourly_excess, 0)

    return MWh_used_nrgxs, outage_MWh, battery_stored


@jit(nopython=True)
def fig_cost(MW_nrgxs, MWh_nrgxs, tweaked_globalxs, tweaked_nrgxs, expensive, outage_MWh):
    cost = 0.
    for nrgx in nrgxs:
        cost += MW_nrgxs[nrgx] * tweaked_nrgxs[Capital_M_MW, nrgx] * tweaked_globalxs[MW_Mult]
        cost += MW_nrgxs[nrgx] * tweaked_nrgxs[Fixed_M_MW, nrgx] * tweaked_globalxs[MW_Mult]
        cost += MWh_nrgxs[nrgx] * tweaked_nrgxs[Variable_M_MWh, nrgx]
        cost += MWh_nrgxs[nrgx] * tweaked_nrgxs[CO2_MT_MWh, nrgx] * tweaked_globalxs[CO2_M_MT]
    cost += outage_MWh * expensive
    return cost


@jit(nopython=True)
def update_data(knobs_nrgxs, hourly_cap_pct_nrgxs, MW_nrgxs, tweaked_nrgxs, tweaked_globalxs,
                 specxs_nrgxs, battery_stored, hourly_target_MWh, sample_hours):
    hourly_MWh_needed = np.copy(hourly_target_MWh)
    MW_total = MW_nrgxs.sum()
    MWh_nrgxs = np.zeros(nrgxs.shape[0], dtype=float)
    hourly_MWh_avail_nrgxs = np.zeros((sample_hours, nrgxs.shape[0]), dtype=float)
    for nrgx in nrgxs:
        MW_nrgxs[nrgx] += knobs_nrgxs[nrgx] * MW_total
        hourly_MWh_avail_nrgxs[:, nrgx] = MW_nrgxs[nrgx] * hourly_cap_pct_nrgxs[:, nrgx]

    cost_per_MWh = np.zeros(nrgx_sources.shape[0], dtype=float)
    for nrgx in nrgx_sources:
        cost_per_MWh[nrgx] = tweaked_nrgxs[Variable_M_MWh, nrgx]
        cost_per_MWh[nrgx] += tweaked_nrgxs[CO2_MT_MWh, nrgx] * tweaked_globalxs[CO2_M_MT]

    costly_nrgxs = sort_costliest(costly_nrgxs=nrgx_sources.copy(), cost_per_MWh=cost_per_MWh)

    MWh_nrgxs, outage_MWh, battery_stored = fig_hourly(
        hourly_MWh_required=np.copy(hourly_MWh_needed),
        costly_nrgxs=costly_nrgxs,
        hourly_MWh_avail_nrgxs=hourly_MWh_avail_nrgxs,
        battery_max=MW_nrgxs[Batteryx] * specxs_nrgxs[Hours, Batteryx],
        battery_stored=battery_stored,
        battery_efficiency=specxs_nrgxs[Efficiency, Batteryx],
        battery_MW=MW_nrgxs[Batteryx],
        Batteryx=Batteryx,
    )

    return MW_nrgxs, battery_stored, outage_MWh, MWh_nrgxs


# ---------------------------------------------------------------------------
# Minimizer
# ---------------------------------------------------------------------------

def solve_this(knobs_nrgxs, hourly_cap_pct_nrgxs, MW_nrgxs, battery_stored, hourly_target_MWh,
               tweaked_globalxs, tweaked_nrgxs, specxs_nrgxs, expensive, sample_hours):
    new_MW_nrgxs = MW_nrgxs.copy()
    new_battery_stored = battery_stored

    new_MW_nrgxs, new_battery_stored, outage_MWh, MWh_nrgxs = update_data(
        knobs_nrgxs=knobs_nrgxs,
        hourly_cap_pct_nrgxs=hourly_cap_pct_nrgxs,
        MW_nrgxs=new_MW_nrgxs,
        tweaked_nrgxs=tweaked_nrgxs,
        tweaked_globalxs=tweaked_globalxs,
        specxs_nrgxs=specxs_nrgxs,
        battery_stored=new_battery_stored,
        hourly_target_MWh=hourly_target_MWh,
        sample_hours=sample_hours,
    )

    return fig_cost(
        MW_nrgxs=new_MW_nrgxs,
        MWh_nrgxs=MWh_nrgxs,
        tweaked_globalxs=tweaked_globalxs,
        tweaked_nrgxs=tweaked_nrgxs,
        expensive=expensive,
        outage_MWh=outage_MWh,
    )


def init_knobs(tweaked_globalxs, tweaked_nrgxs):
    knobs_nrgxs = np.zeros(nrgxs.shape[0], dtype=float)
    for nrgx in nrgxs:
        knobs_nrgxs[nrgx] = tweaked_globalxs[Demand] + (1 / tweaked_nrgxs[Lifetime, nrgx])
    return knobs_nrgxs


class MinimizerFailure(RuntimeError):
    def __init__(self, region, year, results):
        super().__init__(f'{region} - Minimizer failure in year {year}: {results.message}')
        self.region = region
        self.year = year
        self.results = results


def run_minimizer(hourly_cap_pct_nrgxs, MW_nrgxs, battery_stored, hourly_target_MWh,
                   tweaked_globalxs, tweaked_nrgxs, specxs_nrgxs, expensive, knobs_nrgxs,
                   region, iterations, year, sample_hours):
    MW_total = MW_nrgxs.sum() - MW_nrgxs[Batteryx]

    max_add_nrgxs = np.zeros(nrgxs.shape[0], dtype=float)

    # Max_PCT is the max rate MW increases year over year, as a percentage
    # of total MW that year. To allow battery (which starts at zero) to
    # build at all, we let it rebuild from decadence plus Max_PCT more.
    for nrgx in nrgxs:
        pct_of_total = MW_nrgxs[nrgx] / MW_total
        decayed = 1 / tweaked_nrgxs[Lifetime, nrgx]
        rebuild_pct = decayed * pct_of_total
        max_add_nrgxs[nrgx] = tweaked_nrgxs[Max_PCT, nrgx] + rebuild_pct

    MW_nrgxs = fig_decadence(MW_nrgxs, tweaked_nrgxs)

    hi_bound = max_add_nrgxs
    lo_bound = np.zeros(nrgxs.shape[0], dtype=float)
    bnds = Bounds(lo_bound, hi_bound, True)
    start_knobs = max_add_nrgxs.copy()
    method = 'Nelder-Mead'
    fatol = .00001
    xatol = .000001
    rerun = .01
    opt_done = False
    last_result = 0.
    first_start_knobs = start_knobs

    while not opt_done:
        results = minimize(
            solve_this,
            start_knobs,
            args=(
                hourly_cap_pct_nrgxs,
                MW_nrgxs,
                battery_stored,
                hourly_target_MWh,
                tweaked_globalxs,
                tweaked_nrgxs,
                specxs_nrgxs,
                expensive,
                sample_hours,
            ),
            bounds=bnds,
            method=method,
            options={'fatol': fatol, 'xatol': xatol, 'maxiter': 10000, 'maxfev': 10000, 'disp': False},
        )

        if not results.success:
            raise MinimizerFailure(region, year, results)

        iterations += results.nit
        if (last_result > (results.fun * (1 - rerun))) and (last_result < (results.fun * (1 + rerun))):
            knobs_nrgxs = np.array(results.x)
            opt_done = True
        else:
            start_knobs = np.array(results.x)
            last_result = results.fun
            fatol = fatol / 10.
            xatol = xatol / 10.

    return knobs_nrgxs, max_add_nrgxs, first_start_knobs, iterations


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def add_output_year(MW_nrgxs, MWh_nrgxs, tweaked_globalxs, tweaked_nrgxs, expensive, outage_MWh,
                     output_matrix, year, first_start_knobs, knobs_nrgxs, max_add_nrgxs,
                     hourly_target_MWh, iterations, sample_years, first_year):
    output_matrix.at[year, 'Year'] = year + first_year
    output_matrix.at[year, 'CO2_M$_MT'] = tweaked_globalxs[CO2_M_MT]
    output_matrix.at[year, 'Target_MWh'] = hourly_target_MWh.sum() / sample_years
    output_matrix.at[year, 'Outage_MWh'] = outage_MWh / sample_years
    output_matrix.at[year, 'Outage_M$_MWh'] = expensive
    output_matrix.at[year, 'Iterations'] = iterations

    for nrg in nrgs:
        nrgx = nrg2nrgx_lu[nrg]
        output_matrix.at[year, nrg + '_MW'] = MW_nrgxs[nrgx]
        output_matrix.at[year, nrg + '_MWh'] = MWh_nrgxs[nrgx] / sample_years
        output_matrix.at[year, nrg + '_Capital_M$'] = MW_nrgxs[nrgx] * tweaked_nrgxs[Capital_M_MW, nrgx]
        output_matrix.at[year, nrg + '_Fixed_M$'] = MW_nrgxs[nrgx] * tweaked_nrgxs[Fixed_M_MW, nrgx]
        output_matrix.at[year, nrg + '_Variable_M$'] = MWh_nrgxs[nrgx] * tweaked_nrgxs[Variable_M_MWh, nrgx]
        output_matrix.at[year, nrg + '_CO2_M$'] = (
            MWh_nrgxs[nrgx] * tweaked_nrgxs[CO2_MT_MWh, nrgx] * tweaked_globalxs[CO2_M_MT])
        output_matrix.at[year, nrg + '_CO2_MT'] = MWh_nrgxs[nrgx] * tweaked_nrgxs[CO2_MT_MWh, nrgx]
        output_matrix.at[year, nrg + '_Start_Knob'] = first_start_knobs[nrgx]
        output_matrix.at[year, nrg + '_Optimized_Knob'] = knobs_nrgxs[nrgx]
        output_matrix.at[year, nrg + '_PCT_Max_Add'] = knobs_nrgxs[nrgx] / max_add_nrgxs[nrgx]
        if MW_nrgxs[nrgx] == 0:
            output_matrix.at[year, nrg + '_Cap_Factor'] = 0
        else:
            output_matrix.at[year, nrg + '_Cap_Factor'] = (
                (MWh_nrgxs[nrgx] / sample_years) / (MW_nrgxs[nrgx] * 365.25 * 24))

    return output_matrix
