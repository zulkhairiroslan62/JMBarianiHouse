from pydantic import BaseModel
from typing import Optional
from app.models.user import UserRole

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    phone_number: Optional[str] = None
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: UserRole = UserRole.ADMIN
    phone_number: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
