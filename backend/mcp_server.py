import hmac
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

from . import service
from .config import APP_ACCESS_TOKEN, MCP_ALLOWED_HOSTS, MCP_ALLOWED_ORIGINS
from .errors import NotFoundError, ValidationError

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

mcp = MCPServer(
    name="FollowUpFlow",
    version="1.0.0",
    instructions=(
        "Manage FollowUpFlow client relationships and follow-ups. Always call list_clients first "
        "when a user refers to a client by name but you need an id. Use due_in_days for relative dates "
        "such as 'three days from today'. No AI model is embedded in FollowUpFlow; all intelligence "
        "comes from you, the MCP client."
    ),
)


def _json_result(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2, default=str)


def _call(operation, *args, **kwargs) -> str:
    try:
        return _json_result(operation(*args, **kwargs))
    except (ValidationError, NotFoundError) as error:
        raise ToolError(str(error)) from None
    except Exception as error:
        logger.exception("MCP tool failure: %s", error)
        raise ToolError("An unexpected FollowUpFlow error occurred. Check the server logs.") from None


@mcp.tool(name="create_client", description="Create a new client record. Returns the created client including its id, which can be passed to create_followup.")
async def create_client(
    name: str,
    company: str = "",
    email: str = "",
    phone: str = "",
    project_details: str = "",
    notes: str = "",
) -> str:
    """Create a new client in FollowUpFlow.

    Args:
        name: Full name of the client. Required.
        company: Company or organisation name.
        email: Valid email address.
        phone: Phone number in any format.
        project_details: Project scope, value or deal context mentioned by the user.
        notes: Additional notes, preferences or decision-maker details.
    """
    return _call(service.create_client, {
        "name": name, "company": company, "email": email, "phone": phone,
        "project_details": project_details, "notes": notes,
    })


@mcp.tool(name="create_followup", description="Create a follow-up for an existing client. Provide client_id from create_client/list_clients, or provide client_name to resolve an existing client by name. Use due_in_days for phrases like 'tomorrow' or 'in three days'.")
async def create_followup(
    title: str,
    client_id: str | None = None,
    client_name: str | None = None,
    description: str = "",
    due_date: str | None = None,
    due_in_days: int | None = None,
    priority: str = "medium",
    status: str = "pending",
) -> str:
    """Schedule a follow-up for an existing client.

    Args:
        title: Short description of the follow-up. Required, for example 'Send website proposal'.
        client_id: Id of an existing client. Prefer this when available.
        client_name: Client name to look up when no id is known. Must match one client uniquely.
        description: Agenda or context for the conversation.
        due_date: Calendar date in YYYY-MM-DD format. Use this for an explicit date.
        due_in_days: Number of days from today. Use 1 for tomorrow, 3 for three days from today.
        priority: One of high, medium or low. Defaults to medium.
        status: pending or completed. Defaults to pending.
    """
    payload = {
        "title": title, "description": description, "priority": priority, "status": status,
    }
    if client_id is not None:
        payload["client_id"] = client_id
    if client_name is not None:
        payload["client_name"] = client_name
    if due_date is not None:
        payload["due_date"] = due_date
    if due_in_days is not None:
        payload["due_in_days"] = due_in_days
    return _call(service.create_followup, payload)


@mcp.tool(name="list_clients", description="List all clients, optionally filtered by a search term. Use this to discover client ids before creating follow-ups.")
async def list_clients(search: str = "") -> str:
    """Return all clients in FollowUpFlow.

    Args:
        search: Optional search term matching client name, company or email.
    """
    return _call(service.list_clients, search or None)


@mcp.tool(name="list_followups", description="List follow-ups with optional filters. Status may be pending, completed or overdue. Overdue means pending with a due date before today.")
async def list_followups(
    status: str | None = None,
    client_id: str | None = None,
    q: str = "",
    limit: int = 100,
) -> str:
    """Return follow-ups with optional filters.

    Args:
        status: Optional filter: pending, completed or overdue.
        client_id: Optional filter by client id.
        q: Optional search term matching title, description or client name.
        limit: Maximum number of records to return, from 1 to 500.
    """
    return _call(service.list_followups, status, client_id, q or None, limit)


@mcp.tool(name="update_followup", description="Update any details of an existing follow-up, including title, description, client, due date, priority or status. Use due_in_days for relative rescheduling.")
async def update_followup(
    followup_id: str,
    client_id: str | None = None,
    title: str | None = None,
    description: str | None = None,
    due_date: str | None = None,
    due_in_days: int | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> str:
    """Update an existing follow-up.

    Args:
        followup_id: Id of the follow-up to update. Required.
        client_id: Move the follow-up to another existing client.
        title: New title.
        description: New description or agenda.
        due_date: New due date in YYYY-MM-DD format.
        due_in_days: Reschedule to this many days from today.
        priority: high, medium or low.
        status: pending or completed.
    """
    payload: dict[str, Any] = {}
    for key, value in {
        "client_id": client_id, "title": title, "description": description,
        "due_date": due_date, "due_in_days": due_in_days, "priority": priority, "status": status,
    }.items():
        if value is not None:
            payload[key] = value
    return _call(service.update_followup, followup_id, payload)


@mcp.tool(name="complete_followup", description="Mark a follow-up as completed and record the completion time.")
async def complete_followup(followup_id: str) -> str:
    """Complete a follow-up.

    Args:
        followup_id: Id of the follow-up to mark as completed. Required.
    """
    return _call(service.complete_followup, followup_id)


@mcp.tool(name="delete_followup", description="Permanently delete a follow-up.")
async def delete_followup(followup_id: str) -> str:
    """Delete a follow-up.

    Args:
        followup_id: Id of the follow-up to delete. Required.
    """
    return _call(service.delete_followup, followup_id)


@mcp.tool(name="get_dashboard_stats", description="Return FollowUpFlow dashboard statistics: total clients, pending, completed and overdue follow-ups, reminders due within seven days, upcoming follow-ups and recent activity.")
async def get_dashboard_stats() -> str:
    """Return current dashboard statistics and upcoming work."""
    return _call(service.dashboard_stats)


class AccessTokenMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health" or request.method == "OPTIONS" or not APP_ACCESS_TOKEN:
            return await call_next(request)
        parts = request.headers.get("authorization", "").split(None, 1)
        if len(parts) != 2 or parts[0].lower() != "bearer" or not hmac.compare_digest(parts[1], APP_ACCESS_TOKEN):
            return JSONResponse({"error": "Invalid or missing access token"}, status_code=401)
        return await call_next(request)


if MCP_ALLOWED_HOSTS:
    security = TransportSecuritySettings(
        allowed_hosts=MCP_ALLOWED_HOSTS,
        allowed_origins=MCP_ALLOWED_ORIGINS,
    )
else:
    security = TransportSecuritySettings(enable_dns_rebinding_protection=False)

mcp_app = mcp.streamable_http_app(
    streamable_http_path="/mcp",
    stateless_http=True,
    json_response=True,
    transport_security=security,
)


@asynccontextmanager
async def lifespan(_app: Starlette):
    async with mcp.session_manager.run():
        yield


async def health(_request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "followupflow-mcp", "transport": "streamable-http"})


app = Starlette(
    routes=[Route("/health", health, methods=["GET"]), Mount("/", app=mcp_app)],
    lifespan=lifespan,
)
app.add_middleware(AccessTokenMiddleware)

if MCP_ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=MCP_ALLOWED_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id", "Mcp-Protocol-Version"],
        max_age=600,
    )

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT") or "8000"))
