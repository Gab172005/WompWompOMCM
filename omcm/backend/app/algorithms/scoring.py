import math
import numpy as np
from app.models.schemas import Weights

FACTORS = {"disease": "elevated disease burden", "vulnerability": "a large vulnerable population",
           "accessibility": "limited hospital access", "poverty": "economic vulnerability", "flood": "flood exposure"}


def calculate_scores(frame, network, times, weights: Weights, outbreaks=(), multiplier=1):
    output = []
    normalized_weights = weights.model_dump()
    total = sum(normalized_weights.values())
    for key in normalized_weights:
        normalized_weights[key] /= total
    for row in frame.to_dict("records"):
        warnings = ["Synthetic demonstration estimates; not validated clinical indicators."]

        def indicator(key, default):
            value = row.get(key)
            if value is None or (isinstance(value, (float, int)) and not math.isfinite(value)):
                warnings.append(f"Missing {key}; conservative demo estimate used.")
                return default
            return value

        pop = int(row["population"])
        outbreak = multiplier if row["id"] in outbreaks else 1
        disease_per_1000 = indicator("disease_cases", pop * .05) / pop * 1000 * outbreak
        vulnerable = min(pop, indicator("children", pop * .25) + indicator("elderly", pop * .10))
        reachable = [(times.get(row["id"], {}).get(h["barangay_id"], float("inf")), h["name"]) for h in network["hospitals"]]
        nearest_minutes, nearest_name = min(reachable)
        if "healthcare_access_time_minutes" in row:
            nearest_minutes = row["healthcare_access_time_minutes"]
            nearest_name = "Synthetic hospital-access indicator (no verified facility)"
        if row.get("scenario_flood"):
            row["flood_exposure"] = 100
        raw = dict(disease=disease_per_1000 / 100, vulnerability=vulnerable / pop / .6,
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
