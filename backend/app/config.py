from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://jmbariani:changeme@localhost:5432/jmbariani_hq"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ANTHROPIC_API_KEY: Optional[str] = None
    WHATSAPP_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    ACEPOS_USERNAME: Optional[str] = None
    ACEPOS_PASSWORD: Optional[str] = None
    UPLOAD_DIR: str = "./uploads"
    FRONTEND_URL: str = "http://localhost:3000"
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
