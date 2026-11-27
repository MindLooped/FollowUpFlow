import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

TEST_DIR = tempfile.mkdtemp(prefix="followupflow-test-")
os.environ["DEMO_MODE"] = "true"
os.environ.pop("APP_ACCESS_TOKEN", None)
os.environ["DATABASE_URL"] = ""
os.environ["SQLITE_PATH"] = os.path.join(TEST_DIR, "test.db")

from backend import service
from backend.app import create_app
from backend.db import Repository

TODAY = datetime.now(timezone.utc).date().isoformat()
TOMORROW = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()


class ApiCrudTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        service.repository = Repository()
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def setUp(self):
        with service.repository._connection() as connection:
            connection.execute("DELETE FROM activity_logs")
            connection.execute("DELETE FROM followups")
            connection.execute("DELETE FROM clients")

    def test_health_and_settings(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.get_json()["status"], "ok")

        settings = self.client.get("/api/settings").get_json()
        self.assertTrue(settings["demo_mode"])
        self.assertFalse(settings["auth_required"])
        self.assertEqual(settings["database"], "sqlite")

    def test_full_client_and_followup_lifecycle(self):
        created = self.client.post("/api/clients", json={
            "name": "Rahul Sharma",
            "company": "ABC Technologies",
            "email": "rahul@example.com",
            "project_details": "Website development worth Rs. 50,000",
        })
        self.assertEqual(created.status_code, 201, created.get_json())
        client_id = created.get_json()["id"]

        listed = self.client.get("/api/clients?q=abc").get_json()
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["id"], client_id)

        updated = self.client.patch(f"/api/clients/{client_id}", json={"phone": "+91 98765 43210"})
        self.assertEqual(updated.get_json()["phone"], "+91 98765 43210")

        followup = self.client.post("/api/followups", json={
            "client_id": client_id,
            "title": "Send website proposal",
            "description": "Share scope and pricing",
            "due_in_days": 3,
            "priority": "high",
        })
        self.assertEqual(followup.status_code, 201, followup.get_json())
        followup_id = followup.get_json()["id"]
        self.assertEqual(followup.get_json()["status"], "pending")
        self.assertNotEqual(followup.get_json()["due_date"], TODAY)

        rescheduled = self.client.patch(f"/api/followups/{followup_id}", json={
            "due_date": TOMORROW, "priority": "low",
        })
        self.assertEqual(rescheduled.get_json()["due_date"], TOMORROW)
        self.assertEqual(rescheduled.get_json()["priority"], "low")

        pending = self.client.get("/api/followups?status=pending").get_json()
        self.assertEqual(len(pending), 1)

        completed = self.client.post(f"/api/followups/{followup_id}/complete")
        self.assertEqual(completed.get_json()["status"], "completed")
        self.assertIsNotNone(completed.get_json()["completed_at"])

        stats = self.client.get("/api/dashboard").get_json()
        self.assertEqual(stats["total_clients"], 1)
        self.assertEqual(stats["completed_followups"], 1)
        self.assertEqual(stats["total_followups"], 1)
        self.assertEqual(len(stats["recent_activity"]) >= 4, True)

        activity = self.client.get("/api/activity").get_json()
        self.assertIn("client_created", [item["action"] for item in activity])
        self.assertIn("followup_completed", [item["action"] for item in activity])

        self.assertEqual(self.client.delete(f"/api/followups/{followup_id}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/followups/{followup_id}").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/clients/{client_id}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/clients/{client_id}").status_code, 404)

    def test_validation_and_not_found(self):
        invalid = self.client.post("/api/clients", json={"name": "A", "email": "not-an-email"})
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("email", invalid.get_json()["details"])

        missing = self.client.post("/api/followups", json={
            "client_id": "does-not-exist", "title": "Test", "due_date": TODAY,
        })
        self.assertEqual(missing.status_code, 404)

        bad_date = self.client.post("/api/followups", json={
            "client_id": "x", "title": "Test", "due_date": "2026-02-30",
        })
        self.assertEqual(bad_date.status_code, 400)

    def test_cascade_and_overdue_status(self):
        client_id = self.client.post("/api/clients", json={"name": "Cascade Client"}).get_json()["id"]
        followup_id = self.client.post("/api/followups", json={
            "client_id": client_id, "title": "Old task", "due_date": "2020-01-01",
        }).get_json()["id"]

        overdue = self.client.get("/api/followups?status=overdue").get_json()
        self.assertEqual([item["id"] for item in overdue], [followup_id])
        self.assertEqual(overdue[0]["effective_status"], "overdue")

        self.client.delete(f"/api/clients/{client_id}")
        self.assertEqual(self.client.get(f"/api/followups/{followup_id}").status_code, 404)


if __name__ == "__main__":
    unittest.main(verbosity=2)
