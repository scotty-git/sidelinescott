from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
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
        self.supabase_jwt_secret = settings.JWT_SECRET_KEY  # Supabase uses same secret
    
    def verify_supabase_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify Supabase JWT token."""
        try:
            payload = jwt.decode(token, self.supabase_jwt_secret, algorithms=[self.algorithm])
            user_id = payload.get("sub")
            if user_id is None:
                return None
            return payload
        except JWTError:
            return None
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create a new access token."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.jwt_secret, algorithm=self.algorithm)
        return encoded_jwt
    
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
                        "created_at": auth_response.user.created_at
                    },
                    "expires_in": 3600
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
        payload = self.verify_supabase_token(token)
        if payload:
            user_id = payload.get("sub")
            email = payload.get("email")
            
            if user_id and email:
                return {
                    "id": user_id,
                    "email": email,
                    "created_at": payload.get("created_at", "")
                }
        
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