"""Authenticated draft generation."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from config import require_admin
from models.clinic import PlacementRequest
from models.results import PlanResult
from services.clinic_optimizer import optimize
from services import repository as repo
from services.demand_model import ModelUnavailable
router = APIRouter()


@router.get("/api/planning/plans")
def saved_plans(response: Response, limit: int = Query(20, ge=1, le=50),
                offset: int = Query(0, ge=0), actor=Depends(require_admin)):
    response.headers["Cache-Control"] = "no-store"
    return repo.list_plans(limit, offset)


@router.get("/api/planning/plans/{plan_id}", response_model=PlanResult)
def saved_plan(plan_id: str, response: Response, actor=Depends(require_admin)):
    response.headers["Cache-Control"] = "no-store"
    plan = repo.get_plan(plan_id)
    if plan is None:
        raise HTTPException(404, "Saved plan not found. Refresh your saved work or generate a new plan.")
    return dict(plan, plan_id=plan_id)


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
