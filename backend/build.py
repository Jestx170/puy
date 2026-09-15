from __future__ import annotations

import os
import sys
from pathlib import Path

import PyInstaller.__main__

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "dist"
if not FRONTEND.is_dir():
    raise SystemExit("Frontend build missing. Run npm run build first.")

args = [
    str(BACKEND / "app.py"),
    "--onefile",
    "--name",
    "FieldstoneERP",
    "--add-data",
    f"{BACKEND / 'schema.sql'}{os.pathsep}.",
    "--add-data",
    f"{FRONTEND}{os.pathsep}static",
    "--collect-submodules",
    "uvicorn",
    "--collect-submodules",
    "fastapi",
    "--paths",
    str(BACKEND),
    "--clean",
]
icon = ROOT / "public" / "Logo.ico"
if icon.is_file():
    args.extend(["--icon", str(icon)])

PyInstaller.__main__.run(args)
