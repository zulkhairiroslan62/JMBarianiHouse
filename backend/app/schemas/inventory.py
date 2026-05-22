from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.inventory import InventoryCategory, MovementType

class InventoryItemCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    category: InventoryCategory
    unit: str
    current_stock: float = 0.0
    reorder_level: float = 0.0
    max_stock: Optional[float] = None
    primary_supplier: Optional[str] = None

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[InventoryCategory] = None
    unit: Optional[str] = None
    reorder_level: Optional[float] = None
    max_stock: Optional[float] = None
    primary_supplier: Optional[str] = None

class InventoryItemResponse(BaseModel):
    id: int
    name: str
    sku: Optional[str] = None
    category: InventoryCategory
    unit: str
    current_stock: float
    reorder_level: float
    max_stock: Optional[float] = None
    weighted_avg_cost: float
    last_purchase_price: float
    avg_daily_usage: float
    days_of_stock: float
    is_below_reorder: bool
    primary_supplier: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class StockMovementCreate(BaseModel):
    inventory_item_id: int
    movement_type: MovementType
    quantity: float
    unit_cost: Optional[float] = None
    notes: Optional[str] = None

class StockMovementResponse(BaseModel):
    id: int
    inventory_item_id: int
    movement_type: MovementType
    quantity: float
    unit_cost: Optional[float] = None
    total_cost: Optional[float] = None
    reference_type: Optional[str] = None
    notes: Optional[str] = None
    performed_by: int
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class StockAlertResponse(BaseModel):
    item: InventoryItemResponse
    alert_type: str
    message: str
