from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.invoice import InvoiceStatus

class InvoiceItemSchema(BaseModel):
    id: Optional[int] = None
    item_name: str
    quantity: float
    unit: Optional[str] = None
    unit_price: float
    total_price: float
    category: Optional[str] = None
    inventory_item_id: Optional[int] = None

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: Optional[str] = None
    supplier_name: Optional[str] = None
    invoice_date: Optional[datetime] = None
    total_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    status: InvoiceStatus
    original_filename: str
    file_type: str
    ocr_confidence: Optional[float] = None
    is_duplicate: int
    notes: Optional[str] = None
    uploaded_by: int
    confirmed_by: Optional[int] = None
    created_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    items: List[InvoiceItemSchema] = []
    class Config:
        from_attributes = True

class InvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    supplier_name: Optional[str] = None
    invoice_date: Optional[datetime] = None
    total_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    notes: Optional[str] = None
    items: Optional[List[InvoiceItemSchema]] = None

class InvoiceListResponse(BaseModel):
    invoices: List[InvoiceResponse]
    total: int
    page: int
    page_size: int
