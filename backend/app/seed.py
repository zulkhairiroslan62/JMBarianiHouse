"""Seed script - creates initial users and sample inventory."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.inventory import InventoryItem, InventoryCategory
from app.utils.auth import get_password_hash

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).first():
            print("Already seeded.")
            return
        users = [
            User(email="owner@jmbariani.com", full_name="Zulkhairi (Owner)", hashed_password=get_password_hash("owner123"), role=UserRole.OWNER, phone_number="+60121234567"),
            User(email="admin@jmbariani.com", full_name="Ahmad (Admin)", hashed_password=get_password_hash("admin123"), role=UserRole.ADMIN, phone_number="+60129876543"),
            User(email="admin2@jmbariani.com", full_name="Siti (Admin 2)", hashed_password=get_password_hash("admin123"), role=UserRole.ADMIN, phone_number="+60131112233"),
        ]
        for u in users:
            db.add(u)
        items = [
            InventoryItem(name="Beras Basmathi", category=InventoryCategory.KERING, unit="kg", current_stock=25, reorder_level=10, weighted_avg_cost=8.50, primary_supplier="BWY Holdings"),
            InventoryItem(name="Ayam", category=InventoryCategory.BASAH, unit="kg", current_stock=8, reorder_level=5, weighted_avg_cost=12.00, primary_supplier="NSK Trade"),
            InventoryItem(name="Daging Kambing", category=InventoryCategory.BASAH, unit="kg", current_stock=4, reorder_level=3, weighted_avg_cost=45.00, primary_supplier="Brahim's"),
            InventoryItem(name="Minyak Masak", category=InventoryCategory.KERING, unit="litre", current_stock=15, reorder_level=5, weighted_avg_cost=5.80),
            InventoryItem(name="Bawang Merah", category=InventoryCategory.BASAH, unit="kg", current_stock=3, reorder_level=5, weighted_avg_cost=6.00, is_below_reorder=True),
            InventoryItem(name="Rempah Briyani", category=InventoryCategory.KERING, unit="packet", current_stock=20, reorder_level=8, weighted_avg_cost=3.50),
            InventoryItem(name="Susu Pekat", category=InventoryCategory.KERING, unit="tin", current_stock=12, reorder_level=6, weighted_avg_cost=4.20),
            InventoryItem(name="Teh O", category=InventoryCategory.MINUMAN, unit="box", current_stock=6, reorder_level=3, weighted_avg_cost=15.00),
            InventoryItem(name="Air Mineral", category=InventoryCategory.MINUMAN, unit="carton", current_stock=8, reorder_level=4, weighted_avg_cost=12.00),
            InventoryItem(name="Telur", category=InventoryCategory.BASAH, unit="tray", current_stock=5, reorder_level=3, weighted_avg_cost=14.00),
        ]
        for item in items:
            item.is_below_reorder = item.current_stock <= item.reorder_level
            item.avg_daily_usage = item.current_stock / 7
            item.days_of_stock = 7
            db.add(item)
        db.commit()
        print(f"Seeded {len(users)} users, {len(items)} inventory items.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
