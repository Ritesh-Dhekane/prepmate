import pytest

from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def test_home_page_loads(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"PrepMate" in response.data


def test_health(client):
    assert client.get("/api/health").get_json()["status"] == "ok"


def test_unknown_api_route_returns_json(client):
    response = client.get("/api/nope")
    assert response.status_code == 404
    assert response.get_json() == {"error": "Not found."}


def test_wrong_method_returns_json(client):
    response = client.post("/api/health")
    assert response.status_code == 405
    assert "error" in response.get_json()
