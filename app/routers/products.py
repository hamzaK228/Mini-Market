"""Products CRUD router."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, Owner
from app.schemas import ProductCreate, ProductOut
from app.middleware import get_current_owner

router = APIRouter(prefix="/api/v1/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    rows = db.query(Product).filter(Product.owner_id == owner.id).order_by(Product.category, Product.name).all()
    return rows


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductCreate, owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    p = Product(
        owner_id=owner.id,
        name=body.name,
        category=body.category,
        buy_price=body.buy_price,
        sell_price=body.sell_price,
        supplier=body.supplier,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{product_id}")
def delete_product(product_id: int, owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id, Product.owner_id == owner.id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товар не найден")
    db.delete(p)
    db.commit()
    return {"message": "Товар удален"}