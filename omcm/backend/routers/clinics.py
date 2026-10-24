"""Fleet data, schedule publication, authentication status and audit."""
from fastapi import APIRouter, Depends, HTTPException, Response
from config import today, require_admin, admin_configuration
from models.clinic import ApproveRequest, EmergencyRequest
from models.results import SchedulesResult, ScheduleResult
from services.data import load_data
from services import repository as repo
from services.deployment_rules import deployment_restricted
from services.demand_model import TARGET_PREFIX
router = APIRouter()


@router.get("/api/clinics")
def clinics(actor=Depends(require_admin)):
    _, network, metadata = load_data()
    sites = [dict(site, eligible=site["eligible"] and not deployment_restricted(site)) for site in network["sites"]]
    return dict(sites=sites, roads=network["roads"], metadata=metadata)


@router.get("/api/planning/clinics")
def provincial_clinics(actor=Depends(require_admin)):
    from services.provincial_planning import load_provincial_data
    _, network, metadata = load_provincial_data()
    return dict(sites=network["sites"], roads=network["roads"], metadata=metadata)


@router.get("/api/schedules", response_model=SchedulesResult)
def schedules(response: Response):
    response.headers["Cache-Control"] = "no-store"
    published = repo.schedules()
    # Public advisories identify the office, not the private login account.
    published["notices"] = [dict(notice, actor="LGU administrator") for notice in published["notices"]]
    return dict(**published, today=today().isoformat(), synthetic=True)


def approved_payload(request, emergency=False):
    if emergency:
        if request.deployment_date < today():
            raise HTTPException(422, "Past schedules cannot be overridden.")
    elif request.deployment_date <= today():
        raise HTTPException(422, "Ordinary approval is for tomorrow or later. Today's schedule requires a confirmed emergency override.")
    plan = repo.get_plan(request.plan_id)
    if plan is None:
        raise HTTPException(404, "Draft plan not found. Generate a placement first.")
    target = next((note[len(TARGET_PREFIX):] for note in plan.get("notes", []) if note.startswith(TARGET_PREFIX)), None)
    if not emergency and target and request.deployment_date.isoformat() != target:
        raise HTTPException(422, "This draft forecast is for " + target + ". Generate a fresh next-day plan before approving another schedule date.")
    if not plan["optimized"]["clinics"]:
        raise HTTPException(422, "Cannot publish an empty deployment.")
    return dict(date=request.deployment_date.isoformat(), plan_id=request.plan_id, status="Emergency revised" if emergency else "Approved",
                start_time=request.start_time, end_time=request.end_time, services=request.services,
                clinics=plan["optimized"]["clinics"], synthetic=True)


@router.post("/api/schedules/approve", response_model=ScheduleResult)
def approve(request: ApproveRequest, actor=Depends(require_admin)):
    try:
        return repo.publish(approved_payload(request), actor)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error


@router.post("/api/schedules/emergency-override", response_model=ScheduleResult)
def emergency(request: EmergencyRequest, actor=Depends(require_admin)):
    if not request.confirmed:
        raise HTTPException(422, "Explicit administrator confirmation is required for an emergency override.")
    return repo.publish(approved_payload(request, emergency=True), actor, request.notice)


@router.get("/api/audit")
def audit(actor=Depends(require_admin)):
    return dict(events=repo.audit_log())


@router.get("/api/health")
def health(response: Response):
    response.headers["Cache-Control"] = "no-store"
    configuration = admin_configuration()
    return dict(status="ok", synthetic=True, today=today().isoformat(), demo_auth=configuration["demo_auth_enabled"],
                storage=repo.storage_info(),
                admin_configured=configuration["configured"], admin_configuration=configuration)


@router.get("/api/auth/me")
def me(actor=Depends(require_admin)):
    return dict(username=actor, demo_only=True)
