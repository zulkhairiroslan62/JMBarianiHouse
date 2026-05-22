"""WhatsApp Integration Service."""
import httpx
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.inventory import InventoryItem
from app.models.sales import SalesTransaction
from app.models.invoice import Invoice, InvoiceStatus
from app.config import settings

def send_whatsapp_message(phone: str, message: str) -> dict:
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        raise ValueError("WhatsApp API not configured")
    url = f"https://graph.facebook.com/v18.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}", "Content-Type": "application/json"}
    payload = {"messaging_product": "whatsapp", "to": phone, "type": "text", "text": {"body": message}}
    with httpx.Client(timeout=15) as client:
        return client.post(url, json=payload, headers=headers).json()

def handle_incoming_message(db: Session, webhook_body: dict) -> str:
    try:
        messages = webhook_body.get("entry", [{}])[0].get("changes", [{}])[0].get("value", {}).get("messages", [])
        if not messages:
            return "No message"
        from_number = messages[0].get("from", "")
        text = messages[0].get("text", {}).get("body", "")
        if not text:
            return "Empty message"
        from app.services.ai_service import get_ai_response_for_query
        response = get_ai_response_for_query(db, text)
        try:
            send_whatsapp_message(from_number, response)
        except Exception:
            pass
        return response
    except Exception as e:
        return f"Error: {str(e)}"

def send_daily_summary(db: Session):
    now = datetime.now(timezone.utc)
    yesterday = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0)
    sales = float(db.query(func.coalesce(func.sum(SalesTransaction.total_price), 0)).filter(SalesTransaction.transaction_date >= yesterday, SalesTransaction.is_void == False).scalar() or 0)
    pending = db.query(Invoice).filter(Invoice.status.in_([InvoiceStatus.UPLOADED, InvoiceStatus.NEEDS_REVIEW])).count()
    low_stock = db.query(InventoryItem).filter(InventoryItem.is_below_reorder == True).count()
    return f"Summary {now.strftime('%d/%m/%Y')}: Sales RM{sales:,.0f}, {pending} invois pending, {low_stock} stok rendah"
