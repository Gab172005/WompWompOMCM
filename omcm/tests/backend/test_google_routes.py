"""No real credentials or paid requests are used by these tests."""
import json
from unittest.mock import MagicMock
import pytest
from services.google_routes import compute_route, GoogleRoutesUnavailable, FIELD_MASK


def fake_provider(monkeypatch, data):
    monkeypatch.setenv("OMCM_GOOGLE_ROUTES_ENABLED", "true")
    monkeypatch.setenv("OMCM_GOOGLE_ROUTES_API_KEY", "server-route-test-secret")
    opener = MagicMock()
    opener.open.return_value.__enter__.return_value.read.return_value = json.dumps(data).encode()
    monkeypatch.setattr("urllib.request.build_opener", lambda *_: opener)
    return opener


def test_disabled_status_and_auth(client, auth, monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    monkeypatch.setenv("OMCM_GOOGLE_ROUTES_ENABLED", "false")
    opener = MagicMock()
    monkeypatch.setattr("urllib.request.build_opener", opener)
    assert client.get("/api/integrations/google").status_code == 401
    status = client.get("/api/integrations/google", auth=auth).json()
    assert status["routes_configured"] is False
    assert status["maps_renderer"] == "leaflet"
    response = client.get("/api/routes/google?origin_id=depot&site_id=P01", auth=auth)
    assert response.status_code == 503
    assert client.get("/api/routes/google?origin_id=outside&site_id=P01", auth=auth).status_code == 422
    opener.assert_not_called()


def test_route_transport_and_publication_isolation(client, auth, monkeypatch):
    monkeypatch.setenv("OMCM_DATASET", "pilot")
    response_data = {"routes": [{"duration": "120.5s", "distanceMeters": 800, "polyline": {"geoJsonLinestring": {"type": "LineString", "coordinates": [[121.24, 14.18], [121.25, 14.18]]}}}]}
    opener = fake_provider(monkeypatch, response_data)
    published = client.get("/api/schedules").json()
    from services import repository as repo
    with repo.connect() as db:
        count = db.execute("SELECT count(*) FROM plans").fetchone()[0]
    response = client.get("/api/routes/google?origin_id=depot&site_id=P01", auth=auth)
    assert response.status_code == 200
    result = response.json()
    assert result["duration_seconds"] == 120.5
    assert result["display_on"] == "google_map_only"
    assert result["saved_to_plan"] is False
    assert result["simulated_closures_applied"] is False
    assert "server-route-test-secret" not in response.text
    request = opener.open.call_args.args[0]
    assert request.full_url == "https://routes.googleapis.com/directions/v2:computeRoutes"
    assert request.get_header("X-goog-fieldmask") == FIELD_MASK
    assert request.get_header("X-goog-api-key") == "server-route-test-secret"
    assert json.loads(request.data)["polylineEncoding"] == "GEO_JSON_LINESTRING"
    assert client.get("/api/schedules").json() == published
    with repo.connect() as db:
        assert db.execute("SELECT count(*) FROM plans").fetchone()[0] == count


def test_provider_error_does_not_expose_secrets(monkeypatch):
    opener = fake_provider(monkeypatch, {})
    opener.open.side_effect = OSError("server-route-test-secret must not escape")
    with pytest.raises(GoogleRoutesUnavailable) as error:
        compute_route({"lat": 14.18, "lng": 121.24}, {"lat": 14.19, "lng": 121.25})
    assert "server-route-test-secret" not in str(error.value)


@pytest.mark.parametrize("data", [{}, {"routes": []}, {"routes": [{"duration": "NaNs", "distanceMeters": 800, "polyline": {"geoJsonLinestring": {"type": "LineString", "coordinates": [[121, 14], [122, 14]]}}}]}])
def test_invalid_route_evidence_is_explicit(monkeypatch, data):
    fake_provider(monkeypatch, data)
    with pytest.raises(GoogleRoutesUnavailable):
        compute_route({"lat": 14.18, "lng": 121.24}, {"lat": 14.19, "lng": 121.25})
