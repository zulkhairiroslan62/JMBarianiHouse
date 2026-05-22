from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.database import Base

class AIInsight(Base):
    __tablename__ = "ai_insights"
    id = Column(Integer, primary_key=True, index=True)
    insight_type = Column(String(50), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    content_bm = Column(Text, nullable=False)
    content_en = Column(Text, nullable=False)
    severity = Column(String(20), default="info")
    is_current = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
