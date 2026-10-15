import os
import secrets
import math
from datetime import datetime, timedelta, timezone, date
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from app.models.schemas import Weights, PlacementRequest, SimulationRequest, ApproveRequest, EmergencyRequest, BoundaryRequest
from app.models.results import RiskResult, PlanResult, SimulationResult, AnalyticsResult, SchedulesResult, ScheduleResult
from app.services.data import load_data, road_graph, travel_times
from app.algorithms.scoring import calculate_scores
from app.algorithms.placement import optimize
from app.database import repository as repo

load_dotenv(Path(__file__).resolve().parents[1] / ".env", encoding="utf-8-sig")
MANILA = timezone(timedelta(hours=8))
security = HTTPBasic(auto_error=False)


def today():
    return datetime.now(MANILA).date()


def require_admin(credentials: HTTPBasicCredentials | None = Depends(security)):
    username, password = os.getenv("OMCM_ADMIN_USERNAME", ""), os.getenv("OMCM_ADMIN_PASSWORD", "")
    if os.getenv("OMCM_DEMO_AUTH", "false").lower() != "true" or not username or len(password) < 12:
        raise HTTPException(503, "Demo administrator access is disabled. Configure server-side credentials (password at least 12 characters).")
    if credentials is None:
        raise HTTPException(401, "Administrator sign-in required.", headers={"WWW-Authenticate": "Basic"})
    correct_user = secrets.compare_digest(credentials.username.encode(), username.encode())
    correct_password = secrets.compare_digest(credentials.password.encode(), password.encode())
    if not (correct_user and correct_password):
        raise HTTPException(401, "Invalid administrator credentials.", headers={"WWW-Authenticate": "Basic"})
    return username


@asynccontextmanager
async def lifespan(app):
    repo.initialize()
    load_data()
    yield


app = FastAPI(title="OMCM", version="1.0.0", lifespan=lifespan,
              description="Laguna synthetic mobile clinic planning prototype. Demo authentication only.")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("OMCM_CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(","), allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])


def run_optimization(request):
    try:
        return optimize(request)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@app.get("/api/health")
def health():
    return dict(status="ok", synthetic=True, today=today().isoformat(), demo_auth=True,
                admin_configured=os.getenv("OMCM_DEMO_AUTH", "false").lower() == "true" and bool(os.getenv("OMCM_ADMIN_USERNAME")) and len(os.getenv("OMCM_ADMIN_PASSWORD", "")) >= 12)


@app.get("/api/auth/me")
def me(actor=Depends(require_admin)):
    return dict(username=actor, demo_only=True)


@app.get("/api/barangays", response_model=RiskResult, response_model_exclude_none=True)
def barangays():
    frame, network, metadata = load_data()
    return dict(barangays=calculate_scores(frame, network, travel_times(road_graph(frame, network)), Weights()), metadata=metadata)


@app.get("/api/hospitals")
def hospitals():
    return dict(hospitals=load_data()[1]["hospitals"], synthetic=True)


@app.get("/api/clinics")
def clinics():
    _, network, metadata = load_data()
    return dict(sites=network["sites"], roads=network["roads"], metadata=metadata)


@app.post("/api/risk/calculate", response_model=RiskResult, response_model_exclude_none=True)
def risk(weights: Weights, actor=Depends(require_admin)):
    frame, network, metadata = load_data()
    return dict(barangays=calculate_scores(frame, network, travel_times(road_graph(frame, network)), weights), weights=weights.model_dump(), metadata=metadata)


@app.post("/api/optimize", response_model=PlanResult)
def placement(request: PlacementRequest, actor=Depends(require_admin)):
    result = run_optimization(request)
    result["plan_id"] = repo.save_plan(result)
    return result


@app.post("/api/simulate", response_model=SimulationResult)
def simulate(request: SimulationRequest, actor=Depends(require_admin)):
    before = run_optimization(request.original)
    after = run_optimization(request.scenario)
    previous, updated = before["optimized"]["served_by_barangay"], after["optimized"]["served_by_barangay"]
    changes = dict(previously_covered=before["optimized"]["metrics"]["residents_served"],
                   newly_covered=sum(max(0, updated[key]-previous[key]) for key in previous),
                   losing_coverage=sum(max(0, previous[key]-updated[key]) for key in previous),
                   average_travel_delta=round(after["optimized"]["metrics"]["average_travel_minutes"]-before["optimized"]["metrics"]["average_travel_minutes"], 2),
                   utilization_delta=round(after["optimized"]["metrics"]["capacity_utilization"]-before["optimized"]["metrics"]["capacity_utilization"], 2))
    return dict(before=before, after=after, changes=changes,
                note="Coverage changes compare aggregate appointments within each barangay, not identified individuals. Published schedules are unchanged.")


@app.get("/api/analytics", response_model=AnalyticsResult)
def analytics():
    data = barangays()
    bs = data["barangays"]
    return dict(total_barangays=len(bs), total_population=sum(b["population"] for b in bs),
                vulnerable_residents=sum(b["vulnerable_residents"] for b in bs), total_demand=sum(b["demand"] for b in bs),
                high_priority_demand=sum(b["demand"] for b in bs if b["high_priority"]), rankings=bs, metadata=data["metadata"])


@app.get("/api/schedules", response_model=SchedulesResult)
def schedules():
    return dict(**repo.schedules(), today=today().isoformat(), synthetic=True)


def approved_payload(request, emergency=False):
    if emergency:
        if request.deployment_date < today():
            raise HTTPException(422, "Past schedules cannot be overridden.")
    elif request.deployment_date <= today():
        raise HTTPException(422, "Ordinary approval is for tomorrow or later. Today's schedule requires a confirmed emergency override.")
    plan = repo.get_plan(request.plan_id)
    if plan is None:
        raise HTTPException(404, "Draft plan not found. Generate a placement first.")
    if not plan["optimized"]["clinics"]:
        raise HTTPException(422, "Cannot publish an empty deployment.")
    return dict(date=request.deployment_date.isoformat(), plan_id=request.plan_id, status="Emergency revised" if emergency else "Approved",
                start_time=request.start_time, end_time=request.end_time, services=request.services,
                clinics=plan["optimized"]["clinics"], synthetic=True)


@app.post("/api/schedules/approve", response_model=ScheduleResult)
def approve(request: ApproveRequest, actor=Depends(require_admin)):
    try:
        return repo.publish(approved_payload(request), actor)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error


@app.post("/api/schedules/emergency-override", response_model=ScheduleResult)
def emergency(request: EmergencyRequest, actor=Depends(require_admin)):
    if not request.confirmed:
        raise HTTPException(422, "Explicit administrator confirmation is required for an emergency override.")
    return repo.publish(approved_payload(request, emergency=True), actor, request.notice)


@app.get("/api/audit")
def audit(actor=Depends(require_admin)):
    return dict(events=repo.audit_log())


@app.get("/api/boundaries")
def boundaries():
    return repo.get_boundaries()


@app.post("/api/boundaries")
def upload_boundaries(request: BoundaryRequest, actor=Depends(require_admin)):
    data = request.geojson
    valid_ids = set(load_data()[0].id)
    if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list) or not 1 <= len(data["features"]) <= 2000:
        raise HTTPException(422, "Supply a GeoJSON FeatureCollection with 1–2000 Polygon or MultiPolygon features.")
    seen = set()
    try:
        for feature in data["features"]:
            if feature.get("type") != "Feature":
                raise ValueError("Each item must be a GeoJSON Feature.")
            properties = feature.get("properties", {})
            code = properties.get("psgc", properties.get("area_id", properties.get("adm4_psgc", properties.get("adm3_psgc"))))
            bid = str(code).lstrip("0") if code is not None else properties.get("barangay_id")
            if code is not None:
                if not isinstance(code, (str, int)) or not bid.isdigit() or len(bid) != 9 or not bid.startswith("4034"):
                    raise ValueError("Geographic identifiers must be Laguna PSGC codes.")
                if not (properties.get("name") or properties.get("adm4_en") or properties.get("adm3_en")) or properties.get("demonstration"):
                    raise ValueError("Real boundary features require an area name and cannot be demonstration geometry.")
            elif bid not in valid_ids:
                raise ValueError("Each legacy feature needs a properties.barangay_id matching the CSV.")
            if bid in seen:
                raise ValueError("Each boundary needs a unique geographic identifier.")
            seen.add(bid)
            geometry = feature["geometry"]
            if geometry["type"] not in ("Polygon", "MultiPolygon"):
                raise ValueError("Only Polygon and MultiPolygon geometries are supported.")
            polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
            if not polygons:
                raise ValueError("Empty polygons are not supported.")
            points = 0
            for polygon in polygons:
                if not polygon:
                    raise ValueError("A polygon must contain a ring.")
                for ring in polygon:
                    if len(ring) < 4 or ring[0] != ring[-1]:
                        raise ValueError("Polygon rings need at least four positions and must be closed.")
                    for position in ring:
                        points += 1
                        if len(position) < 2 or not all(isinstance(v, (float, int)) and not isinstance(v, bool) and math.isfinite(v) for v in position[:2]) or not (-180 <= position[0] <= 180 and -90 <= position[1] <= 90):
                            raise ValueError("Coordinates must be valid finite longitude/latitude positions.")
                        if code is not None and not (120.8 <= position[0] <= 121.8 and 13.8 <= position[1] <= 14.7):
                            raise ValueError("Laguna boundaries must use WGS84 coordinates within the province vicinity.")
            if points > 20000:
                raise ValueError("Simplify features to at most 20,000 positions each.")
    except (KeyError, TypeError, IndexError, ValueError) as error:
        raise HTTPException(422, f"Invalid boundary data: {error}") from error
    repo.save_boundaries(data)
    return repo.get_boundaries()
