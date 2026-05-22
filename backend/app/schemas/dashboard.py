from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class KPICard(BaseModel):
    label: str
    value: float
    unit: str = "RM"
    change_percent: Optional[float] = None
    trend: Optional[str] = None

class DashboardOwner(BaseModel):
    kpi_cards: List[KPICard]
    top_suppliers: List[dict]
    stock_health: dict
    ai_insights: List[dict]
    suspicious_alerts: List[dict]

class DashboardAdmin(BaseModel):
    stock_status: List[dict]
    reorder_checklist: List[dict]
    pending_invoices: List[dict]
    recent_movements: List[dict]
    today_summary: dict

class AIInsightResponse(BaseModel):
    id: int
    insight_type: str
    title: str
    content_bm: str
    content_en: str
    severity: str
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True
