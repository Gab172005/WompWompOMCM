"""Reproduce the synthetic appointment-rate demonstration model offline.

Run from backend: .venv/bin/python scripts/train_demand_model.py
No patient data, HNI labels, geographic IDs, runtime fitting or network calls.
"""
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import xgboost as xgb

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.demand_model import FEATURES, MODEL_DIR, MODEL_NAME


def observations(seed, count):
    rng = np.random.default_rng(seed)
    values = rng.uniform([0, 5, 0, 0, 0], [200, 65, 100, 100, 120], size=(count, 5))
    disease, vulnerable, poverty, flood, access = values.T
    # Deliberately simulated appointment rates, independent of the HNI formula.
    rate = (12 + .07 * disease + .11 * vulnerable + .04 * poverty
            + .025 * flood + .035 * access + .0006 * disease * vulnerable
            + rng.normal(0, .6, count))
    return values, np.clip(rate, 0, 1000)


def train(output=MODEL_DIR):
    datasets = [observations(seed, count) for seed, count in [(42, 3200), (43, 800), (44, 800)]]
    matrices = [xgb.DMatrix(x, label=y, feature_names=FEATURES, nthread=1) for x, y in datasets]
    params = dict(objective="reg:squarederror", eval_metric="rmse", tree_method="hist",
                  max_depth=3, eta=.08, seed=42, nthread=1, monotone_constraints="(1,1,1,1,1)")
    booster = xgb.train(params, matrices[0], num_boost_round=300,
                        evals=[(matrices[1], "validation")], early_stopping_rounds=20, verbose_eval=False)
    booster = booster[:booster.best_iteration + 1]
    target = datasets[2][1]
    predictions = booster.predict(matrices[2])
    baseline = float(np.mean(datasets[0][1]))
    metrics = dict(test_mae=float(np.mean(np.abs(predictions - target))),
                   test_rmse=float(np.sqrt(np.mean((predictions - target) ** 2))),
                   mean_rate_baseline_mae=float(np.mean(np.abs(baseline - target))),
                   mean_rate_baseline_rmse=float(np.sqrt(np.mean((baseline - target) ** 2))))
    output.mkdir(parents=True, exist_ok=True)
    model_path = output / f"{MODEL_NAME}.json"
    booster.save_model(model_path)
    manifest = dict(model_id=MODEL_NAME, synthetic=True, target="daily_appointments_per_1000",
                    features=FEATURES, xgboost_version=xgb.__version__, params=params,
                    training_rows=3200, validation_rows=800, test_rows=800,
                    split="Independent synthetic observations from disjoint RNG streams: 42/43/44; test never used for tuning.",
                    generator="backend/scripts/train_demand_model.py:observations; hand-designed synthetic process, not observed healthcare outcomes",
                    limitations="Synthetic-only demonstration; these errors do not measure clinical or real-world accuracy. No HNI distillation or patient records.",
                    boosting_rounds=booster.num_boosted_rounds(), metrics=metrics,
                    model_sha256=hashlib.sha256(model_path.read_bytes()).hexdigest())
    (output / f"{MODEL_NAME}.metadata.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
