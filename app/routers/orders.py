"""Orders CRUD router."""
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Order, Owner
from app.schemas import OrderCreate, OrderUpdate, OrderOut
from app.middleware import get_current_owner

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


@router.get("", response_model=list[OrderOut])
def list_orders(owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    # Get all orders for all markets belonging to this owner
    from app.models import Market
    market_ids = [m.id for m in db.query(Market).filter(Market.owner_id == owner.id).all()]
    rows = db.query(Order).filter(Order.market_id.in_(market_ids)).order_by(Order.created_at.desc()).all()
    result = []
    for o in rows:
        d = {
            "id": o.id,
            "market_id": o.market_id,
            "supplier": o.supplier,
            "contact_person": o.contact_person,
            "phone": o.phone,
            "status": o.status,
            "items_json": json.loads(o.items_json or "[]"),
            "comment": o.comment or "",
            "created_at": o.created_at,
        }
        result.append(d)
    return result


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(body: OrderCreate, owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    # Verify market belongs to owner
    from app.models import Market
    m = db.query(Market).filter(Market.id == body.market_id, Market.owner_id == owner.id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Маркет не найден")

    items_dicts = [item.model_dump() for item in body.items]
    o = Order(
        market_id=body.market_id,
        supplier=body.supplier,
        contact_person=body.contact_person,
        phone=body.phone,
        status="pending",
        items_json=json.dumps(items_dicts, ensure_ascii=False),
    )
    db.add(o)
    db.commit()
    db.refresh(o)

    return {
        "id": o.id,
        "market_id": o.market_id,
        "supplier": o.supplier,
        "contact_person": o.contact_person,
        "phone": o.phone,
        "status": o.status,
        "items_json": json.loads(o.items_json or "[]"),
        "comment": o.comment or "",
        "created_at": o.created_at,
    }


@router.put("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, body: OrderUpdate, owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    from app.models import Market
    market_ids = [m.id for m in db.query(Market).filter(Market.owner_id == owner.id).all()]
    o = db.query(Order).filter(Order.id == order_id, Order.market_id.in_(market_ids)).first()
    if not o:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")

    if body.status is not None:
        o.status = body.status
    if body.comment is not None:
        o.comment = body.comment
    if body.items is not None:
        o.items_json = json.dumps([item.model_dump() for item in body.items], ensure_ascii=False)

    db.commit()
    db.refresh(o)

    return {
        "id": o.id,
        "market_id": o.market_id,
        "supplier": o.supplier,
        "contact_person": o.contact_person,
        "phone": o.phone,
        "status": o.status,
        "items_json": json.loads(o.items_json or "[]"),
        "comment": o.comment or "",
        "created_at": o.created_at,
    }