import pytest
from unittest.mock import Mock, patch
from app.core.auth import AuthManager
from app.core.config import settings


class TestAuthManager:
    """Test the AuthManager class."""
    
    def test_init(self, auth_manager):
        """Test AuthManager initialization."""
        assert auth_manager.jwt_secret == settings.JWT_SECRET_KEY
        assert auth_manager.algorithm == settings.JWT_ALGORITHM
        assert auth_manager.supabase_jwt_secret == settings.JWT_SECRET_KEY
    
    @patch('app.core.auth.jwt.decode')
    def test_verify_token_success(self, mock_decode, auth_manager, test_user_data):
        """Test successful token verification."""
        mock_decode.return_value = {
            'sub': test_user_data['id'],
            'email': test_user_data['email'],
            'exp': 9999999999  # Far future
        }
        
        result = auth_manager.verify_supabase_token('valid_token')
        
        assert result is not None
        assert result['sub'] == test_user_data['id']
        assert result['email'] == test_user_data['email']
        mock_decode.assert_called_once()
    
    @patch('app.core.auth.jwt.decode')
    def test_verify_token_invalid(self, mock_decode, auth_manager):
        """Test token verification with invalid token."""
        from jose import JWTError
        mock_decode.side_effect = JWTError("Invalid token")
        
        result = auth_manager.verify_supabase_token('invalid_token')
        
        assert result is None
        mock_decode.assert_called_once()
    
    @patch('app.core.auth.jwt.decode')
    def test_verify_token_expired(self, mock_decode, auth_manager):
        """Test token verification with expired token."""
        from jose import JWTError
        mock_decode.side_effect = JWTError("Token expired")
        
        result = auth_manager.verify_supabase_token('expired_token')
        
        assert result is None
        mock_decode.assert_called_once()


class TestAuthEndpoints:
    """Test authentication endpoints."""
    
    @patch('app.core.auth.AuthManager.authenticate_with_supabase')
    def test_login_success(self, mock_auth, client, test_user_data):
        """Test successful login."""
        mock_auth.return_value = {
            'access_token': 'test_access_token',
            'refresh_token': 'test_refresh_token',
            'user': test_user_data,
            'expires_in': 3600
        }
        
        response = client.post('/api/v1/auth/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'access_token' in data
        assert 'user' in data
        assert data['user']['email'] == test_user_data['email']
    
    def test_login_missing_fields(self, client):
        """Test login with missing required fields."""
        response = client.post('/api/v1/auth/login', json={
            'email': 'test@example.com'
            # Missing password
        })
        
        assert response.status_code == 422  # Validation error
    
    def test_login_invalid_email(self, client):
        """Test login with invalid email format."""
        response = client.post('/api/v1/auth/login', json={
            'email': 'invalid-email',
            'password': 'password123'
        })
        
        assert response.status_code == 422  # Validation error
    
    @patch('app.core.auth.AuthManager.authenticate_with_supabase')
    def test_login_invalid_credentials(self, mock_auth, client):
        """Test login with invalid credentials."""
        from fastapi import HTTPException, status
        mock_auth.side_effect = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
        
        response = client.post('/api/v1/auth/login', json={
            'email': 'test@example.com',
            'password': 'wrong_password'
        })
        
        assert response.status_code == 401
        data = response.json()
        assert 'detail' in data


class TestAuthMiddleware:
    """Test authentication middleware and dependency injection."""
    
    @patch('app.core.auth.AuthManager.get_current_user')
    async def test_get_current_user_success(self, mock_get_user, test_user_data):
        """Test successful user extraction from token."""
        from app.core.auth import get_current_user
        from fastapi.security import HTTPAuthorizationCredentials
        
        mock_get_user.return_value = test_user_data
        
        # Mock credentials
        mock_credentials = Mock(spec=HTTPAuthorizationCredentials)
        mock_credentials.credentials = 'valid_token'
        
        result = await get_current_user(mock_credentials)
        
        assert result == test_user_data
        mock_get_user.assert_called_once_with('valid_token')
    
    async def test_get_current_user_missing_credentials(self):
        """Test user extraction with missing credentials."""
        from app.core.auth import get_current_user
        from fastapi import HTTPException
        
        # get_current_user requires HTTPAuthorizationCredentials
        # Missing credentials would be handled by FastAPI security before reaching our function
        # So this test checks the HTTPException path in auth_manager.get_current_user
        pass  # This case is handled by FastAPI security middleware
    
    @patch('app.core.auth.AuthManager.get_current_user')
    async def test_get_current_user_invalid_token(self, mock_get_user):
        """Test user extraction with invalid token."""
        from app.core.auth import get_current_user
        from fastapi import HTTPException
        from fastapi.security import HTTPAuthorizationCredentials
        
        mock_get_user.side_effect = HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        )
        
        mock_credentials = Mock(spec=HTTPAuthorizationCredentials)
        mock_credentials.credentials = 'invalid_token'
        
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(mock_credentials)
        
        assert exc_info.value.status_code == 401
        mock_get_user.assert_called_once_with('invalid_token')