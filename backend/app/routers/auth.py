from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, UserCreate, UserUpdate, PasswordChange
from app.utils.auth import verify_password, get_password_hash, create_access_token, get_current_user, require_role
from app.config import settings

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return TokenResponse(access_token=access_token, user=UserResponse.model_validate(user))

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/change-password")
def change_password(request: PasswordChange, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(request.new_password)
    db.commit()
    return {"message": "Password changed successfully"}

@router.get("/users", response_model=List[UserResponse])
def list_users(current_user: User = Depends(require_role(UserRole.OWNER)), db: Session = Depends(get_db)):
    return db.query(User).all()

@router.post("/users", response_model=UserResponse)
def create_user(request: UserCreate, current_user: User = Depends(require_role(UserRole.OWNER)), db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).count() >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 users allowed")
    user = User(email=request.email, full_name=request.full_name, hashed_password=get_password_hash(request.password), role=request.role, phone_number=request.phone_number)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}
