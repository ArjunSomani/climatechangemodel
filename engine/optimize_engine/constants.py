"""Domain constants for the optimization engine.

Verbatim port of the constant definitions in the original Optimize.py
(cliffgold/Optimize, Python/Optimize.py). Index order and lookup tables
must not change: downstream numpy arrays are positional.
"""
import numpy as np
import pandas as pd

# energy (nrg) representations
nrgs = np.array(['Solar', 'Wind', 'Nuclear', 'Gas', 'Coal', 'Battery'])
nrg_sources = np.array(['Solar', 'Wind', 'Nuclear', 'Gas', 'Coal'])

# Energy type constants for numpy array access
Solarx = 0
Windx = 1
Nuclearx = 2
Gasx = 3
Coalx = 4
Batteryx = 5

nrg2nrgx_lu = {'Solar': Solarx, 'Wind': Windx, 'Nuclear': Nuclearx, 'Gas': Gasx, 'Coal': Coalx, 'Battery': Batteryx}
nrgx2nrg_lu = {Solarx: 'Solar', Windx: 'Wind', Nuclearx: 'Nuclear', Gasx: 'Gas', Coalx: 'Coal', Batteryx: 'Battery'}

nrgxs = np.array([Solarx, Windx, Nuclearx, Gasx, Coalx, Batteryx])
nrgx_sources = np.array([Solarx, Windx, Nuclearx, Gasx, Coalx])

# Specs CSV row constants for numpy array access
Capital_Total_M_MW = 0  # Total overnight cost of construction
Fixed_M_MW = 1
Variable_M_MWh = 2
CO2_MT_MWh = 3
Lifetime = 4
Max_PCT = 5
Efficiency = 6  # Round-trip for battery
Hours = 7  # hours of battery at rated MW (usually 4)
# Only used in tweakxs
Capital_M_MW = 8  # 1 year cost of financing

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

spec2specx_lu = {v: k for k, v in specx2spec_lu.items()}

specxs = np.array([
    Capital_Total_M_MW,
    Fixed_M_MW,
    Variable_M_MWh,
    CO2_MT_MWh,
    Lifetime,
    Max_PCT,
    Efficiency,
    Hours,
])

tweakxs = np.array([
    Capital_Total_M_MW,
    Fixed_M_MW,
    Variable_M_MWh,
    CO2_MT_MWh,
    Lifetime,
    Max_PCT,
    Efficiency,
    Hours,
    Capital_M_MW,
])

# tweaked_globalxs array constants for numpy array access
CO2_M_MT = 0
Demand = 1
Interest = 2
MW_Mult = 3

# Output Matrix Columns
output_header = pd.Series(['Year', 'CO2_M$_MT', 'Target_MWh', 'Outage_MWh',
                            'Outage_M$_MWh', 'Iterations'])

param_order = pd.Series(['MW', 'MWh', 'Capital_M$', 'Fixed_M$',
                          'Variable_M$', 'CO2_M$', 'CO2_MT',
                          'Start_Knob', 'Optimized_Knob', 'PCT_Max_Add',
                          'Cap_Factor'])

# Per-source tweak fields carried in ScenarioConfig (Initial/Yearly each)
SOURCE_TWEAK_FIELDS = ['capital', 'fixed', 'variable', 'lifetime', 'max_pct']

# delete_chars for np.genfromtxt on Regions.csv (BOM + punctuation seen in the source file)
delete_chars = " !#$%&'()*+, -./:;<=>?@[\\]^{|}~﻿ï»¿"
