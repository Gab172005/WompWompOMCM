"""Healthcare need scores and their contributing factors."""
import math
import numpy as np
from models.municipality import Weights

FACTORS = {"population": "population percentile", "disease": "elevated disease burden", "vulnerability": "a large vulnerable population",
           "accessibility": "limited hospital access", "poverty": "economic vulnerability", "flood": "flood exposure"}


def calculate_scores(frame, network, times, weights: Weights, outbreaks=(), multiplier=1, municipality_multipliers=None):
    output = []
    normalized_weights = weights.model_dump()
    total = sum(normalized_weights.values())
    for key in normalized_weights:
        normalized_weights[key] /= total
    # Average-rank percentile limits outlier population leverage; other inputs are rates.
    population_percentiles = frame["population"].rank(method="average", pct=True)
    population_by_id = dict(zip(frame["id"], population_percentiles))
    for row in frame.to_dict("records"):
        warnings = ["Synthetic demonstration estimates; not validated clinical indicators."]
        if row.get("geography_level") == "municipality":
            warnings.append("Estimated municipal indicators; not barangay observations.")

        def indicator(key, default):
            value = row.get(key)
            if value is None or (isinstance(value, (float, int)) and not math.isfinite(value)):
                warnings.append(f"Missing {key}; estimated conservative demo value used.")
                return default
            return value

        pop = int(row["population"])
        outbreak = (municipality_multipliers or {}).get(row.get("municipality"), multiplier if row["id"] in outbreaks else 1)
        disease_per_1000 = indicator("disease_cases", pop * .05) / pop * 1000 * outbreak
        vulnerable = min(pop, indicator("children", pop * .25) + indicator("elderly", pop * .10))
        reachable = [(times.get(row["id"], {}).get(h["barangay_id"], float("inf")), h["name"]) for h in network["hospitals"]]
        nearest_minutes, nearest_name = min(reachable)
        if "healthcare_access_time_minutes" in row:
            nearest_minutes = row["healthcare_access_time_minutes"]
            nearest_name = "Synthetic hospital-access indicator (no verified facility)"
        if row.get("scenario_flood"):
            row["flood_exposure"] = 100
        if "scenario_flood_exposure" in row:
            row["flood_exposure"] = row["scenario_flood_exposure"]
        raw = dict(population=population_by_id[row["id"]], disease=disease_per_1000 / 100, vulnerability=vulnerable / pop / .6,
                   accessibility=nearest_minutes / 60, poverty=indicator("poverty_pct", 50) / 100,
                   flood=indicator("flood_exposure", 50) / 100)
        factors = {key: round(float(np.clip(value, 0, 1)) * 100, 4) for key, value in raw.items()}
        contributions = {key: factors[key] * normalized_weights[key] for key in raw}
        score = round(sum(contributions.values()), 2)
        top = sorted(contributions, key=contributions.get, reverse=True)[:3]
        demand = min(pop, max(1, math.floor(pop * indicator("demand_rate", .03) * outbreak + .5)))
        services = ["Primary care", "Blood pressure screening", "Health education"]
        if factors["vulnerability"] >= 50:
            services += ["Child health", "Vaccination"]
        output.append(dict(id=row["id"], name=row["name"], population=pop,
                           lat=float(row["lat"]), lng=float(row["lng"]), vulnerable_residents=int(vulnerable),
                           children_pct=round(float(np.clip(indicator("children", pop*.25)/pop*100, 0, 100)), 2),
                           elderly_pct=round(float(np.clip(indicator("elderly", pop*.10)/pop*100, 0, 100)), 2),
                           disease_per_1000=round(disease_per_1000, 2), factors=factors,
                           contributions={k: round(v, 2) for k, v in contributions.items()}, score=score,
                           level="Critical" if score >= 70 else "High" if score >= 50 else "Moderate" if score >= 30 else "Low",
                           demand=demand, high_priority=score >= 50, nearest_hospital=nearest_name if math.isfinite(nearest_minutes) else "Unreachable in scenario",
                           hospital_minutes=nearest_minutes if math.isfinite(nearest_minutes) else None,
                           explanation=f"{row['name']} has {score:.0f}/100 illustrative need, driven by " + ", ".join(FACTORS[k] for k in top) + ".",
                           recommended_services=services, warnings=warnings, synthetic=True))
    output.sort(key=lambda b: (-b["score"], b["id"]))
    # Preserve optional stable geographic identifiers without changing scoring.
    geographic_fields = ("psgc", "municipality", "geography_level")
    rows_by_id = {row["id"]: row for row in frame.to_dict("records")}
    for barangay in output:
        row = rows_by_id[barangay["id"]]
        for field in geographic_fields:
            value = row.get(field)
            if value is not None and not (isinstance(value, float) and math.isnan(value)):
                barangay[field] = str(value)
    for i, barangay in enumerate(output):
        barangay["rank"] = i + 1
    return output


def sensitivity_check(scores, weights: Weights, top_k=3, delta=5):
    """One-at-a-time +/- weight-point perturbations, renormalized each time.

    Compare both membership and order, breaking rounded-score ties by stable ID
    exactly as calculate_scores does. K refers to barangay need, not clinic sites.
    """
    values = weights.model_dump()
    k = min(top_k, len(scores))
    baseline = [b["id"] for b in scores[:k]]
    trials = []
    for factor, weight in values.items():
        for direction in (-1, 1):
            adjusted = max(0, min(100, weight + direction * delta))
            if adjusted == weight:
                continue
            changed = {**values, factor: adjusted}
            total = sum(changed.values())
            if not total:
                continue
            ranked = sorted(scores, key=lambda b: (
                -round(sum(b["factors"][key] * value / total
                           for key, value in changed.items()), 2), b["id"]))
            ids = [b["id"] for b in ranked[:k]]
            trials.append(dict(factor=factor, change=adjusted-weight,
                               top_ids=ids, membership_changed=set(ids) != set(baseline),
                               order_changed=ids != baseline))
    return dict(top_k=k, delta=delta, baseline_ids=baseline, trials=trials,
                membership_stable=all(not t["membership_changed"] for t in trials),
                order_stable=all(not t["order_changed"] for t in trials))
