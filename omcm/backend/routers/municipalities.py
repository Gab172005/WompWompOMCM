"""Community need, hospitals, analytics and boundary uploads."""
import math
from fastapi import APIRouter, Depends, HTTPException
from config import require_admin
from models.municipality import Weights, BoundaryRequest
from models.results import RiskResult, AnalyticsResult
from services.data import load_data
from services.route_service import road_graph, travel_times
from services.risk_scoring import calculate_scores
from services import repository as repo
router = APIRouter()


@router.get("/api/barangays", response_model=RiskResult, response_model_exclude_none=True)
def barangays(actor=Depends(require_admin)):
    frame, network, metadata = load_data()
    return dict(barangays=calculate_scores(frame, network, travel_times(road_graph(frame, network)), Weights()), metadata=metadata)


@router.get("/api/hospitals")
def hospitals():
    return dict(hospitals=load_data()[1]["hospitals"], synthetic=True)


@router.post("/api/risk/calculate", response_model=RiskResult, response_model_exclude_none=True)
def risk(weights: Weights, actor=Depends(require_admin)):
    frame, network, metadata = load_data()
    return dict(barangays=calculate_scores(frame, network, travel_times(road_graph(frame, network)), weights), weights=weights.model_dump(), metadata=metadata)


@router.get("/api/analytics", response_model=AnalyticsResult)
def analytics(actor=Depends(require_admin)):
    data = barangays(actor)
    bs = data["barangays"]
    return dict(total_barangays=len(bs), total_population=sum(b["population"] for b in bs),
                vulnerable_residents=sum(b["vulnerable_residents"] for b in bs), total_demand=sum(b["demand"] for b in bs),
                high_priority_demand=sum(b["demand"] for b in bs if b["high_priority"]), rankings=bs, metadata=data["metadata"])


@router.get("/api/boundaries")
def boundaries():
    return repo.get_boundaries()


@router.post("/api/boundaries")
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
