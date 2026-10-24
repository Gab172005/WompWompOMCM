"""Transient simulation contracts; these never create publishable deployments."""
from typing import Annotated, Literal

from pydantic import Field

from .municipality import StrictModel


class HniConditions(StrictModel):
    floodOverrides: dict[str, Literal["none", "moderate", "severe"]] = Field(default_factory=dict)
    morbiditySpikes: dict[str, Annotated[float, Field(ge=1, le=5, allow_inf_nan=False)]] = Field(default_factory=dict)
    closedRoadIds: list[str] = Field(default_factory=list, max_length=100)


class HniAssignment(StrictModel):
    clinicId: str = Field(pattern=r"^MC-(?:[1-9]|10)$")
    psgc: str = Field(min_length=1, max_length=20)


class HniEvaluationRequest(StrictModel):
    clinic_count: int = Field(3, ge=1, le=10)
    conditions: HniConditions = Field(default_factory=HniConditions)
    history: dict[Annotated[int, Field(ge=1, le=30)], list[HniAssignment]] = Field(default_factory=dict, max_length=4)


class HniOptimizationRequest(HniEvaluationRequest):
    day: int = Field(1, ge=1, le=30)
    comparison_sites: list[str] = Field(default_factory=list, max_length=10)


class HniImpact(StrictModel):
    scenarioHni: float = Field(ge=0, le=100)
    serviceFraction: float = Field(ge=0, le=.35)


class HniMetrics(StrictModel):
    baselineHni: float
    hni: float
    uhni: float
    totalUnmetPriority: float
    servedBarangays: int
    coveredPercent: float
    relocations: int
    cumulativeUnmetPriority: float
    servedAppointments: float
    totalAppointments: int
    capacityUtilization: float
    reachedPopulation: int


class HniDayResult(StrictModel):
    day: int
    impacts: dict[str, HniImpact]
    metrics: HniMetrics


class HniEvaluationResult(StrictModel):
    days: list[HniDayResult]
    notes: list[str]


class HniOptimizationResult(StrictModel):
    proposal_id: str
    day: int
    locations: list[HniAssignment]
    evaluation: HniEvaluationResult
    solver_status: str
    optimal: bool
    comparison_hni: float | None
    notes: list[str]
