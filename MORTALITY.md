# Mortality externality (preview feature)

**Status: experimental, preview-only.** This lives on
`feat/mortality-externality` and must not be merged to production. A preview
banner and a robots disallow-all are gated on `VERCEL_ENV !== "production"` so
nothing here can surface on the published site.

Optimize already prices one externality — CO₂. This feature adds a second —
mortality — on the observation that a carbon price and a mortality price are
the same kind of object: both attach a dollar figure to a harm the market
doesn't charge for and let the optimizer respond. So mortality is one more
coefficient, one more slider, one more linear term next to the CO₂ machinery.

## Where the numbers come from

Coefficients are imported verbatim from the sibling site **Level**
(`levelmodel.vercel.app`), the descriptive source of truth. They are **not
re-derived** here.

- Canonical: `engine/data/mortality.json` (sits with `Specs.csv`, where the
  death math consumes it; mirrors Level's `sources.json` structure exactly).
- Web mirror: `web/data/mortality.json` (Vercel only deploys `web/`, so the UI
  can't import across the repo root). `engine/tests/test_mortality_web_mirror.py`
  asserts the two stay byte-reconcilable.
- Every coefficient keeps its `source` id and links back to its Level source
  page in the UI. Optimize is not a second source of truth for these numbers.

## How it prices mortality

The objective mirrors the CO₂ term exactly. Per source, per year:

```
cost += MWh × deaths_intensity × mortality_price      # M$
```

where `deaths_intensity = deaths_per_TWh / 1e12` (the two 1e6 factors:
deaths/TWh → deaths/MWh, and $ → M$, so the product lands in M$/MWh just like
`CO2_MT_MWh × CO2_M_MT`). The term is added in both places CO₂ is priced —
`core.fig_cost` (what gets built) and `core.update_data`'s merit order (what
runs each hour). At `mortality_price = 0` it adds exactly `0.0`, so the model
is bit-for-bit unchanged (guarded by `test_zero_mortality_price_matches_golden`).

`mortality_price.initial` is $/death; `mortality_price.yearly` is a
multiplicative VSL escalation (HHS's ~1.1%/yr real growth), 1.0 = flat.

### VSL

HHS's 2026 guidance publishes a **range**, not a point: $6.6M / $14.1M / $21.5M
(constant 2025 dollars), used as slider presets. Presented as published values,
never as endorsement.

## Technology mapping

Optimize dispatches six technologies. Solar/Wind/Nuclear/Gas/Coal map to their
Level coefficients. **Battery carries no direct coefficient** — its harm is
embodied in the electricity it stores; a rate of its own would double-count.
`oil` and `hydro` exist in the data for reconcilability with Level's national
model but are never dispatched by Optimize.

## Regional accounting — production-based only (consumption descoped)

The prompt's §2.3 asked for two parallel accounts (production-based and
consumption-based, the difference being imported/exported mortality). **Only
production-based is implemented.** This engine solves each of the 13 regions
*independently* — a `region="US"` run is a sequential loop with **no
inter-regional transfer matrix** — so there is no hourly interchange to
allocate consumption-based deaths through. Production-based deaths (attributed
to the generating region) are reported per region; consumption-based
attribution and the imported/exported-mortality headline are deferred until a
real interchange dataset (e.g. EIA-930) is wired in. This is an accounting
attribution, not an atmospheric model.

## Known preview limitation

Custom runs submitted from the preview site are drained by the production
GitHub Actions worker, which runs the engine from the default branch — so live
preview runs won't yet carry the engine's mortality changes. The results page
therefore computes production-based deaths **client-side** from the returned
per-source generation and the mirrored coefficients (a pure function of
generation, matching the engine), so the Mortality section works regardless.

## Tests

- `test_mortality.py` — coefficients vs published figures, technology mapping,
  the TWh/MWh conversion (magnitude and direction), counted/modeled split.
- `test_golden_parity.py::test_zero_mortality_price_matches_golden` — zero
  price reproduces the original engine bit-for-bit.
- `test_mortality_objective.py` — monotonicity (higher price → fewer deaths),
  ordering (coal exits before gas), divergence (carbon-only vs mortality-only
  disagree most on gas).
- `test_mortality_web_mirror.py` — engine/web coefficient files stay identical.
