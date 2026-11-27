import sqlite3
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .config import DATABASE_URL, SQLITE_PATH

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    project_details TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS followups (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    followup_id TEXT REFERENCES followups(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_followups_client ON followups(client_id);
CREATE INDEX IF NOT EXISTS idx_followups_due_date ON followups(due_date);
CREATE INDEX IF NOT EXISTS idx_followups_status ON followups(status);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at DESC);
"""

CLIENT_COLUMNS = ("name", "company", "email", "phone", "project_details", "notes")
FOLLOWUP_COLUMNS = ("client_id", "title", "description", "due_date", "priority", "status")


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def date_plus_days(days: int) -> str:
    return (datetime.now(timezone.utc).date() + timedelta(days=days)).isoformat()


class Repository:
    def __init__(self) -> None:
        self.backend = "postgresql" if DATABASE_URL else "sqlite"
        if self.backend == "sqlite":
            Path(SQLITE_PATH).parent.mkdir(parents=True, exist_ok=True)
            connection = sqlite3.connect(SQLITE_PATH)
            try:
                connection.executescript(SQLITE_SCHEMA)
                connection.commit()
            finally:
                connection.close()

    def _connect(self):
        if self.backend == "sqlite":
            connection = sqlite3.connect(SQLITE_PATH, timeout=30)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            return connection

        import psycopg
        from psycopg.rows import dict_row

        kwargs: dict[str, Any] = {"row_factory": dict_row}
        if "sslmode=" not in DATABASE_URL.lower():
            kwargs["sslmode"] = "require"
        return psycopg.connect(DATABASE_URL, **kwargs)

    @contextmanager
    def _connection(self):
        connection = self._connect()
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _q(self, sql: str) -> str:
        return sql.replace("?", "%s") if self.backend == "postgresql" else sql

    @staticmethod
    def _as_dict(row: Any) -> dict[str, Any]:
        if isinstance(row, dict):
            return dict(row)
        return {key: row[key] for key in row.keys()}

    @staticmethod
    def _normalize(row: Any) -> dict[str, Any]:
        result = Repository._as_dict(row)
        for key, value in result.items():
            if isinstance(value, (datetime, date)):
                result[key] = value.isoformat()
        return result

    def _all(self, sql: str, params: tuple = ()) -> list[dict[str, Any]]:
        with self._connection() as connection:
            cursor = connection.execute(self._q(sql), params)
            return [self._normalize(row) for row in cursor.fetchall()]

    def _one(self, sql: str, params: tuple = ()) -> dict[str, Any] | None:
        rows = self._all(sql, params)
        return rows[0] if rows else None

    def _log(self, connection: Any, action: str, description: str, client_id: str | None = None, followup_id: str | None = None) -> None:
        connection.execute(
            self._q("INSERT INTO activity_logs (id, client_id, followup_id, action, description, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
            (new_id(), client_id, followup_id, action, description[:1000], now_iso()),
        )

    def _client_row(self, client_id: str) -> dict[str, Any] | None:
        return self._one("SELECT * FROM clients WHERE id = ?", (client_id,))

    def _clients_select(self) -> str:
        return """
            SELECT c.*,
                   COUNT(f.id) AS followup_count,
                   COALESCE(SUM(CASE WHEN f.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count
            FROM clients c
            LEFT JOIN followups f ON f.client_id = c.id
        """

    def _client_with_counts(self, client_id: str) -> dict[str, Any] | None:
        row = self._one(
            self._clients_select() + " WHERE c.id = ? GROUP BY c.id",
            (client_id,),
        )
        return row

    def list_clients(self, search: str | None = None) -> list[dict[str, Any]]:
        sql = self._clients_select()
        params: list[Any] = []
        if search:
            pattern = f"%{search.lower()}%"
            sql += " WHERE LOWER(c.name) LIKE ? OR LOWER(c.company) LIKE ? OR LOWER(c.email) LIKE ?"
            params.extend([pattern, pattern, pattern])
        sql += " GROUP BY c.id ORDER BY LOWER(c.name) ASC, c.created_at DESC"
        return self._all(sql, tuple(params))

    def get_client(self, client_id: str) -> dict[str, Any] | None:
        row = self._client_with_counts(client_id)
        if row:
            row["followups"] = self.list_followups(client_id=client_id, limit=500)
        return row

    def create_client(self, values: dict[str, Any]) -> dict[str, Any]:
        client_id = new_id()
        timestamp = now_iso()
        with self._connection() as connection:
            connection.execute(
                self._q("""INSERT INTO clients
                    (id, name, company, email, phone, project_details, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"""),
                (client_id, values["name"], values.get("company", ""), values.get("email", ""),
                 values.get("phone", ""), values.get("project_details", ""), values.get("notes", ""),
                 timestamp, timestamp),
            )
            self._log(connection, "client_created", f"Created client {values['name']}", client_id=client_id)
        return self._client_with_counts(client_id) or {}

    def update_client(self, client_id: str, values: dict[str, Any]) -> dict[str, Any] | None:
        existing = self._client_row(client_id)
        if not existing:
            return None
        changes = {key: value for key, value in values.items() if key in CLIENT_COLUMNS and existing.get(key) != value}
        if not changes:
            return self.get_client(client_id)
        changes["updated_at"] = now_iso()
        assignments = ", ".join(f"{key} = ?" for key in changes)
        with self._connection() as connection:
            connection.execute(self._q(f"UPDATE clients SET {assignments} WHERE id = ?"), (*changes.values(), client_id))
            self._log(connection, "client_updated", f"Updated client {existing['name']}", client_id=client_id)
        return self.get_client(client_id)

    def delete_client(self, client_id: str) -> bool:
        existing = self._client_row(client_id)
        if not existing:
            return False
        with self._connection() as connection:
            self._log(connection, "client_deleted", f"Deleted client {existing['name']}", client_id=client_id)
            connection.execute(self._q("DELETE FROM clients WHERE id = ?"), (client_id,))
        return True

    def _followups_select(self) -> str:
        return """
            SELECT f.*, c.name AS client_name, c.company AS company
            FROM followups f
            JOIN clients c ON c.id = f.client_id
        """

    def list_followups(
        self,
        status: str | None = None,
        client_id: str | None = None,
        search: str | None = None,
        followup_id: str | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        today = utc_today()
        sql = self._followups_select()
        conditions: list[str] = []
        params: list[Any] = []
        if status == "pending":
            conditions.append("f.status = 'pending' AND f.due_date >= ?")
            params.append(today)
        elif status == "overdue":
            conditions.append("f.status = 'pending' AND f.due_date < ?")
            params.append(today)
        elif status == "completed":
            conditions.append("f.status = 'completed'")
        if client_id:
            conditions.append("f.client_id = ?")
            params.append(client_id)
        if followup_id:
            conditions.append("f.id = ?")
            params.append(followup_id)
        if search:
            pattern = f"%{search.lower()}%"
            conditions.append("(LOWER(f.title) LIKE ? OR LOWER(f.description) LIKE ? OR LOWER(c.name) LIKE ?)")
            params.extend([pattern, pattern, pattern])
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY f.status ASC, f.due_date ASC, f.created_at DESC LIMIT ?"
        params.append(limit)
        rows = self._all(sql, tuple(params))
        for row in rows:
            row["effective_status"] = (
                "completed" if row["status"] == "completed"
                else "overdue" if str(row["due_date"])[:10] < today
                else "pending"
            )
        return rows

    def get_followup(self, followup_id: str) -> dict[str, Any] | None:
        rows = self.list_followups(followup_id=followup_id, limit=1)
        return rows[0] if rows else None

    def create_followup(self, values: dict[str, Any]) -> dict[str, Any] | None:
        client = self._client_row(values["client_id"])
        if not client:
            return None
        followup_id = new_id()
        timestamp = now_iso()
        with self._connection() as connection:
            connection.execute(
                self._q("""INSERT INTO followups
                    (id, client_id, title, description, due_date, priority, status, completed_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""),
                (followup_id, values["client_id"], values["title"], values.get("description", ""),
                 values["due_date"], values.get("priority", "medium"), values.get("status", "pending"),
                 timestamp if values.get("status") == "completed" else None, timestamp, timestamp),
            )
            self._log(connection, "followup_created", f"Created follow-up “{values['title']}” for {client['name']}",
                      client_id=values["client_id"], followup_id=followup_id)
        return self.get_followup(followup_id)

    def update_followup(self, followup_id: str, values: dict[str, Any]) -> dict[str, Any] | None:
        existing = self.get_followup(followup_id)
        if not existing:
            return None
        changes = {key: value for key, value in values.items() if key in FOLLOWUP_COLUMNS and existing.get(key) != value}
        if not changes:
            return existing
        if "client_id" in changes and not self._client_row(changes["client_id"]):
            return None
        if "status" in changes:
            changes["completed_at"] = now_iso() if changes["status"] == "completed" else None
        changes["updated_at"] = now_iso()
        assignments = ", ".join(f"{key} = ?" for key in changes)
        with self._connection() as connection:
            connection.execute(self._q(f"UPDATE followups SET {assignments} WHERE id = ?"), (*changes.values(), followup_id))
            self._log(connection, "followup_updated", f"Updated follow-up “{existing['title']}”",
                      client_id=changes.get("client_id", existing["client_id"]), followup_id=followup_id)
        return self.get_followup(followup_id)

    def complete_followup(self, followup_id: str) -> dict[str, Any] | None:
        existing = self.get_followup(followup_id)
        if not existing:
            return None
        if existing["status"] == "completed":
            return existing
        timestamp = now_iso()
        with self._connection() as connection:
            connection.execute(
                self._q("UPDATE followups SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?"),
                (timestamp, timestamp, followup_id),
            )
            self._log(connection, "followup_completed", f"Completed follow-up “{existing['title']}”",
                      client_id=existing["client_id"], followup_id=followup_id)
        return self.get_followup(followup_id)

    def delete_followup(self, followup_id: str) -> bool:
        existing = self.get_followup(followup_id)
        if not existing:
            return False
        with self._connection() as connection:
            self._log(connection, "followup_deleted", f"Deleted follow-up “{existing['title']}”",
                      client_id=existing["client_id"], followup_id=followup_id)
            connection.execute(self._q("DELETE FROM followups WHERE id = ?"), (followup_id,))
        return True

    def list_activity(self, limit: int = 100) -> list[dict[str, Any]]:
        return self._all(
            """
            SELECT a.*, c.name AS client_name, f.title AS followup_title
            FROM activity_logs a
            LEFT JOIN clients c ON c.id = a.client_id
            LEFT JOIN followups f ON f.id = a.followup_id
            ORDER BY a.created_at DESC
            LIMIT ?
            """,
            (limit,),
        )

    def dashboard_stats(self) -> dict[str, Any]:
        today = utc_today()
        end = date_plus_days(7)
        total_clients = self._one("SELECT COUNT(*) AS value FROM clients")["value"]
        pending = self._one("SELECT COUNT(*) AS value FROM followups WHERE status = 'pending' AND due_date >= ?", (today,))["value"]
        completed = self._one("SELECT COUNT(*) AS value FROM followups WHERE status = 'completed'")["value"]
        overdue = self._one("SELECT COUNT(*) AS value FROM followups WHERE status = 'pending' AND due_date < ?", (today,))["value"]
        upcoming = self._one("SELECT COUNT(*) AS value FROM followups WHERE status = 'pending' AND due_date BETWEEN ? AND ?", (today, end))["value"]
        total_followups = self._one("SELECT COUNT(*) AS value FROM followups")["value"]
        return {
            "total_clients": total_clients,
            "pending_followups": pending,
            "completed_followups": completed,
            "overdue_followups": overdue,
            "upcoming_reminders": upcoming,
            "total_followups": total_followups,
            "upcoming_followups": self.list_followups(status="pending", limit=5),
            "recent_activity": self.list_activity(limit=8),
        }
