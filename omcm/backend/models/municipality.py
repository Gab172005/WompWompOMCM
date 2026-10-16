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

class BoundaryRequest(StrictModel):
    geojson: dict
