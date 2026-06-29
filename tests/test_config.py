import os

from app.config import get_default_database_url


def test_default_database_url_uses_tmp_for_vercel(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    assert get_default_database_url() == "sqlite:////tmp/market.db"
