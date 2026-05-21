"""Unit tests for the /tools/* endpoints."""

from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as c:
        r = c.get("/health")
        assert r.status_code == 200
        assert r.json()["service"] == "joola-ai-agents"


def test_evaluate_eligibility_pure_delegation() -> None:
    """evaluate_eligibility is a stateless wrapper around warranty_policy.evaluate."""
    payload = {
        "customer_country": "US",
        "is_original_purchaser": True,
        "product_type": "PADDLE_NFC",
        "order_source": "JOOLA_DIRECT",
        "purchase_date": "2026-05-01",
        "claim_date": str(date.today()),
        "is_defective": True,
        "nfc_registered": True,
        "nfc_registration_date": "2026-05-03",
        "nfc_receipt_uploaded": True,
        "nfc_receipt_approved": True,
    }
    with TestClient(app) as c:
        r = c.post("/tools/evaluate_eligibility", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert body["decision"] == "ELIGIBLE_FOR_DAMAGE_REVIEW"
        assert body["reason_code"] == "NFC_EXTENDED_WARRANTY"


def test_lookup_order_requires_an_identifier() -> None:
    with TestClient(app) as c:
        r = c.post("/tools/lookup_order", json={})
        assert r.status_code == 400


def test_lookup_order_by_number(seeded_supabase) -> None:
    with TestClient(app) as c:
        r = c.post("/tools/lookup_order", json={"order_number": "J-12345"})
        assert r.status_code == 200
        body = r.json()
        assert body["found"] is True
        assert body["order"]["product_type"] == "PADDLE_NFC"
        assert body["customer"]["email"] == "alex@example.com"


def test_check_warranty_registration(seeded_supabase) -> None:
    with TestClient(app) as c:
        r = c.post(
            "/tools/check_warranty_registration", json={"order_number": "J-12345"}
        )
        assert r.status_code == 200
        body = r.json()
        assert body["found"] is True
        assert body["registration"]["receipt_approved"] is True


def test_create_claim(seeded_supabase) -> None:
    with TestClient(app) as c:
        r = c.post(
            "/tools/create_claim",
            json={
                "customer_id": "cust-1",
                "order_id": "order-1",
                "channel": "email",
                "issue": "Cracked paddle",
                "run_pipeline": False,
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["claim_id"]
        assert body["pipeline_started"] is False


def test_escalate_to_human(seeded_supabase) -> None:
    with TestClient(app) as c:
        r = c.post(
            "/tools/escalate_to_human",
            json={
                "claim_id": "WC-10001",
                "reason": "SAFETY",
                "summary": "Customer reports smoke from paddle.",
                "priority": "urgent",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["escalation_id"] == "WC-10001"
        assert body["priority"] == "urgent"
