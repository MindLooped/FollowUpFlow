import hmac
import logging
from functools import wraps

from flask import Flask, jsonify, request
from flask_cors import CORS

from . import service
from .config import APP_ACCESS_TOKEN, CLIENT_ORIGINS
from .errors import NotFoundError, ValidationError

logger = logging.getLogger(__name__)


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(
        app,
        origins=CLIENT_ORIGINS,
        methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        max_age=600,
    )

    @app.errorhandler(ValidationError)
    def handle_validation(error: ValidationError):
        return jsonify({"error": "Invalid request", "details": error.details}), 400

    @app.errorhandler(NotFoundError)
    def handle_not_found(error: NotFoundError):
        return jsonify({"error": str(error)}), 404

    @app.errorhandler(404)
    def handle_missing_route(_error):
        return jsonify({"error": "Endpoint not found"}), 404

    @app.errorhandler(405)
    def handle_bad_method(_error):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(Exception)
    def handle_unexpected(error: Exception):
        logger.exception("Unhandled API error: %s", error)
        return jsonify({"error": "An unexpected server error occurred"}), 500

    def require_auth(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if APP_ACCESS_TOKEN:
                header = request.headers.get("Authorization", "")
                parts = header.split(None, 1)
                if len(parts) != 2 or parts[0].lower() != "bearer" or not hmac.compare_digest(parts[1], APP_ACCESS_TOKEN):
                    return jsonify({"error": "Invalid or missing access token"}), 401
            return view(*args, **kwargs)
        return wrapped

    def json_body() -> dict:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValidationError("Request body must be a JSON object")
        return payload

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "followupflow-api"})

    @app.get("/api/settings")
    def settings():
        return jsonify(service.server_settings())

    @app.get("/api/clients")
    @require_auth
    def clients_list():
        return jsonify(service.list_clients(request.args.get("q")))

    @app.post("/api/clients")
    @require_auth
    def clients_create():
        return jsonify(service.create_client(json_body())), 201

    @app.get("/api/clients/<client_id>")
    @require_auth
    def clients_get(client_id: str):
        return jsonify(service.get_client(client_id))

    @app.patch("/api/clients/<client_id>")
    @require_auth
    def clients_update(client_id: str):
        return jsonify(service.update_client(client_id, json_body()))

    @app.delete("/api/clients/<client_id>")
    @require_auth
    def clients_delete(client_id: str):
        return jsonify(service.delete_client(client_id))

    @app.get("/api/followups")
    @require_auth
    def followups_list():
        return jsonify(service.list_followups(
            status=request.args.get("status"),
            client_id=request.args.get("client_id"),
            q=request.args.get("q"),
            limit=request.args.get("limit", 200),
        ))

    @app.post("/api/followups")
    @require_auth
    def followups_create():
        return jsonify(service.create_followup(json_body())), 201

    @app.get("/api/followups/<followup_id>")
    @require_auth
    def followups_get(followup_id: str):
        return jsonify(service.get_followup(followup_id))

    @app.patch("/api/followups/<followup_id>")
    @require_auth
    def followups_update(followup_id: str):
        return jsonify(service.update_followup(followup_id, json_body()))

    @app.post("/api/followups/<followup_id>/complete")
    @require_auth
    def followups_complete(followup_id: str):
        return jsonify(service.complete_followup(followup_id))

    @app.delete("/api/followups/<followup_id>")
    @require_auth
    def followups_delete(followup_id: str):
        return jsonify(service.delete_followup(followup_id))

    @app.get("/api/activity")
    @require_auth
    def activity_list():
        return jsonify(service.list_activity(request.args.get("limit", 100)))

    @app.get("/api/dashboard")
    @require_auth
    def dashboard():
        return jsonify(service.dashboard_stats())

    return app


app = create_app()
