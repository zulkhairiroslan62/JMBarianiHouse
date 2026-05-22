"""AI Smart Monitoring Service using Claude API."""
import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.inventory import InventoryItem, StockMovement, MovementType
from app.models.invoice import Invoice, InvoiceStatus
from app.models.sales import SalesTransaction, SuspiciousTransaction
from app.models.ai_insight import AIInsight
from app.config import settings

def generate_insights(db: Session):
    db.query(AIInsight).filter(AIInsight.is_current == True).update({"is_current": False})
    db.commit()
    context = _gather_context(db)
    if not settings.ANTHROPIC_API_KEY:
        _generate_fallback_insights(db, context)
        return
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    prompt = f"""You are a BI assistant for JM Bariani House (Malaysian restaurant). Analyze 7-day data:
{json.dumps(context, indent=2, default=str)}
Generate 5 insights as JSON array: [{{"insight_type":"stock|spending|supplier|sales|waste","title":"Short title","content_bm":"BM insight","content_en":"EN insight","severity":"info|warning|critical"}}]
Return ONLY JSON."""
    try:
        message = client.messages.create(model="claude-sonnet-4-20250514", max_tokens=2048, messages=[{"role": "user", "content": prompt}])
        text = message.content[0].text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        expires = datetime.now(timezone.utc) + timedelta(hours=6)
        for i in json.loads(text.strip()):
            db.add(AIInsight(insight_type=i.get("insight_type","info"), title=i.get("title","Insight"), content_bm=i.get("content_bm",""), content_en=i.get("content_en",""), severity=i.get("severity","info"), is_current=True, expires_at=expires))
        db.commit()
    except Exception:
        _generate_fallback_insights(db, context)



def _gather_context(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    items = db.query(InventoryItem).all()
    inventory_data = [{"name": i.name, "stock": i.current_stock, "unit": i.unit, "reorder_level": i.reorder_level, "days_left": round(i.days_of_stock, 1)} for i in items]
    opex_this_week = float(db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PROCESSED]), Invoice.confirmed_at >= seven_days_ago).scalar() or 0)
    opex_last_week = float(db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PROCESSED]), Invoice.confirmed_at >= now - timedelta(days=14), Invoice.confirmed_at < seven_days_ago).scalar() or 0)
    sales_this_week = float(db.query(func.coalesce(func.sum(SalesTransaction.total_price), 0)).filter(SalesTransaction.transaction_date >= seven_days_ago, SalesTransaction.is_void == False).scalar() or 0)
    suppliers = [{"name": s[0], "invoices": s[1], "total": float(s[2] or 0)} for s in db.query(Invoice.supplier_name, func.count(Invoice.id), func.sum(Invoice.total_amount)).filter(Invoice.confirmed_at >= seven_days_ago, Invoice.supplier_name != None).group_by(Invoice.supplier_name).all()]
    return {"inventory": inventory_data, "opex_this_week": opex_this_week, "opex_last_week": opex_last_week, "sales_this_week": sales_this_week, "suppliers": suppliers}

def _generate_fallback_insights(db: Session, context: dict):
    expires = datetime.now(timezone.utc) + timedelta(hours=6)
    low_items = [i for i in context.get("inventory", []) if i["days_left"] < 3 and i["stock"] > 0]
    if low_items:
        names = ", ".join([f"{i['name']} ({i['days_left']}d)" for i in low_items[:3]])
        db.add(AIInsight(insight_type="stock", title="Low Stock Alert", content_bm=f"Stok rendah: {names}", content_en=f"Low stock: {names}", severity="warning", is_current=True, expires_at=expires))
    opex_curr, opex_prev = context.get("opex_this_week", 0), context.get("opex_last_week", 0)
    if opex_prev > 0:
        change = ((opex_curr - opex_prev) / opex_prev) * 100
        if abs(change) > 20:
            db.add(AIInsight(insight_type="spending", title="OPEX Change", content_bm=f"OPEX minggu ini {'naik' if change > 0 else 'turun'} {abs(change):.0f}%", content_en=f"OPEX {'increased' if change > 0 else 'decreased'} {abs(change):.0f}% this week", severity="warning", is_current=True, expires_at=expires))
    sales = context.get("sales_this_week", 0)
    if sales > 0:
        db.add(AIInsight(insight_type="sales", title="Weekly Sales", content_bm=f"Jualan minggu ini: RM{sales:.0f}", content_en=f"This week's sales: RM{sales:.0f}", severity="info", is_current=True, expires_at=expires))
    if not low_items and opex_prev == 0 and sales == 0:
        db.add(AIInsight(insight_type="info", title="System Ready", content_bm="Sistem berjalan normal.", content_en="System running normally.", severity="info", is_current=True, expires_at=expires))
    db.commit()

def get_ai_response_for_query(db: Session, query: str) -> str:
    context = _gather_context(db)
    if not settings.ANTHROPIC_API_KEY:
        query_lower = query.lower()
        if "stok" in query_lower or "stock" in query_lower:
            items = context.get("inventory", [])
            for item in items:
                if any(w in item["name"].lower() for w in query_lower.split()):
                    return f"{item['name']}: {item['stock']} {item['unit']} (cukup {item['days_left']} hari)"
            return "Tiada data stok khusus"
        if "sales" in query_lower or "jualan" in query_lower:
            return f"Jualan minggu ini: RM{context.get('sales_this_week', 0):.0f}"
        return "Maaf, saya tak faham. Cuba: 'stok ayam?', 'sales semalam?'"
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        message = client.messages.create(model="claude-sonnet-4-20250514", max_tokens=300, messages=[{"role": "user", "content": f"You are WhatsApp assistant for JM Bariani House. Answer SHORT (max 3 lines). Data: {json.dumps(context, default=str)}\nQuery: {query}"}])
        return message.content[0].text
    except Exception:
        return "Maaf, sistem sedang sibuk. Cuba lagi."
