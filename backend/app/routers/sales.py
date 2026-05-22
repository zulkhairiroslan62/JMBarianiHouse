from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from app.database import get_db
from app.models.user import User
from app.models.sales import SalesTransaction, SuspiciousTransaction
from app.schemas.sales import SalesTransactionResponse, SuspiciousTransactionResponse, SalesUploadResponse, SalesSummary
from app.utils.auth import get_current_user

router = APIRouter()

@router.post("/upload", response_model=SalesUploadResponse)
async def upload_sales_data(file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel")
    content = await file.read()
    batch_id = str(uuid.uuid4())[:8]
    from app.services.sales_service import parse_sales_file
    return parse_sales_file(db, content, file.filename, batch_id, current_user.id)

@router.get("/transactions", response_model=List[SalesTransactionResponse])
def list_transactions(date_from: Optional[str] = None, date_to: Optional[str] = None, cashier: Optional[str] = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(SalesTransaction)
    if date_from:
        query = query.filter(SalesTransaction.transaction_date >= date_from)
    if date_to:
        query = query.filter(SalesTransaction.transaction_date <= date_to)
    if cashier:
        query = query.filter(SalesTransaction.cashier_name.ilike(f"%{cashier}%"))
    return query.order_by(SalesTransaction.transaction_date.desc()).offset((page - 1) * page_size).limit(page_size).all()

@router.get("/summary", response_model=SalesSummary)
def get_sales_summary(date_from: Optional[str] = None, date_to: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.sales_service import calculate_sales_summary
    return calculate_sales_summary(db, date_from, date_to)

@router.get("/suspicious", response_model=List[SuspiciousTransactionResponse])
def list_suspicious(severity: Optional[str] = None, is_resolved: Optional[bool] = None, limit: int = Query(50), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(SuspiciousTransaction)
    if severity:
        query = query.filter(SuspiciousTransaction.severity == severity)
    if is_resolved is not None:
        query = query.filter(SuspiciousTransaction.is_resolved == is_resolved)
    return query.order_by(SuspiciousTransaction.created_at.desc()).limit(limit).all()

@router.put("/suspicious/{alert_id}/resolve")
def resolve_suspicious(alert_id: int, resolution_notes: str = "", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alert = db.query(SuspiciousTransaction).filter(SuspiciousTransaction.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_by = current_user.id
    alert.resolution_notes = resolution_notes
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Alert resolved"}

@router.post("/fetch-acepos")
def trigger_acepos_fetch(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.acepos_service import fetch_acepos_data
    try:
        result = fetch_acepos_data(db)
        return {"message": "AcePOS data fetched", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
