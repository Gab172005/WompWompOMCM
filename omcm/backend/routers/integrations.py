"""Need sensitivity, grounded explanations, chat and optional route integrations."""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from config import require_admin
from models.municipality import Weights
from models.scenario import SimulationRequest
from services.data import load_data, road_graph, travel_times
from services.risk_scoring import calculate_scores, sensitivity_check
from services.simulation_engine import simulate_scenario

router = APIRouter()

@router.post("/api/risk/sensitivity")
def risk_sensitivity(weights: Weights, top_k: int = Query(3, ge=1, le=100), actor=Depends(require_admin)):
    frame, network, _ = load_data()
    scores = calculate_scores(frame, network, travel_times(road_graph(frame, network)), weights)
    return sensitivity_check(scores, weights, top_k)



@router.post("/api/explanations")
def explanations(request: SimulationRequest, actor=Depends(require_admin)):
    from services.explanations import get_provider
    from services.pilot import road_evidence
    try:
        provider = get_provider()
        evidence = simulate_scenario(request)
        _, network, _ = load_data()
        excluded = set(request.scenario.flooded_sites)
        if "routes" in network:
            _, excluded = road_evidence(network, request.scenario)
        names = [s["name"] for s in network["sites"] if s["id"] in excluded]
        evidence["exclusions"] = ["Sites excluded by selected flooding or blocked depot access: " + (", ".join(names) or "none") + "."]
        return dict(text=provider.explain(evidence), provider="deterministic")
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post("/api/chat")
def chat(body: dict = Body(...), actor=Depends(require_admin)):
    from services.chat import reply
    from services.pilot import road_evidence
    from pydantic import ValidationError
    messages = body.get("messages")
    if not isinstance(messages, list) or not 1 <= len(messages) <= 40:
        raise HTTPException(422, "Provide 1–40 chat messages.")
    for message in messages:
        if not isinstance(message, dict) or set(message) != {"role", "content"} or message["role"] not in ("user", "assistant") or not isinstance(message["content"], str) or not 1 <= len(message["content"].strip()) <= 4000:
            raise HTTPException(422, "Messages require a user/assistant role and 1–4000 characters.")
    if messages[-1]["role"] != "user":
        raise HTTPException(422, "The final message must be from the user.")
    try:
        request = SimulationRequest.model_validate({"original": body.get("original", {}), "scenario": body.get("scenario", {})})
        evidence = simulate_scenario(request)
        _, network, _ = load_data()
        excluded = set(request.scenario.flooded_sites)
        if "routes" in network:
            _, excluded = road_evidence(network, request.scenario)
        names = [site["name"] for site in network["sites"] if site["id"] in excluded]
        evidence["exclusions"] = ["Flood or blocked-depot exclusions: " + (", ".join(names) or "none") + "."]
        return reply(evidence, messages)
    except (ValueError, ValidationError) as error:
        raise HTTPException(422, str(error)) from error


@router.get("/api/integrations/google")
def google_integration_status(actor=Depends(require_admin)):
    from services.google_routes import configured
    return dict(routes_configured=configured(), routes_active_in_planner=False,
                maps_renderer="leaflet", google_routes_display="google_map_only")


@router.get("/api/routes/google")
def google_route(origin_id: str, site_id: str, actor=Depends(require_admin)):
    from services.google_routes import compute_route, GoogleRoutesUnavailable
    _, network, _ = load_data()
    if "depot" not in network:
        raise HTTPException(503, "Google Routes preparation requires the existing pilot dataset.")
    origins = {row["id"]: row for row in network["barangays"]}
    origins["depot"] = network["depot"]
    sites = {site["id"]: site for site in network["sites"]}
    if origin_id not in origins or site_id not in sites:
        raise HTTPException(422, "Choose an existing pilot origin and candidate site.")
    try:
        return dict(**compute_route(origins[origin_id], sites[site_id]),
                    source="Google Routes API", display_on="google_map_only",
                    origin_id=origin_id, site_id=site_id,
                    simulated_closures_applied=False, saved_to_plan=False)
    except GoogleRoutesUnavailable as error:
        raise HTTPException(503, str(error)) from error
