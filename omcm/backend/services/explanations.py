"""Read-only explanations. Providers receive model evidence, never planning tools."""
import os
from typing import Protocol

FOOTER = "Decision-support only. Final deployment is decided by LGU health officers."
LABELS = {
    "population": "represented population", "disease": "sample illness rate",
    "vulnerability": "children and elderly share", "accessibility": "hospital access difficulty",
    "poverty": "poverty", "flood": "flood exposure",
}


class ExplanationProvider(Protocol):
    def explain(self, evidence: dict) -> str: ...


class DeterministicProvider:
    def explain(self, evidence: dict) -> str:
        before, after = evidence["before"], evidence["after"]
        allocation = after["optimized"]
        metrics = allocation["metrics"]
        rows = {b["id"]: b for b in after["barangays"]}
        lines = ["Explanation based on the sample plan. These are estimates, not confirmed healthcare outcomes.",
                 "The system suggests locations that could offer more appointments in areas with higher estimated need. It considers the number of clinics, appointment capacity, travel limits and sample road and flood restrictions. A factor that raises a need score does not alone explain a clinic location."]
        for clinic in allocation["clinics"]:
            lines.append(f"{clinic['name']}: {clinic['reason']}")
            for assignment in clinic["assignments"]:
                barangay = rows[assignment["barangay_id"]]
                factors = sorted(barangay["contributions"].items(), key=lambda item: (-item[1], item[0]))[:3]
                top = ", ".join(f"{LABELS.get(key, key)} ({value:.1f} score points)" for key, value in factors)
                lines.append(f"For {barangay['name']}, the factors adding the most points to the need score are {top}. This site allocates {assignment['residents']} appointments with a estimated sample journey of {assignment['minutes']} minutes.")
            lines.append(f"Appointments available: {clinic['served']} of {clinic['daily_capacity']} daily appointments allocated ({clinic['utilization']}% of available slots filled). Selecting this hub uses one of the available clinics; the model does not guarantee the shortest trip for every community.")
        if not allocation["clinics"]:
            lines.append("No clinic was allocated under these inputs. There is no chosen site to explain.")
        lines.append(f"Estimated results: {metrics['residents_served']} appointments served; {metrics['unserved_demand']} daily appointments remain unserved. Average modeled travel is {metrics['average_travel_minutes']} minutes. The population-first baseline serves {after['baseline']['metrics']['residents_served']} appointments under the same restrictions.")
        if after["inputs"].get("manual_sites") is not None:
            lines.append("The staging sites were manually selected by the planner; the optimizer allocated appointments subject to its constraints.")
        lines.extend(evidence["exclusions"])
        if before["inputs"] == after["inputs"]:
            lines.append("No scenario parameter changed; no scenario difference is claimed.")
        else:
            changed = [key.replace("_", " ") for key in after["inputs"] if before["inputs"].get(key) != after["inputs"][key]]
            lines.append("Changed scenario parameters: " + ", ".join(changed) + ".")
            old = {c["id"]: c["name"] for c in before["optimized"]["clinics"]}
            new = {c["id"]: c["name"] for c in allocation["clinics"]}
            lines.append("Added sites: " + (", ".join(new[k] for k in sorted(new.keys() - old.keys())) or "none") + ". Removed sites: " + (", ".join(old[k] for k in sorted(old.keys() - new.keys())) or "none") + ".")
            for key, label in [("residents_served", "daily appointments served"), ("unserved_demand", "unserved daily appointments"), ("average_travel_minutes", "average modeled travel minutes")]:
                lines.append(f"{label.capitalize()}: {before['optimized']['metrics'][key]} before → {metrics[key]} after.")
            lines.append("Changes compare aggregate appointments, not identified patients. When several inputs change, this comparison cannot isolate the effect of each one.")
        lines.extend(["Flood exclusions and route availability use synthetic fixture evidence, not field safety certification. Unsupported diversions are never assumed.",
                      f"Solver status: {allocation['solver_status']}. " + ("Optimal for this modeled objective." if allocation["optimal"] else "Feasible result; optimality is not proven."),
                      "This explanation does not change drafts or published schedules.", FOOTER])
        return "\n\n".join(lines)


def get_provider() -> ExplanationProvider:
    provider = os.getenv("OMCM_EXPLANATION_PROVIDER", "deterministic")
    if provider != "deterministic":
        raise ValueError("Unsupported explanation provider. Configure OMCM_EXPLANATION_PROVIDER=deterministic.")
    return DeterministicProvider()
