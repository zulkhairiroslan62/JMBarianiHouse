from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class InventoryCategory(str, enum.Enum):
    BASAH = "basah"
    KERING = "kering"
    MINUMAN = "minuman"
    LAIN_LAIN = "lain-lain"

class MovementType(str, enum.Enum):
    STOCK_IN = "stock_in"
    STOCK_OUT = "stock_out"
    ADJUSTMENT = "adjustment"
    WASTE = "waste"

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    sku = Column(String(100), nullable=True, unique=True)
    category = Column(SQLEnum(InventoryCategory), nullable=False, index=True)
    unit = Column(String(50), nullable=False)
    current_stock = Column(Float, default=0.0)
    reorder_level = Column(Float, default=0.0)
    max_stock = Column(Float, nullable=True)
    weighted_avg_cost = Column(Float, default=0.0)
    last_purchase_price = Column(Float, default=0.0)
    expiry_date = Column(DateTime, nullable=True)
    shelf_life_days = Column(Integer, nullable=True)
    avg_daily_usage = Column(Float, default=0.0)
    days_of_stock = Column(Float, default=0.0)
    is_below_reorder = Column(Boolean, default=False)
    primary_supplier = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    movements = relationship("StockMovement", back_populates="inventory_item", cascade="all, delete-orphan")

class StockMovement(Base):
    __tablename__ = "stock_movements"
    id = Column(Integer, primary_key=True, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    movement_type = Column(SQLEnum(MovementType), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=True)
    total_cost = Column(Float, nullable=True)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    inventory_item = relationship("InventoryItem", back_populates="movements")
