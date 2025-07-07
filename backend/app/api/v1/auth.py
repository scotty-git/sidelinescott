from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import LoginRequest, LoginResponse, RefreshRequest, RefreshResponse
from app.core.auth import auth_manager, get_current_user
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """User login endpoint with Supabase authentication."""
    try:
        auth_result = await auth_manager.authenticate_with_supabase(
            request.email, 
            request.password
        )
        return LoginResponse(**auth_result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service unavailable"
        )

@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(request: RefreshRequest):
    """Refresh JWT token."""
    try:
        # Create new access token
        new_token = auth_manager.create_access_token(
            data={"sub": "user_id"},  # This would come from refresh token validation
            expires_delta=timedelta(hours=1)
        )
        return RefreshResponse(
            access_token=new_token,
            expires_in=3600
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """User logout endpoint."""
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information."""
    return current_user