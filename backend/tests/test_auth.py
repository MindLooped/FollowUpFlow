import os
import tempfile
import unittest

TEST_DIR = tempfile.mkdtemp(prefix="followupflow-auth-test-")
os.environ["DEMO_MODE"] = "true"
os.environ.pop("APP_ACCESS_TOKEN", None)
os.environ["DATABASE_URL"] = ""
os.environ["SQLITE_PATH"] = os.path.join(TEST_DIR, "auth.db")

from backend import app as app_module
from backend import service
from backend.db import Repository


class AuthTests(unittest.TestCase):
    def test_bearer_token_required_when_configured(self):
        service.repository = Repository()
        original = app_module.APP_ACCESS_TOKEN
        app_module.APP_ACCESS_TOKEN = "test-secret-token"
        try:
            client = app_module.create_app().test_client()
            self.assertEqual(client.get("/api/clients").status_code, 401)
            self.assertEqual(client.get("/api/clients", headers={"Authorization": "Bearer wrong"}).status_code, 401)
            authorized = client.get("/api/clients", headers={"Authorization": "Bearer test-secret-token"})
            self.assertEqual(authorized.status_code, 200)
            self.assertEqual(client.get("/api/health").status_code, 200)
            self.assertEqual(client.get("/api/settings").status_code, 200)
        finally:
            app_module.APP_ACCESS_TOKEN = original


if __name__ == "__main__":
    unittest.main(verbosity=2)
