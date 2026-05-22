"""Sales Service - CSV/Excel parsing and suspicious detection."""
import io, uuid
from datetime import datetime, timezone
from collections import Counter, defaultdict
from sqlalchemy.orm import Session
from app.models.sales import SalesTransaction, SuspiciousTransaction, PaymentMethod, SuspicionSeverity
from app.schemas.sales import SalesUploadResponse, SalesSummary

def parse_sales_file(db: Session, content: bytes, filename: str, batch_id: str, user_id: int) -> SalesUploadResponse:
    import pandas as pd
    df = pd.read_csv(io.BytesIO(content)) if filename.endswith('.csv') else pd.read_excel(io.BytesIO(content))
    df.columns = df.columns.str.strip().str.lower()
    col_map = {'date': 'transaction_date', 'datetime': 'transaction_date', 'item': 'item_name', 'product': 'item_name', 'description': 'item_name', 'qty': 'quantity', 'quantity': 'quantity', 'price': 'unit_price', 'total': 'total_price', 'amount': 'total_price', 'discount': 'discount_amount', 'payment': 'payment_method', 'cashier': 'cashier_name', 'staff': 'cashier_name', 'receipt': 'receipt_number'}
    df = df.rename(columns=col_map)
    total_records, new_records, duplicates_skipped = len(df), 0, 0
    for _, row in df.iterrows():
        txn_id = str(row.get('transaction_id', f"TXN-{batch_id}-{uuid.uuid4().hex[:8]}"))
        if db.query(SalesTransaction).filter(SalesTransaction.transaction_id == txn_id).first():
            duplicates_skipped += 1
            continue
        txn_date = None
        date_val = row.get('transaction_date')
        if date_val is not None:
            try:
                if isinstance(date_val, str):
                    for fmt in ["%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M", "%Y-%m-%d", "%d/%m/%Y"]:
                        try:
                            txn_date = datetime.strptime(date_val.strip(), fmt)
                            break
                        except ValueError:
                            continue
                elif hasattr(date_val, 'to_pydatetime'):
                    txn_date = date_val.to_pydatetime()
            except Exception:
                pass
        if txn_date is None:
            txn_date = datetime.now(timezone.utc)
        payment_str = str(row.get('payment_method', 'cash')).lower().strip()
        payment_map = {'cash': PaymentMethod.CASH, 'card': PaymentMethod.CARD, 'ewallet': PaymentMethod.EWALLET, 'online': PaymentMethod.ONLINE}
        payment_method = payment_map.get(payment_str, PaymentMethod.OTHER)
        item_name = str(row.get('item_name', 'Unknown'))
        is_void = 'void' in item_name.lower()
        is_refund = 'refund' in item_name.lower()
        txn = SalesTransaction(transaction_id=txn_id, transaction_date=txn_date, item_name=item_name, quantity=float(row.get('quantity', 1) or 1), unit_price=float(row.get('unit_price', 0) or 0), total_price=float(row.get('total_price', 0) or 0), discount_amount=float(row.get('discount_amount', 0) or 0), payment_method=payment_method, cashier_name=str(row.get('cashier_name', '')) if row.get('cashier_name') else None, receipt_number=str(row.get('receipt_number', '')) if row.get('receipt_number') else None, is_void=is_void, is_refund=is_refund, source="acepos_csv", batch_upload_id=batch_id)
        db.add(txn)
        new_records += 1
    db.commit()
    suspicious_count = detect_suspicious_transactions(db, batch_id)
    return SalesUploadResponse(total_records=total_records, new_records=new_records, duplicates_skipped=duplicates_skipped, suspicious_detected=suspicious_count, batch_id=batch_id)



def detect_suspicious_transactions(db: Session, batch_id: str = None) -> int:
    count = 0
    query = db.query(SalesTransaction)
    if batch_id:
        query = query.filter(SalesTransaction.batch_upload_id == batch_id)
    transactions = query.all()
    for txn in transactions:
        if txn.discount_amount > 0 and txn.total_price > 0:
            discount_pct = txn.discount_amount / (txn.total_price + txn.discount_amount) * 100
            if discount_pct > 30:
                db.add(SuspiciousTransaction(transaction_id=txn.id, severity=SuspicionSeverity.MEDIUM, reason="Diskaun luar biasa tinggi", details=f"Discount {discount_pct:.0f}%", cashier_name=txn.cashier_name, amount=txn.total_price, transaction_date=txn.transaction_date))
                count += 1
        if txn.is_void:
            db.add(SuspiciousTransaction(transaction_id=txn.id, severity=SuspicionSeverity.LOW, reason="Transaksi void", details=f"Void: {txn.item_name} RM{txn.total_price}", cashier_name=txn.cashier_name, amount=txn.total_price, transaction_date=txn.transaction_date))
            count += 1
        if txn.transaction_date and (txn.transaction_date.hour < 8 or txn.transaction_date.hour > 23):
            db.add(SuspiciousTransaction(transaction_id=txn.id, severity=SuspicionSeverity.HIGH, reason="Transaksi di luar waktu operasi", details=f"At {txn.transaction_date.strftime('%H:%M')}", cashier_name=txn.cashier_name, amount=txn.total_price, transaction_date=txn.transaction_date))
            count += 1
        if txn.payment_method == PaymentMethod.CASH and txn.total_price > 200:
            db.add(SuspiciousTransaction(transaction_id=txn.id, severity=SuspicionSeverity.LOW, reason="Transaksi tunai bernilai tinggi", details=f"Cash RM{txn.total_price}", cashier_name=txn.cashier_name, amount=txn.total_price, transaction_date=txn.transaction_date))
            count += 1
    db.commit()
    return count

def calculate_sales_summary(db: Session, date_from: str = None, date_to: str = None) -> SalesSummary:
    query = db.query(SalesTransaction).filter(SalesTransaction.is_void == False)
    if date_from:
        query = query.filter(SalesTransaction.transaction_date >= date_from)
    if date_to:
        query = query.filter(SalesTransaction.transaction_date <= date_to)
    transactions = query.all()
    total_sales = sum(t.total_price for t in transactions)
    total_count = len(transactions)
    avg_value = total_sales / total_count if total_count > 0 else 0
    item_sales = Counter()
    for t in transactions:
        item_sales[t.item_name] += t.total_price
    top_items = [{"name": n, "total": round(v, 2)} for n, v in item_sales.most_common(10)]
    payment_counts = Counter()
    for t in transactions:
        payment_counts[t.payment_method.value] += t.total_price
    void_count = db.query(SalesTransaction).filter(SalesTransaction.is_void == True).count()
    refund_count = db.query(SalesTransaction).filter(SalesTransaction.is_refund == True).count()
    return SalesSummary(total_sales=round(total_sales, 2), total_transactions=total_count, avg_transaction_value=round(avg_value, 2), top_items=top_items, payment_breakdown={k: round(v, 2) for k, v in payment_counts.items()}, void_count=void_count, refund_count=refund_count)



def analyze_sales_with_ai(content: bytes, filename: str, content_type: str = None) -> dict:
    """Use Claude AI to analyze any sales file — CSV, Excel, PDF, or image."""
    import base64
    import json
    from app.config import settings

    if not settings.ANTHROPIC_API_KEY:
        return {
            "status": "no_api_key",
            "summary": {"total_sales": 0, "total_transactions": 0, "avg_transaction_value": 0, "date_range": "N/A"},
            "insights": ["Claude API key not configured. Please set ANTHROPIC_API_KEY."],
            "items": [],
            "anomalies": [],
            "raw_text": "AI analysis requires ANTHROPIC_API_KEY to be set."
        }

    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    prompt = """This is a sales report, receipt, or transaction data file. Analyze the content and extract:

Return a JSON object with this structure:
{
  "summary": {
    "total_sales": number (total RM amount),
    "total_transactions": number,
    "avg_transaction_value": number,
    "date_range": "string describing the date range"
  },
  "items": [
    {"name": "item name", "quantity": number, "total": number}
  ],
  "insights": ["insight 1 in BM/EN", "insight 2", ...],
  "anomalies": ["anomaly 1 if any", ...],
  "raw_text": "brief plain text summary of what you see"
}

Rules:
- Extract ALL items/products you can find
- Amounts in RM (Malaysian Ringgit)
- If you cannot determine exact numbers, estimate from what's visible
- Insights should be useful for a restaurant owner
- Flag any anomalies (unusual discounts, voids, after-hours transactions)
- Return ONLY valid JSON"""

    filename_lower = (filename or '').lower()

    # Determine how to send the file to Claude
    if filename_lower.endswith(('.jpg', '.jpeg', '.png', '.pdf')):
        # Image/PDF: use vision
        file_b64 = base64.standard_b64encode(content).decode("utf-8")
        media_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf'}
        ext = '.' + filename_lower.rsplit('.', 1)[-1]
        media_type = media_map.get(ext, content_type or 'application/octet-stream')

        messages = [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": file_b64}},
            {"type": "text", "text": prompt}
        ]}]
    else:
        # CSV/Excel: read as text and send as text content
        try:
            import pandas as pd
            if filename_lower.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(content))
            else:
                df = pd.read_excel(io.BytesIO(content))
            # Send first 100 rows as text representation
            text_content = f"Filename: {filename}\nRows: {len(df)}\nColumns: {list(df.columns)}\n\nData (first 100 rows):\n{df.head(100).to_string()}"
        except Exception:
            text_content = f"Filename: {filename}\nRaw content (first 5000 chars):\n{content[:5000].decode('utf-8', errors='replace')}"

        messages = [{"role": "user", "content": f"{prompt}\n\n---\nFILE CONTENT:\n{text_content}"}]

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=messages
        )
        response_text = message.content[0].text

        # Parse JSON from response
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]

        data = json.loads(response_text.strip())

        # Ensure expected structure
        return {
            "status": "success",
            "summary": data.get("summary", {"total_sales": 0, "total_transactions": 0, "avg_transaction_value": 0, "date_range": "Unknown"}),
            "items": data.get("items", []),
            "insights": data.get("insights", []),
            "anomalies": data.get("anomalies", []),
            "raw_text": data.get("raw_text", "")
        }
    except json.JSONDecodeError:
        return {
            "status": "success",
            "summary": {"total_sales": 0, "total_transactions": 0, "avg_transaction_value": 0, "date_range": "Unknown"},
            "items": [],
            "insights": [response_text[:500] if response_text else "Could not parse structured data"],
            "anomalies": [],
            "raw_text": response_text[:1000] if response_text else ""
        }
    except Exception as e:
        return {
            "status": "error",
            "summary": {"total_sales": 0, "total_transactions": 0, "avg_transaction_value": 0, "date_range": "N/A"},
            "items": [],
            "insights": [f"Analysis error: {str(e)}"],
            "anomalies": [],
            "raw_text": str(e)
        }
