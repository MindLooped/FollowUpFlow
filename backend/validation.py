import re
from datetime import date
from typing import Any

from .errors import ValidationError

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PRIORITIES = {"high", "medium", "low"}
STATUSES = {"pending", "completed"}
CLIENT_FIELDS = ("name", "company", "email", "phone", "project_details", "notes")
FOLLOWUP_FIELDS = ("client_id", "title", "description", "due_date", "priority", "status")

MAX_LENGTHS = {
    "name": 120,
    "company": 120,
    "email": 200,
    "phone": 50,
    "project_details": 4000,
    "notes": 4000,
    "client_id": 80,
    "title": 200,
    "description": 4000,
}


def require_object(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("Request body must be a JSON object")
    return payload


def string_field(payload: dict[str, Any], field: str, *, required: bool, max_length: int | None = None) -> str | None:
    if field not in payload:
        if required:
            raise ValidationError({field: "This field is required"})
        return None
    value = payload[field]
    if value is None:
        if required:
            raise ValidationError({field: "This field is required"})
        return None
    if not isinstance(value, str):
        raise ValidationError({field: "Must be a string"})
    value = value.strip()
    if required and not value:
        raise ValidationError({field: "This field cannot be empty"})
    if max_length and len(value) > max_length:
        raise ValidationError({field: f"Must be at most {max_length} characters"})
    return value


def parse_date(value: Any, field: str = "due_date") -> str:
    if not isinstance(value, str):
        raise ValidationError({field: "Must be a date in YYYY-MM-DD format"})
    candidate = value.strip()[:10]
    if not DATE_PATTERN.match(candidate):
        raise ValidationError({field: "Must be a date in YYYY-MM-DD format"})
    try:
        date.fromisoformat(candidate)
    except ValueError:
        raise ValidationError({field: "Must be a valid calendar date"}) from None
    return candidate


def validate_client_input(payload: Any, *, partial: bool = False) -> dict[str, Any]:
    data = require_object(payload)
    result: dict[str, Any] = {}
    for field in CLIENT_FIELDS:
        value = string_field(data, field, required=not partial and field == "name", max_length=MAX_LENGTHS[field])
        if value is not None or field in data:
            result[field] = value or ""
    if "email" in result and result["email"] and not EMAIL_PATTERN.match(result["email"]):
        raise ValidationError({"email": "Enter a valid email address"})
    return result


def validate_followup_input(payload: Any, *, partial: bool = False) -> dict[str, Any]:
    data = require_object(payload)
    result: dict[str, Any] = {}
    for field in FOLLOWUP_FIELDS:
        if field == "due_date":
            if field in data:
                result[field] = parse_date(data[field])
            elif not partial:
                raise ValidationError({"due_date": "This field is required"})
            continue
        value = string_field(
            data,
            field,
            required=not partial and field in {"client_id", "title"},
            max_length=MAX_LENGTHS.get(field),
        )
        if value is not None or field in data:
            result[field] = value or ""
    if "priority" in result and result["priority"]:
        result["priority"] = result["priority"].lower()
        if result["priority"] not in PRIORITIES:
            raise ValidationError({"priority": "Must be high, medium or low"})
    if "status" in result and result["status"]:
        result["status"] = result["status"].lower()
        if result["status"] not in STATUSES:
            raise ValidationError({"status": "Must be pending or completed"})
    return result


def enum_value(value: Any, allowed: set[str], field: str, default: str | None = None) -> str | None:
    if value is None or value == "":
        return default
    if not isinstance(value, str) or value.lower() not in allowed:
        raise ValidationError({field: f"Must be one of: {', '.join(sorted(allowed))}"})
    return value.lower()


def positive_int(value: Any, field: str, default: int, minimum: int = 1, maximum: int = 500) -> int:
    if value is None or value == "":
        return default
    try:
        result = int(value)
    except (TypeError, ValueError):
        raise ValidationError({field: "Must be a whole number"}) from None
    if result < minimum or result > maximum:
        raise ValidationError({field: f"Must be between {minimum} and {maximum}"})
    return result
