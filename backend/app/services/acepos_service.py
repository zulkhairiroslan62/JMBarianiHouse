"""AcePOS Integration Service."""
import httpx
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.config import settings

def fetch_acepos_data(db: Session) -> dict:
    if not settings.ACEPOS_USERNAME or not settings.ACEPOS_PASSWORD:
        raise ValueError("AcePOS credentials not configured")
    base_url = "https://acepos.biz"
    try:
        with httpx.Client(timeout=30) as client:
            login_resp = client.post(f"{base_url}/api/login", json={"username": settings.ACEPOS_USERNAME, "password": settings.ACEPOS_PASSWORD})
            if login_resp.status_code != 200:
                raise ValueError(f"AcePOS login failed: {login_resp.status_code}")
            token = login_resp.json().get("token")
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            sales_resp = client.get(f"{base_url}/api/sales/report", params={"date_from": today, "date_to": today}, headers={"Authorization": f"Bearer {token}"})
            if sales_resp.status_code != 200:
                raise ValueError(f"Failed to fetch sales: {sales_resp.status_code}")
            sales_data = sales_resp.json()
            if sales_data.get("transactions"):
                import pandas as pd
                import uuid
                df = pd.DataFrame(sales_data["transactions"])
                csv_bytes = df.to_csv(index=False).encode()
                batch_id = f"acepos-{uuid.uuid4().hex[:8]}"
                from app.services.sales_service import parse_sales_file
                result = parse_sales_file(db, csv_bytes, "acepos_auto.csv", batch_id, 1)
                return {"status": "success", "records": result.new_records}
            return {"status": "no_data", "records": 0}
    except httpx.RequestError as e:
        raise ValueError(f"AcePOS connection error: {str(e)}")
