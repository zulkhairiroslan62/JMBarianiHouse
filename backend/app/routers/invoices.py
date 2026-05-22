from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime, timezone
import os, uuid
from app.database import get_db
from app.models.user import User
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus
from app.schemas.invoice import InvoiceResponse, InvoiceUpdate, InvoiceListResponse, PaymentUpdate
from app.utils.auth import get_current_user
from app.config import settings

router = APIRouter()

@router.post("/upload", response_model=InvoiceResponse)
async def upload_invoice(file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="File must be PDF, JPG, or PNG")
    ext_map = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png"}
    file_ext = ext_map.get(file.content_type, "bin")
    filename = f"{uuid.uuid4()}.{file_ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    invoice = Invoice(original_filename=file.filename, stored_filepath=filepath, file_type=file_ext, status=InvoiceStatus.UPLOADED, uploaded_by=current_user.id)
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    from app.services.ocr_service import process_invoice_ocr
    try:
        process_invoice_ocr(db, invoice.id)
    except Exception:
        invoice.status = InvoiceStatus.NEEDS_REVIEW
        db.commit()
    db.refresh(invoice)
    return invoice



@router.get("/", response_model=InvoiceListResponse)
def list_invoices(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), status: Optional[str] = None, supplier: Optional[str] = None, search: Optional[str] = None, payment_status: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Invoice)
    if status:
        query = query.filter(Invoice.status == status)
    if supplier:
        query = query.filter(Invoice.supplier_name.ilike(f"%{supplier}%"))
    if search:
        query = query.filter(or_(Invoice.invoice_number.ilike(f"%{search}%"), Invoice.supplier_name.ilike(f"%{search}%")))
    if payment_status:
        query = query.filter(Invoice.payment_status == payment_status)
    total = query.count()
    invoices = query.order_by(Invoice.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return InvoiceListResponse(invoices=[InvoiceResponse.model_validate(inv) for inv in invoices], total=total, page=page, page_size=page_size)

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(invoice_id: int, request: InvoiceUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == InvoiceStatus.PROCESSED:
        raise HTTPException(status_code=400, detail="Cannot edit a processed invoice")
    update_data = request.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(invoice, field, value)
    if request.items is not None:
        db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice_id).delete()
        for item_data in request.items:
            item = InvoiceItem(invoice_id=invoice_id, item_name=item_data.item_name, quantity=item_data.quantity, unit=item_data.unit, unit_price=item_data.unit_price, total_price=item_data.total_price, category=item_data.category, inventory_item_id=item_data.inventory_item_id)
            db.add(item)
    db.commit()
    db.refresh(invoice)
    return invoice

@router.post("/{invoice_id}/confirm", response_model=InvoiceResponse)
def confirm_invoice(invoice_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status not in [InvoiceStatus.NEEDS_REVIEW, InvoiceStatus.UPLOADED, InvoiceStatus.PROCESSING]:
        raise HTTPException(status_code=400, detail=f"Cannot confirm invoice with status: {invoice.status}")
    invoice.status = InvoiceStatus.CONFIRMED
    invoice.confirmed_by = current_user.id
    invoice.confirmed_at = datetime.now(timezone.utc)
    db.commit()
    from app.services.inventory_service import update_inventory_from_invoice
    try:
        update_inventory_from_invoice(db, invoice_id, current_user.id)
        invoice.status = InvoiceStatus.PROCESSED
        db.commit()
    except Exception:
        pass
    db.refresh(invoice)
    return invoice

@router.post("/{invoice_id}/unconfirm", response_model=InvoiceResponse)
def unconfirm_invoice(invoice_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Revoke a confirmed/processed invoice — reverse inventory quantities, set back to needs_review."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status not in [InvoiceStatus.CONFIRMED, InvoiceStatus.PROCESSED]:
        raise HTTPException(status_code=400, detail=f"Cannot revoke invoice with status: {invoice.status}")

    # Reverse inventory updates — remove stock movements linked to this invoice
    from app.models.inventory import InventoryItem, StockMovement, MovementType
    movements = db.query(StockMovement).filter(
        StockMovement.reference_type == "invoice",
        StockMovement.reference_id == invoice_id
    ).all()

    for movement in movements:
        # Reverse the quantity change
        item = db.query(InventoryItem).filter(InventoryItem.id == movement.inventory_item_id).first()
        if item:
            item.current_stock -= movement.quantity  # movement.quantity was positive for stock_in
            if item.current_stock < 0:
                item.current_stock = 0
            item.is_below_reorder = item.current_stock <= item.reorder_level
        db.delete(movement)

    # Reset invoice status
    invoice.status = InvoiceStatus.NEEDS_REVIEW
    invoice.confirmed_by = None
    invoice.confirmed_at = None
    invoice.notes = (invoice.notes or '') + f"\n[Revoked by user #{current_user.id} at {datetime.now(timezone.utc).isoformat()}]"

    db.commit()
    db.refresh(invoice)
    return invoice

@router.post("/{invoice_id}/payment", response_model=InvoiceResponse)
def update_payment(invoice_id: int, request: PaymentUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update payment status for an invoice."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.payment_status = request.payment_status
    if request.payment_method is not None:
        invoice.payment_method = request.payment_method
    if request.amount_paid is not None:
        invoice.amount_paid = request.amount_paid
    if request.payment_date is not None:
        invoice.payment_date = request.payment_date
    elif request.payment_status.value in ['paid', 'partial'] and not invoice.payment_date:
        invoice.payment_date = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invoice)
    return invoice

@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == InvoiceStatus.PROCESSED:
        raise HTTPException(status_code=400, detail="Cannot delete a processed invoice. Revoke it first.")
    if os.path.exists(invoice.stored_filepath):
        os.remove(invoice.stored_filepath)
    db.delete(invoice)
    db.commit()
    return {"message": "Invoice deleted"}
