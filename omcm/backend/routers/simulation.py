"""Scenario comparison without changing published schedules."""
from fastapi import APIRouter, Depends, HTTPException
from config import require_admin
from models.scenario import SimulationRequest
from models.results import SimulationResult
from services.simulation_engine import simulate_scenario
from models.hni_simulation import (
    HniEvaluationRequest, HniEvaluationResult, HniOptimizationRequest, HniOptimizationResult,
)
from services.hni_simulation import evaluate_simulation, optimize_simulation
from services.demand_model import ModelUnavailable
router = APIRouter()


@router.post("/api/simulate", response_model=SimulationResult)
def simulate(request: SimulationRequest, actor=Depends(require_admin)):
    try:
        return simulate_scenario(request)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


def run_hni_simulation(operation, request):
    try:
        return operation(request)
    except ModelUnavailable as error:
        raise HTTPException(503, str(error)) from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post("/api/planning/simulation/evaluate", response_model=HniEvaluationResult)
def evaluate_hni(request: HniEvaluationRequest, actor=Depends(require_admin)):
    return run_hni_simulation(evaluate_simulation, request)


@router.post("/api/planning/simulation/optimize", response_model=HniOptimizationResult)
def optimize_hni(request: HniOptimizationRequest, actor=Depends(require_admin)):
    return run_hni_simulation(optimize_simulation, request)
