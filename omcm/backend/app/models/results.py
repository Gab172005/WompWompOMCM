"""Public API response contracts shared by documentation and runtime validation."""
from typing import Literal, Annotated
from pydantic import BaseModel, Field
from app.models.schemas import PlacementRequest, Weights

Nonnegative = Annotated[int, Field(ge=0)]
Score = Annotated[float, Field(ge=0, le=100)]


class Metadata(BaseModel):
    synthetic: bool
    region: str
    generated_at: str
    source: str
    travel_times: str
    disease: str


class BarangayResult(BaseModel):
    id: str
    psgc: str | None = None
    municipality: str | None = None
    geography_level: Literal["barangay", "municipality"] | None = None
    name: str
    population: Annotated[int, Field(gt=0)]
    lat: float
    lng: float
    vulnerable_residents: Nonnegative
    children_pct: Score | None = None
    elderly_pct: Score | None = None
    disease_per_1000: float
    factors: dict[str, Score]
    contributions: dict[str, Score]
    score: Score
    level: Literal["Critical", "High", "Moderate", "Low"]
    demand: Nonnegative
    high_priority: bool
    nearest_hospital: str
    hospital_minutes: float | None
    explanation: str
    recommended_services: list[str]
    warnings: list[str]
    synthetic: bool
    rank: Annotated[int, Field(ge=1)]


class RiskResult(BaseModel):
    barangays: list[BarangayResult]
    metadata: Metadata
    weights: Weights | None = None


class SiteResult(BaseModel):
    facility_type: Literal["school", "barangay_hall", "health_center"] | None = None
    id: str
    barangay_id: str
    name: str
    capacity: Nonnegative
    eligible: bool
    lat: float
    lng: float


class AssignmentResult(BaseModel):
    barangay_id: str
    name: str
    residents: Nonnegative
    minutes: Nonnegative


class ClinicResult(SiteResult):
    daily_capacity: Annotated[int, Field(gt=0)]
    served: Nonnegative
    assignments: list[AssignmentResult]
    utilization: Score
    reason: str


class MetricsResult(BaseModel):
    # Optional for persisted drafts created before Build Step 3.
    unserved_population: Nonnegative | None = None
    residents_served: Nonnegative
    high_priority_reached: Nonnegative
    weighted_demand: Annotated[float, Field(ge=0)]
    total_demand: Nonnegative
    unserved_demand: Nonnegative
    average_travel_minutes: Annotated[float, Field(ge=0)]
    capacity_utilization: Score
    demand_served_pct: Score
    flood_safe_accessibility_pct: Score


class AllocationResult(BaseModel):
    clinics: list[ClinicResult]
    served_by_barangay: dict[str, Nonnegative]
    metrics: MetricsResult
    solver_status: str
    optimal: bool


class PlanResult(BaseModel):
    status: str = "draft"
    created_at: str | None = None
    plan_id: str | None = None
    optimized: AllocationResult
    baseline: AllocationResult
    improvement_pct: float | None
    barangays: list[BarangayResult]
    inputs: PlacementRequest
    metadata: Metadata
    notes: list[str]


class SimulationChanges(BaseModel):
    previously_covered: Nonnegative
    newly_covered: Nonnegative
    losing_coverage: Nonnegative
    average_travel_delta: float
    utilization_delta: float


class SimulationResult(BaseModel):
    before: PlanResult
    after: PlanResult
    changes: SimulationChanges
    note: str


class ScheduleResult(BaseModel):
    approved_at: str | None = None
    date: str
    plan_id: str
    status: Literal["Approved", "Emergency revised"]
    start_time: str
    end_time: str
    services: list[str]
    clinics: list[ClinicResult]
    synthetic: bool
    updated_at: str | None = None


class NoticeResult(BaseModel):
    id: str
    date: str
    text: str
    actor: str
    created_at: str


class SchedulesResult(BaseModel):
    schedules: list[ScheduleResult]
    notices: list[NoticeResult]
    today: str
    synthetic: bool


class AnalyticsResult(BaseModel):
    total_barangays: Nonnegative
    total_population: Nonnegative
    vulnerable_residents: Nonnegative
    total_demand: Nonnegative
    high_priority_demand: Nonnegative
    rankings: list[BarangayResult]
    metadata: Metadata
