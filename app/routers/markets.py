"""Markets CRUD router."""
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Market, Owner
from app.schemas import MarketCreate, MarketUpdate, MarketOut
from app.middleware import get_current_owner

router = APIRouter(prefix="/api/v1/markets", tags=["markets"])


@router.get("", response_model=list[MarketOut])
def list_markets(owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    rows = db.query(Market).filter(Market.owner_id == owner.id).order_by(Market.id).all()
    result = []
    for m in rows:
        d = {
            "id": m.id,
            "name": m.name,
            "address": m.address,
            "kkm_config": json.loads(m.kkm_config or "{}"),
            "created_at": m.created_at,
        }
        result.append(d)
    return result


@router.post("", response_model=MarketOut, status_code=status.HTTP_201_CREATED)
def create_market(body: MarketCreate, owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    m = Market(owner_id=owner.id, name=body.name, address=body.address)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {
        "id": m.id,
        "name": m.name,
        "address": m.address,
        "kkm_config": json.loads(m.kkm_config or "{}"),
        "created_at": m.created_at,
    }


@router.put("/{market_id}", response_model=MarketOut)
def update_market(market_id: int, body: MarketUpdate, owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    m = db.query(Market).filter(Market.id == market_id, Market.owner_id == owner.id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Маркет не найден")
    if body.name is not None:
        m.name = body.name
    if body.address is not None:
        m.address = body.address
    if body.kkm_config is not None:
        m.kkm_config = json.dumps(body.kkm_config, ensure_ascii=False)
    db.commit()
    db.refresh(m)
    return {
        "id": m.id,
        "name": m.name,
        "address": m.address,
        "kkm_config": json.loads(m.kkm_config or "{}"),
        "created_at": m.created_at,
    }


@router.delete("/{market_id}")
def delete_market(market_id: int, owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    m = db.query(Market).filter(Market.id == market_id, Market.owner_id == owner.id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Маркет не найден")
    db.delete(m)
    db.commit()
    return {"message": "Маркет удален"}