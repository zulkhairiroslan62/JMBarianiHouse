from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ReportRequest(BaseModel):
    report_type: str
    date_from: datetime
    date_to: datetime
    format: str = "pdf"

class ReportResponse(BaseModel):
    id: int
    report_type: str
    title: str
    format: str
    date_from: datetime
    date_to: datetime
    filepath: Optional[str] = None
    executive_summary: Optional[str] = None
    generated_by: int
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True
