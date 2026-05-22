from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models.user import User
from app.models.invoice import Invoice, InvoiceStatus
from app.models.inventory import InventoryItem, StockMovement
from app.models.sales import SalesTransaction, SuspiciousTransaction
from app.models.ai_insight import AIInsight
from app.utils.auth import get_current_user

router = APIRouter()

@router.get("/owner")
def get_owner_dashboard(period: str = Query("weekly"), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=7 if period == "weekly" else 30)
    prev_start = now - timedelta(days=14 if period == "weekly" else 60)
    total_opex = float(db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PROCESSED]), Invoice.confirmed_at >= start_date).scalar() or 0)
    prev_opex = float(db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PROCESSED]), Invoice.confirmed_at >= prev_start, Invoice.confirmed_at < start_date).scalar() or 0)
    total_sales = float(db.query(func.coalesce(func.sum(SalesTransaction.total_price), 0)).filter(SalesTransaction.transaction_date >= start_date, SalesTransaction.is_void == False).scalar() or 0)
    prev_sales = float(db.query(func.coalesce(func.sum(SalesTransaction.total_price), 0)).filter(SalesTransaction.transaction_date >= prev_start, SalesTransaction.transaction_date < start_date, SalesTransaction.is_void == False).scalar() or 0)
    gross_profit = total_sales - total_opex
    total_waste = float(db.query(func.coalesce(func.sum(StockMovement.total_cost), 0)).filter(StockMovement.movement_type == "waste", StockMovement.created_at >= start_date).scalar() or 0)
    waste_pct = (total_waste / total_opex * 100) if total_opex > 0 else 0
    def calc_change(c, p):
        return round(((c - p) / p) * 100, 1) if p > 0 else 0
    kpi_cards = [
        {"label": "Total OPEX", "value": round(total_opex, 2), "unit": "RM", "change_percent": calc_change(total_opex, prev_opex), "trend": "up" if total_opex > prev_opex else "down"},
        {"label": "Total Sales", "value": round(total_sales, 2), "unit": "RM", "change_percent": calc_change(total_sales, prev_sales), "trend": "up" if total_sales > prev_sales else "down"},
        {"label": "Gross Profit", "value": round(gross_profit, 2), "unit": "RM", "change_percent": None, "trend": "up" if gross_profit > 0 else "down"},
        {"label": "Waste %", "value": round(waste_pct, 1), "unit": "%", "change_percent": None, "trend": "stable"},
    ]
    top_suppliers = [{"name": s[0] or "Unknown", "spend": round(float(s[1]), 2)} for s in db.query(Invoice.supplier_name, func.sum(Invoice.total_amount)).filter(Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PROCESSED]), Invoice.supplier_name != None).group_by(Invoice.supplier_name).order_by(func.sum(Invoice.total_amount).desc()).limit(10).all()]
    total_items = db.query(InventoryItem).count()
    healthy = db.query(InventoryItem).filter(InventoryItem.is_below_reorder == False, InventoryItem.current_stock > 0).count()
    low_stock = db.query(InventoryItem).filter(InventoryItem.is_below_reorder == True, InventoryItem.current_stock > 0).count()
    out_of_stock = db.query(InventoryItem).filter(InventoryItem.current_stock <= 0).count()
    insights = db.query(AIInsight).filter(AIInsight.is_current == True).order_by(AIInsight.created_at.desc()).limit(5).all()
    insights_data = [{"id": i.id, "type": i.insight_type, "title": i.title, "content_bm": i.content_bm, "content_en": i.content_en, "severity": i.severity} for i in insights]
    suspicious = db.query(SuspiciousTransaction).filter(SuspiciousTransaction.is_resolved == False).order_by(SuspiciousTransaction.created_at.desc()).limit(10).all()
    suspicious_data = [{"id": s.id, "severity": s.severity.value, "reason": s.reason, "amount": s.amount, "cashier": s.cashier_name, "date": s.transaction_date.isoformat() if s.transaction_date else None} for s in suspicious]
    return {"kpi_cards": kpi_cards, "opex_vs_sales": [], "top_suppliers": top_suppliers, "stock_health": {"total": total_items, "healthy": healthy, "low_stock": low_stock, "out_of_stock": out_of_stock}, "ai_insights": insights_data, "suspicious_alerts": suspicious_data}



@router.get("/admin")
def get_admin_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    items = db.query(InventoryItem).order_by(InventoryItem.name).all()
    stock_status = []
    for item in items:
        color = "red" if item.current_stock <= 0 else ("yellow" if item.is_below_reorder else "green")
        stock_status.append({"id": item.id, "name": item.name, "stock": item.current_stock, "unit": item.unit, "reorder_level": item.reorder_level, "days_left": round(item.days_of_stock, 1), "color": color, "category": item.category.value if item.category else None})
    reorder = [s for s in stock_status if s["color"] in ["red", "yellow"]]
    pending = db.query(Invoice).filter(Invoice.status.in_([InvoiceStatus.UPLOADED, InvoiceStatus.NEEDS_REVIEW, InvoiceStatus.PROCESSING])).order_by(Invoice.created_at.desc()).limit(10).all()
    pending_data = [{"id": inv.id, "supplier": inv.supplier_name, "amount": inv.total_amount, "status": inv.status.value, "filename": inv.original_filename, "date": inv.created_at.isoformat() if inv.created_at else None} for inv in pending]
    movements = db.query(StockMovement).order_by(StockMovement.created_at.desc()).limit(15).all()
    movements_data = [{"id": m.id, "item_id": m.inventory_item_id, "type": m.movement_type.value, "quantity": m.quantity, "notes": m.notes, "date": m.created_at.isoformat() if m.created_at else None} for m in movements]
    today_sales = float(db.query(func.coalesce(func.sum(SalesTransaction.total_price), 0)).filter(SalesTransaction.transaction_date >= today_start, SalesTransaction.is_void == False).scalar() or 0)
    today_transactions = db.query(SalesTransaction).filter(SalesTransaction.transaction_date >= today_start).count()
    return {"stock_status": stock_status, "reorder_checklist": reorder, "pending_invoices": pending_data, "recent_movements": movements_data, "today_summary": {"sales": round(today_sales, 2), "transactions": today_transactions, "pending_invoices": len(pending_data), "low_stock_items": len(reorder)}}

@router.get("/insights")
def get_ai_insights(refresh: bool = False, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if refresh:
        from app.services.ai_service import generate_insights
        try:
            generate_insights(db)
        except Exception:
            pass
    insights = db.query(AIInsight).filter(AIInsight.is_current == True).order_by(AIInsight.created_at.desc()).limit(5).all()
    return [{"id": i.id, "type": i.insight_type, "title": i.title, "content_bm": i.content_bm, "content_en": i.content_en, "severity": i.severity, "created_at": i.created_at.isoformat() if i.created_at else None} for i in insights]
