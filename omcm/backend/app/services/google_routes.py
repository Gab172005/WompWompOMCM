"""Opt-in Google Routes transport; never updates the pilot or published plans."""
import json
import math
import os
import urllib.request
from urllib.error import HTTPError, URLError

URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
FIELD_MASK = "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring"


class GoogleRoutesUnavailable(RuntimeError):
    pass


def configured():
    return os.getenv("OMCM_GOOGLE_ROUTES_ENABLED", "false").lower() == "true" and bool(os.getenv("OMCM_GOOGLE_ROUTES_API_KEY", "").strip())


def compute_route(origin, destination):
    """Coordinates are supplied by existing server-owned pilot identifiers.

    Response is ephemeral Google content, separate from OSRM fixture evidence.
    No traffic observation or simulated-closure avoidance is asserted.
    """
    if not configured():
        raise GoogleRoutesUnavailable("Google Routes is disabled or its server key is missing.")
    for point in (origin, destination):
        if any(not isinstance(point.get(axis), (int, float)) or not math.isfinite(point[axis]) for axis in ("lat", "lng")):
            raise ValueError("Finite WGS84 route endpoints are required.")
        if not -90 <= point["lat"] <= 90 or not -180 <= point["lng"] <= 180:
            raise ValueError("Invalid WGS84 route endpoint.")
    def waypoint(point):
        return {"location": {"latLng": {"latitude": point["lat"], "longitude": point["lng"]}}}
    payload = {
        "origin": waypoint(origin), "destination": waypoint(destination),
        "travelMode": "DRIVE", "routingPreference": "TRAFFIC_UNAWARE",
        "polylineEncoding": "GEO_JSON_LINESTRING", "computeAlternativeRoutes": False,
    }
    request = urllib.request.Request(URL, data=json.dumps(payload).encode(), headers={
        "Content-Type": "application/json",
        "X-Goog-Api-Key": os.environ["OMCM_GOOGLE_ROUTES_API_KEY"].strip(),
        "X-Goog-FieldMask": FIELD_MASK,
    }, method="POST")
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=15) as response:
            data = json.loads(response.read(2_000_000))
    except (HTTPError, URLError, OSError, ValueError) as error:
        # Upstream response bodies and credentials must never reach clients/logs.
        raise GoogleRoutesUnavailable("Google Routes request failed. Check the server key, quota, billing and network access.") from error
    routes = data.get("routes") if isinstance(data, dict) else None
    if not isinstance(routes, list) or not routes:
        raise GoogleRoutesUnavailable("Google Routes returned no driving route.")
    route = routes[0]
    try:
        if not isinstance(route["duration"], str) or not route["duration"].endswith("s"):
            raise ValueError("Invalid duration format")
        seconds = float(route["duration"][:-1])
        distance = float(route["distanceMeters"])
        geometry = route["polyline"]["geoJsonLinestring"]
        coordinates = geometry["coordinates"]
        if not all(math.isfinite(v) and v >= 0 for v in (seconds, distance)):
            raise ValueError("Invalid duration or distance")
        if geometry["type"] != "LineString" or len(coordinates) < 2:
            raise ValueError("Invalid route geometry")
        for position in coordinates:
            if len(position) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in position) or not -180 <= position[0] <= 180 or not -90 <= position[1] <= 90:
                raise ValueError("Invalid route position")
    except (KeyError, TypeError, ValueError, AttributeError) as error:
        raise GoogleRoutesUnavailable("Google Routes returned invalid route evidence.") from error
    return {"duration_seconds": seconds, "distance_meters": distance, "coordinates": coordinates}
