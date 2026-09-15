from __future__ import annotations

import os
import sqlite3
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

BASE_DIR = Path(__file__).resolve().parent


def resource_path(name: str) -> Path:
    bundled = getattr(sys, "_MEIPASS", None)
    return Path(bundled) / name if bundled else BASE_DIR / name


def data_dir() -> Path:
    configured = os.environ.get("APP_DATA_DIR")
    if configured:
        return Path(configured).expanduser()
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA", Path.home())) / "FieldstoneERP"
    return Path.home() / ".fieldstone-erp"


def db_path() -> Path:
    configured = os.environ.get("DB_PATH")
    return Path(configured).expanduser() if configured else data_dir() / "data" / "app.db"


def get_db() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def init_db() -> None:
    connection = get_db()
    try:
        connection.executescript(resource_path("schema.sql").read_text(encoding="utf-8"))
        connection.commit()
    finally:
        connection.close()


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    connection = get_db()
    try:
        connection.execute("BEGIN")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
