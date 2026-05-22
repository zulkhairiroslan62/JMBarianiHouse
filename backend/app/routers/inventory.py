from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models.user import User
from app.models.inventory import InventoryItem, StockMovement, MovementType
from app.schemas.inventory import InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse, StockMovementCreate, StockMovementResponse, StockAlertResponse
from app.utils.auth import get_current_user

router = APIRouter()

@router.get("/items", response_model=List[InventoryItemResponse])
def list_inventory(category: Optional[str] = None, search: Optional[str] = None, below_reorder: Optional[bool] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(InventoryItem)
    if category:
        query = query.filter(InventoryItem.category == category)
    if search:
        query = query.filter(InventoryItem.name.ilike(f"%{search}%"))
    if below_reorder:
        query = query.filter(InventoryItem.is_below_reorder == True)
    return query.order_by(InventoryItem.name).all()

@router.post("/items", response_model=InventoryItemResponse)
def create_inventory_item(request: InventoryItemCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = InventoryItem(**request.model_dump())
    item.is_below_reorder = item.current_stock <= item.reorder_level
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.get("/items/{item_id}", response_model=InventoryItemResponse)
def get_inventory_item(item_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.put("/items/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(item_id: int, request: InventoryItemUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.is_below_reorder = item.current_stock <= item.reorder_level
    db.commit()
    db.refresh(item)
    return item

@router.delete("/items/{item_id}")
def delete_inventory_item(item_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted"}



@router.post("/movements", response_model=StockMovementResponse)
def create_stock_movement(request: StockMovementCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == request.inventory_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    qty = request.quantity
    if request.movement_type in [MovementType.STOCK_OUT, MovementType.WASTE]:
        qty = -abs(qty)
    else:
        qty = abs(qty)
    total_cost = (request.unit_cost or 0) * abs(request.quantity)
    movement = StockMovement(inventory_item_id=request.inventory_item_id, movement_type=request.movement_type, quantity=qty, unit_cost=request.unit_cost, total_cost=total_cost, reference_type="manual", notes=request.notes, performed_by=current_user.id)
    db.add(movement)
    item.current_stock += qty
    if item.current_stock < 0:
        item.current_stock = 0
    if request.movement_type == MovementType.STOCK_IN and request.unit_cost:
        old_total = item.weighted_avg_cost * (item.current_stock - qty)
        new_total = old_total + (request.unit_cost * abs(request.quantity))
        if item.current_stock > 0:
            item.weighted_avg_cost = new_total / item.current_stock
        item.last_purchase_price = request.unit_cost
    item.is_below_reorder = item.current_stock <= item.reorder_level
    if item.avg_daily_usage > 0:
        item.days_of_stock = item.current_stock / item.avg_daily_usage
    db.commit()
    db.refresh(movement)
    return movement

@router.get("/movements", response_model=List[StockMovementResponse])
def list_movements(item_id: Optional[int] = None, movement_type: Optional[str] = None, limit: int = Query(50, ge=1, le=200), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(StockMovement)
    if item_id:
        query = query.filter(StockMovement.inventory_item_id == item_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    return query.order_by(StockMovement.created_at.desc()).limit(limit).all()

@router.get("/alerts", response_model=List[StockAlertResponse])
def get_stock_alerts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alerts = []
    below_reorder = db.query(InventoryItem).filter(InventoryItem.is_below_reorder == True, InventoryItem.current_stock > 0).all()
    for item in below_reorder:
        alerts.append(StockAlertResponse(item=InventoryItemResponse.model_validate(item), alert_type="below_reorder", message=f"{item.name}: {item.current_stock} {item.unit} remaining (reorder at {item.reorder_level})"))
    out_of_stock = db.query(InventoryItem).filter(InventoryItem.current_stock <= 0).all()
    for item in out_of_stock:
        alerts.append(StockAlertResponse(item=InventoryItemResponse.model_validate(item), alert_type="out_of_stock", message=f"{item.name}: OUT OF STOCK"))
    three_days = datetime.now(timezone.utc) + timedelta(days=3)
    expiring = db.query(InventoryItem).filter(InventoryItem.expiry_date != None, InventoryItem.expiry_date <= three_days, InventoryItem.current_stock > 0).all()
    for item in expiring:
        alerts.append(StockAlertResponse(item=InventoryItemResponse.model_validate(item), alert_type="expiring_soon", message=f"{item.name}: Expiring on {item.expiry_date.strftime('%d/%m/%Y')}"))
    return alerts
