import asyncio
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
from datetime import datetime, timedelta, timezone

from mcp import Client
from mcp.client.streamable_http import streamable_http_client

EXPECTED_TOOLS = {
    "create_client", "create_followup", "list_clients", "list_followups",
    "update_followup", "complete_followup", "delete_followup", "get_dashboard_stats",
}


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class McpStreamableHttpTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.mkdtemp(prefix="followupflow-mcp-test-")
        cls.port = free_port()
        env = os.environ.copy()
        env.update({
            "DEMO_MODE": "true",
            "DATABASE_URL": "",
            "SQLITE_PATH": os.path.join(cls.temp_dir, "mcp.db"),
            "MCP_ALLOWED_HOSTS": "",
        })
        cls.process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.mcp_server:app",
             "--host", "127.0.0.1", "--port", str(cls.port)],
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        for _ in range(100):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{cls.port}/health", timeout=1) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(0.1)
        else:
            raise RuntimeError("MCP test server did not start")

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=10)
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    async def call(self, session: Client, name: str, arguments: dict | None = None):
        result = await session.call_tool(name, arguments or {})
        self.assertFalse(result.is_error, result.content[0].text if result.content else "tool error")
        return json.loads(result.content[0].text)

    async def test_all_tools(self):
        url = f"http://127.0.0.1:{self.port}/mcp"
        async with Client(streamable_http_client(url)) as self.session:
            await self.run_tool_scenarios()

    async def run_tool_scenarios(self):
        session = self.session
        tools = await session.list_tools()
        self.assertEqual({tool.name for tool in tools.tools}, EXPECTED_TOOLS)

        client = await self.call(session, "create_client", {
            "name": "Priya Nair",
            "company": "Studio North",
            "email": "priya@studionorth.example",
            "project_details": "Brand refresh worth Rs. 75,000",
        })
        self.assertTrue(client["id"])

        clients = await self.call(session, "list_clients", {"search": "Priya"})
        self.assertEqual([item["id"] for item in clients], [client["id"]])

        due = (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat()
        followup = await self.call(session, "create_followup", {
            "client_name": "Priya Nair",
            "title": "Send brand refresh proposal",
            "due_date": due,
            "priority": "high",
        })
        self.assertEqual(followup["client_id"], client["id"])
        self.assertEqual(followup["due_date"], due)

        relative = await self.call(session, "create_followup", {
            "title": "Quick check-in",
            "client_id": client["id"],
            "due_in_days": 1,
        })
        self.assertNotEqual(relative["due_date"], due)

        followups = await self.call(session, "list_followups", {"status": "pending", "limit": 10})
        self.assertEqual(len(followups), 2)

        updated = await self.call(session, "update_followup", {
            "followup_id": followup["id"], "title": "Send revised proposal", "priority": "low",
            "due_in_days": 2,
        })
        self.assertEqual(updated["title"], "Send revised proposal")
        self.assertEqual(updated["priority"], "low")

        completed = await self.call(session, "complete_followup", {"followup_id": followup["id"]})
        self.assertEqual(completed["status"], "completed")
        self.assertIsNotNone(completed["completed_at"])

        completed_list = await self.call(session, "list_followups", {"status": "completed"})
        self.assertEqual(len(completed_list), 1)

        stats = await self.call(session, "get_dashboard_stats")
        self.assertEqual(stats["total_clients"], 1)
        self.assertEqual(stats["completed_followups"], 1)
        self.assertEqual(stats["pending_followups"], 1)

        deleted = await self.call(session, "delete_followup", {"followup_id": relative["id"]})
        self.assertTrue(deleted["deleted"])

        remaining = await self.call(session, "list_followups", {})
        self.assertEqual([item["id"] for item in remaining], [followup["id"]])


if __name__ == "__main__":
    unittest.main(verbosity=2)
