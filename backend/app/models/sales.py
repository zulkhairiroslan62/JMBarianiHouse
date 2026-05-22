from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum as SQLEnum, Boolean
from sqlalchemy.sql import func
from app.database import Base
import enum

class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    EWALLET = "ewallet"
    ONLINE = "online"
    OTHER = "other"

class SuspicionSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class SalesTransaction(Base):
    __tablename__ = "sales_transactions"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(100), unique=True, index=True)
    transaction_date = Column(DateTime, nullable=False, index=True)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0.0)
    payment_method = Column(SQLEnum(PaymentMethod), default=PaymentMethod.CASH)
    cashier_name = Column(String(100), nullable=True)
    receipt_number = Column(String(100), nullable=True)
    is_void = Column(Boolean, default=False)
    is_refund = Column(Boolean, default=False)
    void_reason = Column(String(255), nullable=True)
    source = Column(String(50), default="manual")
    batch_upload_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SuspiciousTransaction(Base):
    __tablename__ = "suspicious_transactions"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("sales_transactions.id"), nullable=True)
    severity = Column(SQLEnum(SuspicionSeverity), nullable=False, index=True)
    reason = Column(String(500), nullable=False)
    details = Column(Text, nullable=True)
    cashier_name = Column(String(100), nullable=True)
    amount = Column(Float, nullable=True)
    transaction_date = Column(DateTime, nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
