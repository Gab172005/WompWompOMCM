"""Native next-day illness forecasts from dated, explicitly synthetic histories."""
from datetime import timedelta
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path

import numpy as np

from config import today
from services.forecast_history import FEATURES, EPOCH, feature_row, history, profile

MODEL_DIR = Path(__file__).resolve().parents[1] / "data/models"
MODEL_NAME = "illness-forecast-v2"
DEMAND_MODEL_NAME = "appointment-demand-v1"
DEMAND_FEATURES = ["disease_per_1000", "vulnerable_pct", "poverty_pct", "flood_exposure", "hospital_minutes"]
TARGET_PREFIX = "Forecast target date: "


class ModelUnavailable(RuntimeError):
    """Required models never fall back to an invented allocation."""


@lru_cache(maxsize=1)
def load_model():
    try:
        import xgboost as xgb
        path = MODEL_DIR / f"{MODEL_NAME}.json"
        metadata = json.loads((MODEL_DIR / f"{MODEL_NAME}.metadata.json").read_text())
        if metadata["features"] != FEATURES or metadata["target"] != "next_day_case_rate_per_1000" or not metadata["synthetic"]:
            raise ValueError("Unexpected illness forecast feature/target contract.")
        if hashlib.sha256(path.read_bytes()).hexdigest() != metadata["model_sha256"]:
            raise ValueError("Illness model checksum mismatch.")
        booster = xgb.Booster({"nthread": 1})
        booster.load_model(path)
        if booster.feature_names != FEATURES:
            raise ValueError("Model feature order does not match inference.")
        return booster, metadata
    except (ImportError, OSError, ValueError, KeyError) as error:
        raise ModelUnavailable("XGBoost illness forecast unavailable. Install backend requirements and regenerate the documented artifact.") from error


@lru_cache(maxsize=256)
def dated_history(identity, base_rate, flood, issue):
    return history(identity, base_rate, flood, issue)


@lru_cache(maxsize=1)
def load_demand_model():
    """Keep the existing trained demand model unchanged, not a new rate policy."""
    try:
        import xgboost as xgb
        path = MODEL_DIR / f"{DEMAND_MODEL_NAME}.json"
        metadata = json.loads((MODEL_DIR / f"{DEMAND_MODEL_NAME}.metadata.json").read_text())
        if metadata["features"] != DEMAND_FEATURES or not metadata["synthetic"]:
            raise ValueError("Unexpected appointment demand features.")
        if hashlib.sha256(path.read_bytes()).hexdigest() != metadata["model_sha256"]:
            raise ValueError("Appointment model checksum mismatch.")
        booster = xgb.Booster({"nthread": 1})
        booster.load_model(path)
        if booster.feature_names != DEMAND_FEATURES:
            raise ValueError("Appointment feature order mismatch.")
        return booster, metadata
    except (ImportError, OSError, ValueError, KeyError) as error:
        raise ModelUnavailable("XGBoost appointment-demand model unavailable. Restore the existing validated artifact.") from error


def forecast_illness(frame):
    """Forecast tomorrow using only the history available on today's issue date."""
    booster, metadata = load_model()
    import xgboost as xgb
    issue = today()
    target = issue + timedelta(days=1)
    rows = frame.to_dict("records")
    histories, features = [], []
    for row in rows:
        series = dated_history(*profile(row), issue)
        histories.append(series)
        scenario_flood = row.get("scenario_flood_exposure", series["flood"])
        features.append(feature_row(series, (issue - EPOCH).days, scenario_flood))
    matrix = xgb.DMatrix(np.asarray(features), feature_names=FEATURES, nthread=1)
    rates = booster.predict(matrix)
    if not np.isfinite(rates).all():
        raise ModelUnavailable("XGBoost returned an invalid illness forecast.")
    predictions, burdens = {}, []
    for row, series, rate in zip(rows, histories, rates):
        rate = float(np.clip(rate, .01, 12))
        # Tomorrow's rolling 30-day burden: 29 known mock days + one forecast.
        burden = float(series["case_rate"][-29:].sum() + rate)
        predictions[row["id"]] = dict(next_day_case_rate=rate, rolling_burden=burden)
        burdens.append(max(0, math.floor(row["population"] * burden / 1000 + .5)))
    forecast_frame = frame.copy()
    forecast_frame["disease_cases"] = burdens
    context = dict(issue_date=issue.isoformat(), target_date=target.isoformat(), predictions=predictions)
    return forecast_frame, context


def estimate_demands(barangays, request, context=None):
    """Run the unchanged demand model on forecast illness inputs and surge controls."""
    _, metadata = load_model()
    if context is None:
        raise ModelUnavailable("Dated forecast context is required for appointment estimation.")
    booster, demand_metadata = load_demand_model()
    import xgboost as xgb
    features, multipliers = [], []
    for barangay in barangays:
        multiplier = request.municipality_outbreak_multipliers.get(
            barangay.get("municipality"),
            request.outbreak_multiplier if barangay["id"] in request.outbreak_barangays else 1,
        )
        multipliers.append(multiplier)
        features.append([barangay["disease_per_1000"] / multiplier,
                         barangay["vulnerable_residents"] / barangay["population"] * 100,
                         barangay["factors"]["poverty"], barangay["factors"]["flood"],
                         barangay["hospital_minutes"] if barangay["hospital_minutes"] is not None else 120])
    rates = booster.predict(xgb.DMatrix(np.asarray(features), feature_names=DEMAND_FEATURES, nthread=1))
    if not np.isfinite(rates).all():
        raise ModelUnavailable("XGBoost returned invalid appointment demand.")
    for barangay, rate, multiplier in zip(barangays, rates, multipliers):
        forecast = context["predictions"][barangay["id"]]
        base = max(1, math.floor(barangay["population"] * float(np.clip(rate, 0, 1000)) / 1000 + .5))
        barangay["demand"] = min(barangay["population"], math.floor(base * multiplier + .5))
        barangay["warnings"].append(
            f"{MODEL_NAME}: issue {context['issue_date']}, forecast {context['target_date']}; "
            f"{forecast['next_day_case_rate']:.3f} modeled daily cases/1,000 before surge. "
            "Illness/weather histories are synthetic, not observed patient or weather records."
        )
        if forecast["rolling_burden"] > 200:
            barangay["warnings"].append("Forecast burden exceeds the synthetic appointment model's training range; the estimate is provisional.")
    return dict(metadata, issue_date=context["issue_date"], target_date=context["target_date"],
                demand_model_id=demand_metadata["model_id"])
