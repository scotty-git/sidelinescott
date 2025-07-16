from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from .config import settings

# Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# Security scheme
security = HTTPBearer()

class AuthManager:
    def __init__(self):
        self.jwt_secret = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        # Use Supabase's JWT secret for token validation
        self.supabase_jwt_secret = settings.SUPABASE_JWT_SECRET
    
    def verify_supabase_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify Supabase JWT token using Supabase API."""
        try:
            # Use Supabase's official auth.get_user() method
            # This validates against Supabase directly, works across all environments
            response = supabase.auth.get_user(token)
            
            if response.user:
                return {
                    "sub": response.user.id,
                    "email": response.user.email,
                    "created_at": response.user.created_at.isoformat() if response.user.created_at else ""
                }
            else:
                return None
        except Exception as e:
            print(f"Supabase auth.get_user() error: {e}")
            return None
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create a new access token (deprecated - use Supabase tokens directly)."""
        # This method is kept for backward compatibility but should not be used
        # Supabase handles token creation through auth.sign_in_with_password()
        raise NotImplementedError("Use Supabase auth.sign_in_with_password() for token creation")
    
    async def authenticate_with_supabase(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticate user with Supabase Auth."""
        try:
            # Use Supabase auth
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if auth_response.user:
                return {
                    "access_token": auth_response.session.access_token,
                    "refresh_token": auth_response.session.refresh_token,
                    "user": {
                        "id": auth_response.user.id,
                        "email": auth_response.user.email,
                        "created_at": auth_response.user.created_at.isoformat() if auth_response.user.created_at else "",
                        "is_active": True  # Supabase users are active by default
                    },
                    "expires_in": 172800  # 48 hours in seconds
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )
    
    async def get_current_user(self, token: str) -> Dict[str, Any]:
        """Get current user from token."""
        print(f"Verifying token: {token[:50]}...")
        payload = self.verify_supabase_token(token)
        print(f"Token payload: {payload}")
        
        if payload:
            user_id = payload.get("sub")
            email = payload.get("email")
            
            print(f"User ID: {user_id}, Email: {email}")
            
            if user_id and email:
                return {
                    "id": user_id,
                    "email": email,
                    "created_at": payload.get("created_at", ""),
                    "is_active": True
                }
        
        print("Token validation failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

auth_manager = AuthManager()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """FastAPI dependency to get current authenticated user."""
    token = credentials.credentials
    return await auth_manager.get_current_user(token)