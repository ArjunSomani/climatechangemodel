"""The CO2 price ramp's two numbers do not mean what their names suggest.

`co2_price.initial` is BOTH the year-one price and the annual increment, and
`co2_price.yearly` is a CEILING -- not a per-year delta. core.fig_tweakxs:

    if tweaked_globalxs[CO2_M_MT] < inbox.at['CO2_Price', 'Yearly']:
        tweaked_globalxs[CO2_M_MT] += inbox.at['CO2_Price', 'Initial']

That is the original Optimize.py behaviour and is locked by the golden parity
tests, so it is not going to change. What it does need is a test that states it
out loud, because reading `initial`/`yearly` as (start, step) is the natural
reading and it is wrong in a way that fails silently: a config whose ceiling is
below its start simply never rises, and produces a perfectly plausible flat-price
run.

That is not hypothetical. The web app shipped a "Rising carbon price" preset of
{initial: 50, yearly: 10} described to users as "Starts at $50/ton, climbs $10
every year". It held flat at $50 for the entire 25-year horizon, and anyone
comparing it against the flat-$100 preset was reading a difference in price
level as a difference in trajectory.
"""
import pytest

from optimize_engine import core
from optimize_engine.constants import CO2_M_MT
from optimize_engine.schemas import ScenarioConfig


def price_trajectory(initial, yearly, years=12):
    """The CO2 price the engine applies in each year 1..years."""
    config = ScenarioConfig(
        region='MIDW',
        years=years,
        co2_price={'initial': initial, 'yearly': yearly},
        interest={'initial': 0.12, 'yearly': 1},
        demand={'initial': 1.02, 'yearly': 1},
    )
    inbox = config.to_inbox_df()
    specxs_nrgxs = core.get_specxs_nrgxs()
    tweaked_globalxs, tweaked_nrgxs = core.init_tweakxs(specxs_nrgxs, inbox)

    trajectory = []
    for year in range(1, years + 1):
        core.fig_tweakxs(tweaked_nrgxs, tweaked_globalxs, inbox, year)
        trajectory.append(round(float(tweaked_globalxs[CO2_M_MT]), 6))
    return trajectory


def test_initial_is_both_the_start_and_the_annual_step():
    # $50 in year one, then +$50 each year, stopping at the $500 ceiling.
    assert price_trajectory(50, 500, years=12) == [
        50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 500, 500
    ]


def test_yearly_is_a_ceiling_so_a_low_one_never_rises():
    # The exact shape of the shipped-and-broken preset: reading `yearly` as a
    # per-year delta gives "climbs $10/yr"; the engine gives a flat $50.
    assert price_trajectory(50, 10, years=6) == [50, 50, 50, 50, 50, 50]


def test_a_zero_ceiling_holds_the_initial_price_flat():
    # How the flat-price presets and most library cases are expressed.
    assert price_trajectory(100, 0, years=5) == [100, 100, 100, 100, 100]
    assert price_trajectory(0, 0, years=5) == [0, 0, 0, 0, 0]


def test_library_increasing_co2_shape_rises():
    # The Increasing_CO2 library group uses initial=10, yearly=200, which does
    # ramp -- confirming the bug was in the web preset, not in the library.
    assert price_trajectory(10, 200, years=6) == [10, 20, 30, 40, 50, 60]


# ScenarioConfig caps years at 50, so these ceilings are all reachable within
# the horizon the engine will actually accept.
@pytest.mark.parametrize('initial,ceiling', [(50, 500), (10, 200), (25, 100)])
def test_a_ramp_never_overshoots_its_ceiling(initial, ceiling):
    # The guard is `<`, so the last step can land above the ceiling; what must
    # hold is that it stops there rather than climbing forever.
    trajectory = price_trajectory(initial, ceiling, years=50)
    assert trajectory[-1] == trajectory[-2], 'price never settled'
    assert trajectory[-1] <= ceiling + initial
    assert trajectory == sorted(trajectory), 'price must be non-decreasing'
