"""Dated synthetic illness/weather histories, never patient or PAGASA records.

The source illness snapshot sets a simulation scale only. Dividing it by 30
does not assert that the source has an observed monthly reporting cadence.
Independent RNG streams keep every historical prefix stable as dates advance.
"""
from datetime import date, timedelta
import hashlib
import math

import numpy as np

EPOCH = date(2023, 1, 1)
FEATURES = ["case_rate_lag1", "case_rate_mean7", "case_rate_mean14",
            "case_rate_trend7", "rainfall_today_mm", "rainfall_mean7_mm",
            "rainfall_forecast_mm", "temperature_today_c", "flood_exposure",
            "season_sin", "season_cos"]


def finite(value, fallback):
    return float(value) if value is not None and math.isfinite(float(value)) else fallback


def profile(row):
    population = max(1, finite(row.get("population"), 1000))
    burden = finite(row.get("disease_cases"), population * .05) / population * 1000
    return (str(row["id"]), float(np.clip(burden / 30, .05, 5)),
            float(np.clip(finite(row.get("flood_exposure"), 50), 0, 100)))


def history(identity, base_rate, flood, through):
    """All rows end at through; neither cases nor observed weather look ahead."""
    count = (through - EPOCH).days + 1
    if count < 31:
        raise ValueError("Synthetic forecast requires at least 31 history days after 2023-01-01.")
    seed = int(hashlib.sha256(identity.encode()).hexdigest()[:8], 16)
    days = np.arange(count)
    seasonal = (1 + np.sin(2 * np.pi * (days - 120) / 365.25)) / 2
    rain = np.clip(2 + 9 * seasonal + np.random.default_rng(seed).gamma(2, 3, count), 0, 60)
    temperature = 27 + 1.5 * np.cos(2 * np.pi * days / 365.25) + np.random.default_rng(seed ^ 0x1357).normal(0, .4, count)
    noise = np.random.default_rng(seed ^ 0x2468).normal(0, .05, count)
    cases = np.empty(count)
    cases[0] = base_rate
    for day in range(1, count):
        mean_case = float(cases[max(0, day - 7):day].mean())
        mean_rain = float(rain[max(0, day - 7):day].mean())
        pressure = (.55 if mean_rain > 12 and flood > 60 else 0)
        pressure += .35 if rain[day - 1] > 18 and flood > 35 else 0
        cases[day] = np.clip(.55 * cases[day - 1] + .25 * mean_case + .2 * base_rate
                             + pressure + noise[day], .01, 12)
    return dict(case_rate=cases, rainfall=rain, temperature=temperature, flood=flood)


def feature_row(series, issue_index, flood=None):
    """Use observations up to issue_index and a forecast from known weather."""
    if issue_index < 29:
        raise ValueError("At least 30 days of history are required.")
    cases, rain = series["case_rate"], series["rainfall"]
    target_index = issue_index + 1
    seasonal = 2 * np.pi * target_index / 365.25
    # This mock weather forecast uses known rainfall and next-day seasonality,
    # never the actual next-day weather or outcome used as the training label.
    rain_forecast = .7 * rain[issue_index] + .3 * (8 + 9 * (1 + math.sin(seasonal - 2)) / 2)
    return [cases[issue_index], cases[issue_index - 6:issue_index + 1].mean(),
            cases[issue_index - 13:issue_index + 1].mean(),
            cases[issue_index - 6:issue_index + 1].mean() - cases[issue_index - 13:issue_index - 6].mean(),
            rain[issue_index], rain[issue_index - 6:issue_index + 1].mean(),
            rain_forecast, series["temperature"][issue_index],
            series["flood"] if flood is None else flood, math.sin(seasonal), math.cos(seasonal)]


def dated_observations(profiles, through):
    features, labels, targets = [], [], []
    for identity, base_rate, flood in profiles:
        series = history(identity, base_rate, flood, through)
        for issue in range(29, len(series["case_rate"]) - 1):
            features.append(feature_row(series, issue))
            labels.append(series["case_rate"][issue + 1])
            targets.append((EPOCH + timedelta(days=issue + 1)).isoformat())
    return np.asarray(features), np.asarray(labels), np.asarray(targets)
