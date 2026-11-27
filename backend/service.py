from typing import Any

from .config import APP_ACCESS_TOKEN, DATABASE_URL, DEMO_MODE
from .db import Repository, date_plus_days
from .errors import NotFoundError, ValidationError
from .validation import STATUSES, enum_value, positive_int, validate_client_input, validate_followup_input

repository = Repository()


def _clean_search(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError({"q": "Must be a string"})
    cleaned = value.strip()
    return cleaned[:200] or None


def _relative_date(value: Any) -> str:
    if value is None or value == "":
        return ""
    try:
        days = int(value)
    except (TypeError, ValueError):
        raise ValidationError({"due_in_days": "Must be a whole number"}) from None
    if days < -365 or days > 3650:
        raise ValidationError({"due_in_days": "Must be between -365 and 3650"})
    return date_plus_days(days)


def _resolve_client(client_name: Any) -> str:
    if not isinstance(client_name, str) or not client_name.strip():
        raise ValidationError({"client_name": "Must be a non-empty string"})
    name = client_name.strip().lower()
    matches = repository.list_clients(search=name)
    exact = [client for client in matches if client["name"].strip().lower() == name]
    candidates = exact or matches
    if not candidates:
        raise ValidationError({"client_name": f"No client found matching “{client_name}”. Create the client first."})
    if len(candidates) > 1:
        names = ", ".join(client["name"] for client in candidates[:5])
        raise ValidationError({"client_name": f"Ambiguous client name. Matching clients: {names}. Use client_id instead."})
    return candidates[0]["id"]


def _prepare_followup(payload: Any, *, partial: bool) -> dict[str, Any]:
    data = dict(payload) if isinstance(payload, dict) else payload
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    client_name = data.pop("client_name", None)
    due_in_days = data.pop("due_in_days", None)
    data = {key: value for key, value in data.items() if value is not None}
    if due_in_days is not None and "due_date" in data:
        raise ValidationError("Use either due_date or due_in_days, not both")

    if due_in_days is not None:
        data["due_date"] = _relative_date(due_in_days)
    if client_name is not None:
        data["client_id"] = _resolve_client(client_name)

    values = validate_followup_input(data, partial=partial)
    if not partial and not values.get("client_id"):
        raise ValidationError({"client_id": "Select an existing client"})
    if not values.get("priority") and not partial:
        values["priority"] = "medium"
    if not values.get("status") and not partial:
        values["status"] = "pending"
    return values


def list_clients(search: str | None = None) -> list[dict[str, Any]]:
    return repository.list_clients(_clean_search(search))


def get_client(client_id: str) -> dict[str, Any]:
    client = repository.get_client(client_id)
    if not client:
        raise NotFoundError("Client not found")
    return client


def create_client(payload: Any) -> dict[str, Any]:
    return repository.create_client(validate_client_input(payload))


def update_client(client_id: str, payload: Any) -> dict[str, Any]:
    client = repository.update_client(client_id, validate_client_input(payload, partial=True))
    if not client:
        raise NotFoundError("Client not found")
    return client


def delete_client(client_id: str) -> dict[str, bool]:
    if not repository.delete_client(client_id):
        raise NotFoundError("Client not found")
    return {"deleted": True}


def list_followups(
    status: str | None = None,
    client_id: str | None = None,
    q: str | None = None,
    limit: Any = 200,
) -> list[dict[str, Any]]:
    normalized_status = enum_value(status, STATUSES | {"overdue"}, "status")
    return repository.list_followups(
        status=normalized_status,
        client_id=_clean_search(client_id),
        search=_clean_search(q),
        limit=positive_int(limit, "limit", 200, 1, 500),
    )


def get_followup(followup_id: str) -> dict[str, Any]:
    followup = repository.get_followup(followup_id)
    if not followup:
        raise NotFoundError("Follow-up not found")
    return followup


def create_followup(payload: Any) -> dict[str, Any]:
    values = _prepare_followup(payload, partial=False)
    followup = repository.create_followup(values)
    if not followup:
        raise NotFoundError("Client not found")
    return followup


def update_followup(followup_id: str, payload: Any) -> dict[str, Any]:
    values = _prepare_followup(payload, partial=True)
    if not values:
        raise ValidationError("Provide at least one field to update")
    followup = repository.update_followup(followup_id, values)
    if not followup:
        raise NotFoundError("Follow-up not found")
    return followup


def complete_followup(followup_id: str) -> dict[str, Any]:
    followup = repository.complete_followup(followup_id)
    if not followup:
        raise NotFoundError("Follow-up not found")
    return followup


def delete_followup(followup_id: str) -> dict[str, bool]:
    if not repository.delete_followup(followup_id):
        raise NotFoundError("Follow-up not found")
    return {"deleted": True}


def list_activity(limit: Any = 100) -> list[dict[str, Any]]:
    return repository.list_activity(positive_int(limit, "limit", 100, 1, 500))


def dashboard_stats() -> dict[str, Any]:
    return repository.dashboard_stats()


def server_settings() -> dict[str, Any]:
    return {
        "demo_mode": DEMO_MODE,
        "auth_required": bool(APP_ACCESS_TOKEN),
        "database": "postgresql" if DATABASE_URL else "sqlite",
    }
