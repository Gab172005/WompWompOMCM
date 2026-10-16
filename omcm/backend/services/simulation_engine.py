"""Compare disaster scenarios without changing approved deployments."""
from services.clinic_optimizer import optimize
from models.scenario import SimulationRequest


def simulate_scenario(request: SimulationRequest):
    before = optimize(request.original)
    after = optimize(request.scenario)
    previous = before["optimized"]["served_by_barangay"]
    updated = after["optimized"]["served_by_barangay"]
    changes = dict(
        previously_covered=before["optimized"]["metrics"]["residents_served"],
        newly_covered=sum(max(0, updated[key] - previous[key]) for key in previous),
        losing_coverage=sum(max(0, previous[key] - updated[key]) for key in previous),
        average_travel_delta=round(after["optimized"]["metrics"]["average_travel_minutes"] - before["optimized"]["metrics"]["average_travel_minutes"], 2),
        utilization_delta=round(after["optimized"]["metrics"]["capacity_utilization"] - before["optimized"]["metrics"]["capacity_utilization"], 2),
    )
    return dict(before=before, after=after, changes=changes,
                note="Coverage changes compare aggregate appointments within each source community, not identified individuals. Published schedules are unchanged.")
