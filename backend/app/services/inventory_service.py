"""Inventory Service - stock updates from invoices."""
from sqlalchemy.orm import Session
from app.models.inventory import InventoryItem, StockMovement, MovementType, InventoryCategory
from app.models.invoice import Invoice, InvoiceItem

def update_inventory_from_invoice(db: Session, invoice_id: int, user_id: int):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found")
    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice_id).all()
    for inv_item in items:
        inventory_item = None
        if inv_item.inventory_item_id:
            inventory_item = db.query(InventoryItem).filter(InventoryItem.id == inv_item.inventory_item_id).first()
        if not inventory_item:
            inventory_item = db.query(InventoryItem).filter(InventoryItem.name.ilike(f"%{inv_item.item_name}%")).first()
        if not inventory_item:
            category_map = {"basah": InventoryCategory.BASAH, "kering": InventoryCategory.KERING, "minuman": InventoryCategory.MINUMAN}
            cat = category_map.get(inv_item.category, InventoryCategory.LAIN_LAIN)
            inventory_item = InventoryItem(name=inv_item.item_name, category=cat, unit=inv_item.unit or "pcs", current_stock=0, reorder_level=5, weighted_avg_cost=0)
            db.add(inventory_item)
            db.flush()
            inv_item.inventory_item_id = inventory_item.id
        old_total = inventory_item.weighted_avg_cost * inventory_item.current_stock
        new_total = old_total + inv_item.total_price
        new_qty = inventory_item.current_stock + inv_item.quantity
        if new_qty > 0:
            inventory_item.weighted_avg_cost = new_total / new_qty
        inventory_item.current_stock += inv_item.quantity
        inventory_item.last_purchase_price = inv_item.unit_price
        if invoice.supplier_name:
            inventory_item.primary_supplier = invoice.supplier_name
        inventory_item.is_below_reorder = inventory_item.current_stock <= inventory_item.reorder_level
        db.add(StockMovement(inventory_item_id=inventory_item.id, movement_type=MovementType.STOCK_IN, quantity=inv_item.quantity, unit_cost=inv_item.unit_price, total_cost=inv_item.total_price, reference_type="invoice", reference_id=invoice_id, notes=f"From invoice #{invoice.invoice_number or invoice.id}", performed_by=user_id))
    db.commit()
