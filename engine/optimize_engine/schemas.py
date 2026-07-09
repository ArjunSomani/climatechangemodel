"""ScenarioConfig / ScenarioResult contracts (PRD §11.1, §11.4).

ScenarioConfig round-trips to the engine's internal "inbox" DataFrame shape
(rows indexed by parameter name, columns Text/Initial/Yearly) via
to_inbox_df(), which is the exact shape core.py's fig_tweakxs/init_tweakxs
expect. Building that DataFrame from a typed config (rather than reading
Inbox.csv) is the only thing that changes vs. the original — the row/column
names and semantics are unchanged.

Note: the source repo's checked-in Samples/Inbox.csv is stale relative to
Python/Optimize.py — it's missing `SubDir` and `MW_Mult` rows that the code
reads via `inbox.at[...]`. This schema reflects what the code actually
reads (verified by grepping every `inbox.at[` call), not the stale sample.
`Directory`/`Title`/`Molten_Rate` appear in the sample but are never read
by Optimize.py; they're carried here as optional cosmetic metadata only
(see PRD §15 open question #5 on Molten_Rate).
"""
from typing import Optional

import pandas as pd
from pydantic import BaseModel, Field

SOURCES = ['Solar', 'Wind', 'Nuclear', 'Gas', 'Coal', 'Battery']


class TweakPair(BaseModel):
    """Initial value + Yearly step/multiplier, per PRD §5.2.

    Semantics differ by field and are enforced by core.fig_tweakxs, not
    here: CO2_Price.yearly is an *additive* step toward a cap; Demand/
    Interest/MW_Mult/source tweaks are *multiplicative* year over year.
    """
    initial: float
    yearly: float = 1.0


class SourceTweaks(BaseModel):
    capital: TweakPair = Field(default_factory=lambda: TweakPair(initial=1, yearly=1))
    fixed: TweakPair = Field(default_factory=lambda: TweakPair(initial=1, yearly=1))
    variable: TweakPair = Field(default_factory=lambda: TweakPair(initial=1, yearly=1))
    lifetime: TweakPair = Field(default_factory=lambda: TweakPair(initial=1, yearly=1))
    max_pct: TweakPair = Field(default_factory=lambda: TweakPair(initial=1, yearly=1))


class ScenarioConfig(BaseModel):
    region: str  # one of Regions.csv's Abbr codes, or "US" for all regions
    sub_dir: Optional[str] = None  # output/case naming; auto-derived if omitted
    years: int = Field(gt=0, le=50)

    co2_price: TweakPair
    interest: TweakPair
    demand: TweakPair
    mw_mult: TweakPair = Field(default_factory=lambda: TweakPair(initial=1, yearly=1))

    sources: dict[str, SourceTweaks] = Field(
        default_factory=lambda: {s: SourceTweaks() for s in SOURCES})

    # Cosmetic only — not read by the engine (PRD §15 open question #5/#6).
    directory: Optional[str] = None
    title: Optional[str] = None

    def resolved_sub_dir(self) -> str:
        if self.sub_dir:
            return self.sub_dir
        if self.title:
            return self.title
        return f'{self.region}-run'

    def to_inbox_df(self) -> pd.DataFrame:
        """Build the row/Text/Initial/Yearly DataFrame core.py expects."""
        rows = {
            'Region': {'Text': self.region},
            'SubDir': {'Text': self.resolved_sub_dir()},
            'Years': {'Initial': self.years},
            'CO2_Price': {'Initial': self.co2_price.initial, 'Yearly': self.co2_price.yearly},
            'Interest': {'Initial': self.interest.initial, 'Yearly': self.interest.yearly},
            'Demand': {'Initial': self.demand.initial, 'Yearly': self.demand.yearly},
            'MW_Mult': {'Initial': self.mw_mult.initial, 'Yearly': self.mw_mult.yearly},
        }
        for source in SOURCES:
            tweaks = self.sources.get(source, SourceTweaks())
            rows[f'{source}_Capital'] = {'Initial': tweaks.capital.initial, 'Yearly': tweaks.capital.yearly}
            rows[f'{source}_Fixed'] = {'Initial': tweaks.fixed.initial, 'Yearly': tweaks.fixed.yearly}
            rows[f'{source}_Variable'] = {'Initial': tweaks.variable.initial, 'Yearly': tweaks.variable.yearly}
            rows[f'{source}_Lifetime'] = {'Initial': tweaks.lifetime.initial, 'Yearly': tweaks.lifetime.yearly}
            rows[f'{source}_Max_PCT'] = {'Initial': tweaks.max_pct.initial, 'Yearly': tweaks.max_pct.yearly}

        df = pd.DataFrame.from_dict(rows, orient='index', columns=['Text', 'Initial', 'Yearly'])
        return df


class RegionResult(BaseModel):
    region: str
    # Row-per-year records; each dict's keys are the output_matrix columns
    # (Year, CO2_M$_MT, Target_MWh, Outage_MWh, ..., {Source}_MW, ... per
    # PRD §11.4's param_order). Kept as loosely-typed records here since
    # the column set is generated dynamically from nrgs x param_order.
    years: list[dict]


class ScenarioResult(BaseModel):
    config: ScenarioConfig
    regions: list[RegionResult]
