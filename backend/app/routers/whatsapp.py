from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user
from app.config import settings

router = APIRouter()

@router.post("/webhook")
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    from app.services.whatsapp_service import handle_incoming_message
    try:
        response = handle_incoming_message(db, body)
        return {"status": "ok", "response": response}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@router.get("/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == settings.WHATSAPP_TOKEN:
        return int(params.get("hub.challenge", "0"))
    raise HTTPException(status_code=403, detail="Verification failed")

@router.post("/send-test")
def send_test_message(phone: str, message: str, current_user: User = Depends(get_current_user)):
    from app.services.whatsapp_service import send_whatsapp_message
    try:
        return {"status": "sent", "result": send_whatsapp_message(phone, message)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/daily-summary")
def trigger_daily_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.whatsapp_service import send_daily_summary
    try:
        send_daily_summary(db)
        return {"message": "Daily summary sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
