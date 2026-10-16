"""Scenario comparison without changing published schedules."""
from fastapi import APIRouter, Depends, HTTPException
from config import require_admin
from models.scenario import SimulationRequest
from models.results import SimulationResult
from services.simulation_engine import simulate_scenario
router = APIRouter()


@router.post("/api/simulate", response_model=SimulationResult)
def simulate(request: SimulationRequest, actor=Depends(require_admin)):
    try:
        return simulate_scenario(request)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
