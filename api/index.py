"""Vercel Serverless Function entry point.

Vercel Python runtime expects an ASGI app exposed from api/index.py.
This module imports the FastAPI app from app/main and exposes it as `app`.
"""
import sys
from pathlib import Path

# Add project root to Python path so "app" package is importable
_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from app.main import app as vercel_app

# Vercel expects a variable named "app" to serve
app = vercel_app
