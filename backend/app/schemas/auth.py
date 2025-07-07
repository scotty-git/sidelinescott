from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    created_at: str
    is_active: bool = True

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    user: UserResponse
    expires_in: int
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class RefreshResponse(BaseModel):
    access_token: str
    expires_in: int
    token_type: str = "bearer"