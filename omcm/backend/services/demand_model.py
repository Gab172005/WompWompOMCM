"""Offline-trained synthetic demand estimation; never a clinical prediction."""
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path

import numpy as np

MODEL_DIR = Path(__file__).resolve().parents[1] / "data/models"
MODEL_NAME = "appointment-demand-v1"
FEATURES = ["disease_per_1000", "vulnerable_pct", "poverty_pct", "flood_exposure", "hospital_minutes"]


class ModelUnavailable(RuntimeError):
    """The required model must not be replaced by a silent heuristic fallback."""


@lru_cache(maxsize=1)
def load_model():
    try:
        import xgboost as xgb
        model_path = MODEL_DIR / f"{MODEL_NAME}.json"
        manifest = json.loads((MODEL_DIR / f"{MODEL_NAME}.metadata.json").read_text())
        if manifest["features"] != FEATURES or not manifest["synthetic"]:
            raise ValueError("Unexpected demand model feature contract.")
        if hashlib.sha256(model_path.read_bytes()).hexdigest() != manifest["model_sha256"]:
            raise ValueError("Demand model checksum mismatch.")
        booster = xgb.Booster({"nthread": 1})
        booster.load_model(model_path)
        if booster.feature_names != FEATURES:
            raise ValueError("Demand model features do not match runtime inputs.")
        return booster, manifest
    except (ImportError, OSError, ValueError, KeyError) as error:
        raise ModelUnavailable("XGBoost demand model unavailable. Install backend requirements and regenerate the documented model artifact.") from error


def estimate_demands(barangays, request):
    """Use baseline features, then apply the existing explicit outbreak multiplier.

    Scores and contributions remain the transparent pilot index. Model estimates
    replace only appointment demand, shared by the optimized and baseline plans.
    """
    booster, manifest = load_model()
    import xgboost as xgb
    multipliers, features = [], []
    for barangay in barangays:
        multiplier = request.municipality_outbreak_multipliers.get(
            barangay.get("municipality"),
            request.outbreak_multiplier if barangay["id"] in request.outbreak_barangays else 1,
        )
        multipliers.append(multiplier)
        features.append([
            barangay["disease_per_1000"] / multiplier,
            barangay["vulnerable_residents"] / barangay["population"] * 100,
            barangay["factors"]["poverty"],
            barangay["factors"]["flood"],
            barangay["hospital_minutes"] if barangay["hospital_minutes"] is not None else 120,
        ])
    if features:
        matrix = xgb.DMatrix(np.asarray(features), feature_names=FEATURES, nthread=1)
        rates = booster.predict(matrix)
        if not np.isfinite(rates).all():
            raise ModelUnavailable("XGBoost returned invalid appointment demand.")
        for barangay, rate, multiplier in zip(barangays, rates, multipliers):
            baseline = max(1, math.floor(barangay["population"] * float(np.clip(rate, 0, 1000)) / 1000 + .5))
            barangay["demand"] = min(barangay["population"], math.floor(baseline * multiplier + .5))
            barangay["warnings"].append(f"{MODEL_NAME}: XGBoost appointment-demand estimate trained only on synthetic observations; not clinical validation.")
    return manifest
