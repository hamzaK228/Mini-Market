"""Database engine and session management with SQLAlchemy.

Supports both SQLite (local dev) and PostgreSQL (Vercel production).
Set DATABASE_URL env var for PostgreSQL.
"""
import json
import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

# ── Engine ────────────────────────────────────────────────────────────────────

_is_sqlite = "sqlite" in settings.DATABASE_URL

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    echo=settings.DEBUG,
    pool_pre_ping=True,  # Good for serverless
    pool_recycle=300,    # Recycle connections every 5 min
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ── Init ──────────────────────────────────────────────────────────────────────

_initialized = False


def init_db():
    """Create all tables on startup (idempotent)."""
    global _initialized
    if _initialized:
        return
    Base.metadata.create_all(bind=engine)

    # Auto-seed default data only if owners table is empty
    _seed_if_empty()

    _initialized = True


def _seed_if_empty():
    """Seed demo data if no owners exist yet."""
    from app.models import Owner, Market, Product, Order
    from app.utils.auth import hash_password

    db = SessionLocal()
    try:
        count = db.query(Owner).count()
        if count > 0:
            return

        # Create demo owner
        owner = Owner(
            email="admin@market.kg",
            name="Admin",
            password_hash=hash_password("admin123"),
        )
        db.add(owner)
        db.flush()

        # Create default markets
        market_data = [
            ('Магазин №1 "Киевская 120"', 'ул. Киевская, 120',
             '{"provider": "webkassa", "endpoint": "https://api.webkassa.kg/v1/sales-report", "token": "Bearer wk-token-9382103f8a", "deviceId": "KKM-BISHKEK-01"}'),
            ('Магазин №2 "Ахунбаева 45"', 'ул. Ахунбаева, 45',
             '{"provider": "1c", "endpoint": "https://api.1c.kg/v1/sales-report", "token": "Bearer 1c-token-829103fa7b", "deviceId": "KKM-BISHKEK-02"}'),
        ]
        m_ids = []
        for name, address, kkm in market_data:
            m = Market(owner_id=owner.id, name=name, address=address, kkm_config=kkm)
            db.add(m)
            db.flush()
            m_ids.append(m.id)

        # Create default products
        products_data = [
            ("Coca-Cola 0.5L", "drinks", 42, 58, "Coca-Cola Bishkek"),
            ("Coca-Cola 1.0L", "drinks", 68, 90, "Coca-Cola Bishkek"),
            ("Fanta 0.5L", "drinks", 42, 58, "Coca-Cola Bishkek"),
            ("Sprite 0.5L", "drinks", 42, 58, "Coca-Cola Bishkek"),
            ("Choco Pie 6pcs", "sweets", 120, 160, "Orion"),
            ("Besurev", "snacks", 25, 40, "Local"),
            ("Lipton Yellow 25pk", "tea", 180, 250, "Lipton KR"),
            ("Lipton Green 20pk", "tea", 160, 220, "Lipton KR"),
            ("Magnum Classic", "ice cream", 120, 170, "Nestle KR"),
            ("Extreme 90ml", "ice cream", 95, 140, "Nestle KR"),
            ("Lays 90g", "snacks", 75, 100, "Local"),
            ("Cheetos 90g", "snacks", 75, 100, "Local"),
            ("Suzu 1L", "dairy", 55, 75, "Shoro/Local"),
            ("Kumys 0.5L", "dairy", 60, 85, "Shoro/Local"),
            ("Wisk 400ml", "household", 180, 250, "Local"),
            ("Pampers S per pc", "baby", 35, 50, "Local"),
        ]
        p_map = {}
        for p_name, cat, buy, sell, supp in products_data:
            p = Product(owner_id=owner.id, name=p_name, category=cat,
                        buy_price=buy, sell_price=sell, supplier=supp)
            db.add(p)
            db.flush()
            p_map[p_name] = p.id

        # Create demo orders
        if len(m_ids) >= 2:
            items1 = [{"productId": p_map.get("Coca-Cola 0.5L", 0), "name": "Coca-Cola 0.5L", "qty": 48, "price": 42},
                      {"productId": p_map.get("Fanta 0.5L", 0), "name": "Fanta 0.5L", "qty": 24, "price": 42}]
            db.add(Order(market_id=m_ids[0], supplier="Coca-Cola Bishkek", contact_person="Алексей",
                         phone="+996 555 123 456", status="pending",
                         items_json=json.dumps(items1, ensure_ascii=False)))

            items2 = [{"productId": p_map.get("Choco Pie 6pcs", 0), "name": "Choco Pie 6pcs", "qty": 30, "price": 120}]
            db.add(Order(market_id=m_ids[0], supplier="Orion", contact_person="Дмитрий",
                         phone="+996 777 987 654", status="pending",
                         items_json=json.dumps(items2, ensure_ascii=False)))

            items3 = [{"productId": p_map.get("Magnum Classic", 0), "name": "Magnum Classic", "qty": 24, "price": 120},
                      {"productId": p_map.get("Extreme 90ml", 0), "name": "Extreme 90ml", "qty": 24, "price": 95}]
            db.add(Order(market_id=m_ids[1], supplier="Nestle KR", contact_person="Мария",
                         phone="+996 500 456 789", status="pending",
                         items_json=json.dumps(items3, ensure_ascii=False)))

            items4 = [{"productId": p_map.get("Lipton Yellow 25pk", 0), "name": "Lipton Yellow 25pk", "qty": 15, "price": 180}]
            db.add(Order(market_id=m_ids[1], supplier="Lipton KR", contact_person="Анна",
                         phone="+996 701 112 233", status="pending",
                         items_json=json.dumps(items4, ensure_ascii=False)))

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── Dependency ────────────────────────────────────────────────────────────────


def get_db():
    """FastAPI dependency — yields a session and closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
