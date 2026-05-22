from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.sales import PaymentMethod, SuspicionSeverity

class SalesTransactionResponse(BaseModel):
    id: int
    transaction_id: str
    transaction_date: datetime
    item_name: str
    quantity: float
    unit_price: float
    total_price: float
    discount_amount: float
    payment_method: PaymentMethod
    cashier_name: Optional[str] = None
    receipt_number: Optional[str] = None
    is_void: bool
    is_refund: bool
    source: str
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class SuspiciousTransactionResponse(BaseModel):
    id: int
    transaction_id: Optional[int] = None
    severity: SuspicionSeverity
    reason: str
    details: Optional[str] = None
    cashier_name: Optional[str] = None
    amount: Optional[float] = None
    transaction_date: Optional[datetime] = None
    is_resolved: bool
    resolved_by: Optional[int] = None
    resolution_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class SalesUploadResponse(BaseModel):
    total_records: int
    new_records: int
    duplicates_skipped: int
    suspicious_detected: int
    batch_id: str

class SalesSummary(BaseModel):
    total_sales: float
    total_transactions: int
    avg_transaction_value: float
    top_items: List[dict]
    payment_breakdown: dict
    void_count: int
    refund_count: int
