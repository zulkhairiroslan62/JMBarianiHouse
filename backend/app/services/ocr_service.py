"""Invoice OCR Service using Claude API."""
import base64, json
from sqlalchemy.orm import Session
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus
from app.config import settings

def process_invoice_ocr(db: Session, invoice_id: int):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found")
    invoice.status = InvoiceStatus.PROCESSING
    db.commit()
    with open(invoice.stored_filepath, "rb") as f:
        file_data = base64.standard_b64encode(f.read()).decode("utf-8")
    media_type_map = {"pdf": "application/pdf", "jpg": "image/jpeg", "png": "image/png"}
    media_type = media_type_map.get(invoice.file_type, "application/octet-stream")
    if not settings.ANTHROPIC_API_KEY:
        invoice.status = InvoiceStatus.NEEDS_REVIEW
        db.commit()
        return
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    prompt = """Analyze this invoice/receipt and extract in JSON:
{"invoice_number": "str|null", "supplier_name": "str|null", "invoice_date": "YYYY-MM-DD|null", "total_amount": number|null, "tax_amount": number|null, "items": [{"item_name": "str", "quantity": number, "unit": "kg/pcs/litre/box/packet|null", "unit_price": number, "total_price": number, "category": "basah/kering/minuman/lain-lain"}]}
Return ONLY valid JSON."""
    try:
        message = client.messages.create(model="claude-sonnet-4-20250514", max_tokens=4096, messages=[{"role": "user", "content": [{"type": "image", "source": {"type": "base64", "media_type": media_type, "data": file_data}}, {"type": "text", "text": prompt}]}])
        response_text = message.content[0].text
        invoice.raw_ocr_text = response_text
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        data = json.loads(response_text.strip())
        invoice.invoice_number = data.get("invoice_number")
        invoice.supplier_name = data.get("supplier_name")
        if data.get("invoice_date"):
            from datetime import datetime
            try:
                invoice.invoice_date = datetime.strptime(data["invoice_date"], "%Y-%m-%d")
            except ValueError:
                pass
        invoice.total_amount = data.get("total_amount")
        invoice.tax_amount = data.get("tax_amount", 0)
        invoice.ocr_confidence = 0.85
        for item_data in data.get("items", []):
            db.add(InvoiceItem(invoice_id=invoice.id, item_name=item_data.get("item_name", "Unknown"), quantity=item_data.get("quantity", 1), unit=item_data.get("unit"), unit_price=item_data.get("unit_price", 0), total_price=item_data.get("total_price", 0), category=item_data.get("category")))
        # Duplicate check
        if invoice.invoice_number and invoice.supplier_name:
            existing = db.query(Invoice).filter(Invoice.id != invoice.id, Invoice.invoice_number == invoice.invoice_number, Invoice.supplier_name == invoice.supplier_name).first()
            if existing:
                if existing.total_amount and invoice.total_amount and abs(existing.total_amount - invoice.total_amount) < 0.01:
                    invoice.is_duplicate = 2
                else:
                    invoice.is_duplicate = 1
                invoice.duplicate_of_id = existing.id
        invoice.status = InvoiceStatus.NEEDS_REVIEW
        db.commit()
    except Exception as e:
        invoice.status = InvoiceStatus.NEEDS_REVIEW
        invoice.raw_ocr_text = f"OCR Error: {str(e)}"
        db.commit()
        raise
