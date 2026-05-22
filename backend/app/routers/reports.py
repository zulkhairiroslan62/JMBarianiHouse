from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
from app.database import get_db
from app.models.user import User
from app.models.report import Report
from app.schemas.report import ReportRequest, ReportResponse
from app.utils.auth import get_current_user

router = APIRouter()

@router.post("/generate", response_model=ReportResponse)
def generate_report(request: ReportRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.report_service import generate_report_file
    return generate_report_file(db, request, current_user.id)

@router.get("/", response_model=List[ReportResponse])
def list_reports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Report).order_by(Report.created_at.desc()).limit(50).all()

@router.get("/{report_id}/download")
def download_report(report_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report or not report.filepath or not os.path.exists(report.filepath):
        raise HTTPException(status_code=404, detail="Report file not found")
    media_type = "application/pdf" if report.format == "pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return FileResponse(path=report.filepath, media_type=media_type, filename=f"{report.title}.{report.format}")
