"""Reconciliations CRUD router — daily cash reconciliation against KKM."""
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.models import Market, Reconciliation, Owner
from app.schemas import ReconSave, ReconOut, ReconHistoryOut
from app.middleware import get_current_owner

router = APIRouter(prefix="/api/v1/reconciliations", tags=["reconciliations"])


@router.get("/market/{market_id}")
def get_reconciliation_by_date(
    market_id: int,
    date_str: str,
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Get reconciliation for a specific market and date. Creates a fresh one if none exists."""
    # Verify
    m = db.query(Market).filter(Market.id == market_id, Market.owner_id == owner.id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Маркет не найден")

    r = db.query(Reconciliation).filter(
        Reconciliation.market_id == market_id,
        Reconciliation.date == date_str,
    ).first()

    if not r:
        # Return empty skeleton
        return {
            "id": None,
            "market_id": market_id,
            "date": date_str,
            "items_json": [],
            "total_expected": 0,
            "total_register": 0,
            "total_diff": 0,
            "status": "ok",
            "created_at": None,
        }

    return {
        "id": r.id,
        "market_id": r.market_id,
        "date": r.date,
        "items_json": json.loads(r.items_json or "[]"),
        "total_expected": r.total_expected,
        "total_register": r.total_register,
        "total_diff": r.total_diff,
        "status": r.status,
        "created_at": r.created_at,
    }


@router.post("", response_model=ReconOut)
def save_reconciliation(body: ReconSave, owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    """Save (upsert) a reconciliation for a market+date."""
    m = db.query(Market).filter(Market.id == body.market_id, Market.owner_id == owner.id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Маркет не найден")

    r = db.query(Reconciliation).filter(
        Reconciliation.market_id == body.market_id,
        Reconciliation.date == body.date,
    ).first()

    items_json = json.dumps([item.model_dump() for item in body.items], ensure_ascii=False)

    if r:
        r.items_json = items_json
        r.total_expected = body.total_expected
        r.total_register = body.total_register
        r.total_diff = body.total_diff
        r.status = body.status
    else:
        r = Reconciliation(
            market_id=body.market_id,
            date=body.date,
            items_json=items_json,
            total_expected=body.total_expected,
            total_register=body.total_register,
            total_diff=body.total_diff,
            status=body.status,
        )
        db.add(r)

    db.commit()
    db.refresh(r)

    return {
        "id": r.id,
        "market_id": r.market_id,
        "date": r.date,
        "items_json": json.loads(r.items_json or "[]"),
        "total_expected": r.total_expected,
        "total_register": r.total_register,
        "total_diff": r.total_diff,
        "status": r.status,
        "created_at": r.created_at,
    }


@router.get("/market/{market_id}/history", response_model=list[ReconHistoryOut])
def reconciliation_history(market_id: int, owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    """Get all reconciliation history for a market."""
    m = db.query(Market).filter(Market.id == market_id, Market.owner_id == owner.id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Маркет не найден")

    rows = db.query(Reconciliation).filter(
        Reconciliation.market_id == market_id,
    ).order_by(Reconciliation.date.desc()).all()

    return [
        {
            "id": r.id,
            "date": r.date,
            "total_expected": r.total_expected,
            "total_register": r.total_register,
            "total_diff": r.total_diff,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in rows
    ]