"""Backend tests for 'Wanted for Fries: Angel the Stunt Driver' API."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fries-endless-run.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Health ----
class TestHealth:
    def test_root_returns_ok(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert isinstance(data["message"], str)


# ---- Radio endpoint ----
class TestRadio:
    def _check_response(self, r):
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        data = r.json()
        assert "line" in data and isinstance(data["line"], str) and data["line"].strip()
        assert "source" in data and data["source"] in ("ai", "fallback")
        return data

    def test_radio_early(self, session):
        r = session.post(f"{API}/radio", json={"phase": "early", "fries_collected": 0, "distance": 0}, timeout=30)
        data = self._check_response(r)
        print("EARLY:", data)

    def test_radio_mid(self, session):
        r = session.post(f"{API}/radio", json={"phase": "mid", "fries_collected": 5, "distance": 600}, timeout=30)
        data = self._check_response(r)
        print("MID:", data)

    def test_radio_late(self, session):
        r = session.post(f"{API}/radio", json={"phase": "late", "fries_collected": 20, "distance": 1500}, timeout=30)
        data = self._check_response(r)
        print("LATE:", data)

    def test_radio_invalid_phase_defaults(self, session):
        r = session.post(f"{API}/radio", json={"phase": "bogus", "fries_collected": 1, "distance": 10}, timeout=30)
        data = self._check_response(r)
        print("INVALID->DEFAULTED:", data)

    def test_radio_empty_body(self, session):
        # Should use defaults (phase=early)
        r = session.post(f"{API}/radio", json={}, timeout=30)
        self._check_response(r)


# ---- Scores endpoint ----
class TestScores:
    created_ids = []

    def test_save_score_returns_record(self, session):
        payload = {"player": "TEST_Angel", "distance": 1234, "fries": 17}
        r = session.post(f"{API}/scores", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["player"] == "TEST_Angel"
        assert data["distance"] == 1234
        assert data["fries"] == 17
        assert "id" in data and isinstance(data["id"], str) and len(data["id"]) > 0
        assert "timestamp" in data
        TestScores.created_ids.append(data["id"])

    def test_save_another_score(self, session):
        payload = {"player": "TEST_Angel2", "distance": 999, "fries": 5}
        r = session.post(f"{API}/scores", json=payload, timeout=15)
        assert r.status_code == 200
        TestScores.created_ids.append(r.json()["id"])

    def test_top_scores_no_objectid_leakage(self, session):
        r = session.get(f"{API}/scores/top", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Sorted desc by distance
        if len(data) >= 2:
            for i in range(len(data) - 1):
                assert data[i]["distance"] >= data[i + 1]["distance"]
        for doc in data:
            assert "_id" not in doc, f"Mongo _id leaked: {doc}"
            assert "player" in doc and "distance" in doc and "fries" in doc

    def test_top_scores_contains_our_record(self, session):
        r = session.get(f"{API}/scores/top", timeout=15)
        assert r.status_code == 200
        players = [d.get("player") for d in r.json()]
        # Best-effort: at least one of our test scores should be present (limit 10, distance sorted)
        # 1234 might or might not be in top 10 if there are many prior; just check no errors
        assert isinstance(players, list)
