from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Weights(StrictModel):
    disease: float = Field(30, ge=0, le=100)
    vulnerability: float = Field(20, ge=0, le=100)
    accessibility: float = Field(20, ge=0, le=100)
    poverty: float = Field(15, ge=0, le=100)
    flood: float = Field(15, ge=0, le=100)

    @model_validator(mode="after")
    def nonzero(self):
        if sum(self.model_dump().values()) == 0:
            raise ValueError("At least one scoring weight must be positive.")
        return self


class PlacementRequest(StrictModel):
    clinic_count: int = Field(3, ge=0, le=10)
    capacity: int = Field(180, ge=1, le=5000)
    max_travel_minutes: int = Field(25, ge=0, le=120)
    weights: Weights = Field(default_factory=Weights)
    eligible_sites: list[str] | None = None
    flooded_sites: list[str] = Field(default_factory=list)
    closed_roads: list[str] = Field(default_factory=list)
    outbreak_barangays: list[str] = Field(default_factory=list)
    outbreak_multiplier: float = Field(1, ge=1, le=5)
    manual_sites: list[str] | None = None
    flood_level: Literal["none", "moderate", "severe"] = "none"


class SimulationRequest(StrictModel):
    original: PlacementRequest = Field(default_factory=PlacementRequest)
    scenario: PlacementRequest


class ApproveRequest(StrictModel):
    plan_id: str
    deployment_date: date
    start_time: str = Field("08:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    end_time: str = Field("17:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    services: list[Literal["Primary care", "Blood pressure screening", "Child health", "Vaccination", "Diabetes screening", "Health education"]] = Field(default_factory=lambda: ["Primary care", "Blood pressure screening", "Child health"], min_length=1)

    @model_validator(mode="after")
    def times(self):
        if self.start_time >= self.end_time:
            raise ValueError("End time must be later than start time.")
        return self


class EmergencyRequest(ApproveRequest):
    notice: str = Field(min_length=10, max_length=500)
    confirmed: bool = False


class BoundaryRequest(StrictModel):
    geojson: dict
