from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class InvoiceStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    NEEDS_REVIEW = "needs_review"
    CONFIRMED = "confirmed"
    PROCESSED = "processed"

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), nullable=True, index=True)
    supplier_name = Column(String(255), nullable=True, index=True)
    invoice_date = Column(DateTime, nullable=True)
    total_amount = Column(Float, nullable=True)
    tax_amount = Column(Float, default=0.0)
    status = Column(SQLEnum(InvoiceStatus), default=InvoiceStatus.UPLOADED, index=True)
    original_filename = Column(String(500), nullable=False)
    stored_filepath = Column(String(500), nullable=False)
    file_type = Column(String(10), nullable=False)
    raw_ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    is_duplicate = Column(Integer, default=0)
    duplicate_of_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    confirmed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(50), nullable=True)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    category = Column(String(50), nullable=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=True)
    invoice = relationship("Invoice", back_populates="items")
