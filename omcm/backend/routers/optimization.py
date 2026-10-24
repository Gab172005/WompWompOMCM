"""Authenticated draft generation."""
from fastapi import APIRouter, Depends, HTTPException
from config import require_admin
from models.clinic import PlacementRequest
from models.results import PlanResult
from services.clinic_optimizer import optimize
from services import repository as repo
from services.demand_model import ModelUnavailable
router = APIRouter()


def run_optimization(request, provincial=False):
    try:
        return optimize(request, provincial=provincial)
    except ModelUnavailable as error:
        raise HTTPException(503, str(error)) from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post("/api/optimize", response_model=PlanResult)
def placement(request: PlacementRequest, actor=Depends(require_admin)):
    result = run_optimization(request)
    result["plan_id"] = repo.save_plan(result)
    return result


@router.post("/api/planning/optimize", response_model=PlanResult)
def provincial_placement(request: PlacementRequest, actor=Depends(require_admin)):
    result = run_optimization(request, provincial=True)
    result["plan_id"] = repo.save_plan(result)
    return result
