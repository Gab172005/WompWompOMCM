from pydantic import Field
from .municipality import StrictModel
from .clinic import PlacementRequest

class SimulationRequest(StrictModel):
    original: PlacementRequest = Field(default_factory=PlacementRequest)
    scenario: PlacementRequest
