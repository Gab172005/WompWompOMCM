"""Train a dated, next-day synthetic illness forecast with chronological evaluation."""
import hashlib
import json
from datetime import date
from pathlib import Path
import sys

import numpy as np
import xgboost as xgb

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.demand_model import MODEL_DIR, MODEL_NAME
from services.forecast_history import FEATURES, dated_observations


def train(output=MODEL_DIR):
    # Independent fictional profiles; identities are RNG seeds, never model features.
    profiles = [(f"synthetic-training-{i}", .2 + (i % 12) * .35, (i * 17) % 101) for i in range(32)]
    values, target, dates = dated_observations(profiles, date(2024, 12, 31))
    train_mask = dates < "2024-07-01"
    validation_mask = (dates >= "2024-07-01") & (dates < "2024-10-01")
    test_mask = dates >= "2024-10-01"
    masks = [train_mask, validation_mask, test_mask]
    matrices = [xgb.DMatrix(values[mask], label=target[mask], feature_names=FEATURES, nthread=1) for mask in masks]
    params = dict(objective="reg:squarederror", eval_metric="rmse", tree_method="hist",
                  max_depth=4, eta=.05, seed=42, nthread=1)
    booster = xgb.train(params, matrices[0], num_boost_round=500,
                        evals=[(matrices[1], "validation")], early_stopping_rounds=30, verbose_eval=False)
    booster = booster[:booster.best_iteration + 1]
    predictions = booster.predict(matrices[2])
    y = target[test_mask]
    # All baselines use only the information available at the issue time.
    linear = np.linalg.lstsq(np.c_[np.ones(train_mask.sum()), values[train_mask]], target[train_mask], rcond=None)[0]
    baselines = dict(persistence=values[test_mask, 0], rolling7=values[test_mask, 1],
                     linear=np.c_[np.ones(test_mask.sum()), values[test_mask]] @ linear)
    metrics = dict(test_mae=float(np.abs(predictions-y).mean()),
                   test_rmse=float(np.sqrt(((predictions-y)**2).mean())))
    for name, estimate in baselines.items():
        metrics[f"{name}_mae"] = float(np.abs(estimate-y).mean())
        metrics[f"{name}_rmse"] = float(np.sqrt(((estimate-y)**2).mean()))
    output.mkdir(parents=True, exist_ok=True)
    path = output / f"{MODEL_NAME}.json"
    booster.save_model(path)
    periods = {}
    for name, mask in zip(["train", "validation", "test"], masks):
        periods[name] = dict(first_target=str(min(dates[mask])), last_target=str(max(dates[mask])), rows=int(mask.sum()))
    manifest = dict(model_id=MODEL_NAME, synthetic=True, target="next_day_case_rate_per_1000",
                    features=FEATURES, xgboost_version=xgb.__version__, params=params,
                    boosting_rounds=booster.num_boosted_rounds(), periods=periods,
                    training_rows=int(train_mask.sum()), validation_rows=int(validation_mask.sum()), test_rows=int(test_mask.sum()),
                    metrics=metrics, model_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                    generator="services/forecast_history.py; dated fictional illness and weather sequences, seeded per profile",
                    split="Chronological target dates: train before July 2024, validation July-September, untouched test October-December. No randomized row split.",
                    limitations="Synthetic-only demonstration. Errors do not measure clinical or real-world accuracy; no disease-specific diagnosis or observed PAGASA/patient data.",
                    history_policy="Features end at the issue day. Weather forecast uses past rain and calendar only. Histories retain identical prefixes when future days are appended.",
                    demand_conversion="The existing appointment-demand-v1 model estimates appointments using forecast illness burden; its artifact and agreed scoring weights are unchanged.")
    (output / f"{MODEL_NAME}.metadata.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
