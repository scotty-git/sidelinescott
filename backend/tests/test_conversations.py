import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


class TestConversationEndpoints:
    """Test conversation CRUD endpoints."""
    
    @patch('app.core.auth.get_current_user')
    def test_create_conversation_success(self, mock_auth, client, test_user_data, test_conversation_data):
        """Test successful conversation creation."""
        mock_auth.return_value = test_user_data
        
        response = client.post('/api/v1/conversations', json=test_conversation_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'id' in data
        assert data['name'] == test_conversation_data['name']
        assert data['description'] == test_conversation_data['description']
        assert data['status'] == 'active'
        assert data['turns_count'] == 0
        assert 'created_at' in data
        assert 'updated_at' in data
    
    @patch('app.core.auth.get_current_user')
    def test_create_conversation_minimal(self, mock_auth, client, test_user_data):
        """Test conversation creation with minimal required fields."""
        mock_auth.return_value = test_user_data
        
        minimal_data = {"name": "Minimal Conversation"}
        response = client.post('/api/v1/conversations', json=minimal_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['name'] == "Minimal Conversation"
        assert data['description'] is None
        assert data['status'] == 'active'
    
    def test_create_conversation_unauthorized(self, client, test_conversation_data):
        """Test conversation creation without authentication."""
        response = client.post('/api/v1/conversations', json=test_conversation_data)
        
        assert response.status_code == 401
    
    @patch('app.core.auth.get_current_user')
    def test_create_conversation_invalid_data(self, mock_auth, client, test_user_data):
        """Test conversation creation with invalid data."""
        mock_auth.return_value = test_user_data
        
        invalid_data = {"description": "Missing name field"}
        response = client.post('/api/v1/conversations', json=invalid_data)
        
        assert response.status_code == 422  # Validation error
    
    @patch('app.core.auth.get_current_user')
    def test_list_conversations_empty(self, mock_auth, client, test_user_data):
        """Test listing conversations when none exist."""
        mock_auth.return_value = test_user_data
        
        response = client.get('/api/v1/conversations')
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'conversations' in data
        assert 'total' in data
        assert 'page' in data
        assert 'per_page' in data
        assert data['conversations'] == []
        assert data['total'] == 0
    
    @patch('app.core.auth.get_current_user')
    def test_list_conversations_with_data(self, mock_auth, client, test_user_data, test_conversation_data):
        """Test listing conversations after creating some."""
        mock_auth.return_value = test_user_data
        
        # Create a conversation first
        create_response = client.post('/api/v1/conversations', json=test_conversation_data)
        assert create_response.status_code == 200
        
        # Now list conversations
        list_response = client.get('/api/v1/conversations')
        
        assert list_response.status_code == 200
        data = list_response.json()
        
        assert len(data['conversations']) == 1
        assert data['total'] == 1
        assert data['conversations'][0]['name'] == test_conversation_data['name']
    
    @patch('app.core.auth.get_current_user')
    def test_get_conversation_success(self, mock_auth, client, test_user_data, test_conversation_data):
        """Test getting a specific conversation."""
        mock_auth.return_value = test_user_data
        
        # Create a conversation first
        create_response = client.post('/api/v1/conversations', json=test_conversation_data)
        conversation_id = create_response.json()['id']
        
        # Get the conversation
        response = client.get(f'/api/v1/conversations/{conversation_id}')
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['id'] == conversation_id
        assert data['name'] == test_conversation_data['name']
    
    @patch('app.core.auth.get_current_user')
    def test_get_conversation_not_found(self, mock_auth, client, test_user_data):
        """Test getting a non-existent conversation."""
        mock_auth.return_value = test_user_data
        
        fake_id = "550e8400-e29b-41d4-a716-446655440999"
        response = client.get(f'/api/v1/conversations/{fake_id}')
        
        assert response.status_code == 404
        data = response.json()
        assert 'detail' in data
    
    @patch('app.core.auth.get_current_user')
    def test_delete_conversation_success(self, mock_auth, client, test_user_data, test_conversation_data):
        """Test deleting a conversation."""
        mock_auth.return_value = test_user_data
        
        # Create a conversation first
        create_response = client.post('/api/v1/conversations', json=test_conversation_data)
        conversation_id = create_response.json()['id']
        
        # Delete the conversation
        response = client.delete(f'/api/v1/conversations/{conversation_id}')
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        
        # Verify it's deleted
        get_response = client.get(f'/api/v1/conversations/{conversation_id}')
        assert get_response.status_code == 404
    
    @patch('app.core.auth.get_current_user')
    def test_delete_conversation_not_found(self, mock_auth, client, test_user_data):
        """Test deleting a non-existent conversation."""
        mock_auth.return_value = test_user_data
        
        fake_id = "550e8400-e29b-41d4-a716-446655440999"
        response = client.delete(f'/api/v1/conversations/{fake_id}')
        
        assert response.status_code == 404
        data = response.json()
        assert 'detail' in data
    
    def test_all_endpoints_require_auth(self, client):
        """Test that all conversation endpoints require authentication."""
        endpoints = [
            ('GET', '/api/v1/conversations'),
            ('POST', '/api/v1/conversations'),
            ('GET', '/api/v1/conversations/test-id'),
            ('DELETE', '/api/v1/conversations/test-id')
        ]
        
        for method, endpoint in endpoints:
            if method == 'GET':
                response = client.get(endpoint)
            elif method == 'POST':
                response = client.post(endpoint, json={"name": "test"})
            elif method == 'DELETE':
                response = client.delete(endpoint)
            
            assert response.status_code == 401, f"{method} {endpoint} should require auth"


class TestConversationPerformance:
    """Test conversation endpoint performance."""
    
    @patch('app.core.auth.get_current_user')
    def test_create_conversation_performance(self, mock_auth, client, test_user_data, test_conversation_data):
        """Test conversation creation performance."""
        import time
        
        mock_auth.return_value = test_user_data
        
        start_time = time.time()
        response = client.post('/api/v1/conversations', json=test_conversation_data)
        end_time = time.time()
        
        response_time_ms = (end_time - start_time) * 1000
        
        assert response.status_code == 200
        # Should complete quickly (sub-500ms target for CRUD operations)
        assert response_time_ms < 1000  # Allow margin for test environment
    
    @patch('app.core.auth.get_current_user')
    def test_list_conversations_performance(self, mock_auth, client, test_user_data):
        """Test conversation listing performance."""
        import time
        
        mock_auth.return_value = test_user_data
        
        start_time = time.time()
        response = client.get('/api/v1/conversations')
        end_time = time.time()
        
        response_time_ms = (end_time - start_time) * 1000
        
        assert response.status_code == 200
        # Should complete quickly (sub-100ms target for GET operations)
        assert response_time_ms < 500  # Allow margin for test environment


class TestConversationSecurity:
    """Test conversation security and isolation."""
    
    @patch('app.core.auth.get_current_user')
    def test_user_isolation(self, mock_auth, client, test_conversation_data):
        """Test that users can only access their own conversations."""
        # Create conversation as user 1
        user1 = {"id": "user-1", "email": "user1@example.com", "is_active": True}
        mock_auth.return_value = user1
        
        create_response = client.post('/api/v1/conversations', json=test_conversation_data)
        conversation_id = create_response.json()['id']
        
        # Try to access as user 2
        user2 = {"id": "user-2", "email": "user2@example.com", "is_active": True}
        mock_auth.return_value = user2
        
        response = client.get(f'/api/v1/conversations/{conversation_id}')
        assert response.status_code == 404  # Should not find conversation for different user
    
    @patch('app.core.auth.get_current_user')
    def test_conversation_ownership(self, mock_auth, client, test_conversation_data):
        """Test that created conversations are properly associated with the user."""
        user_data = {"id": "test-user", "email": "test@example.com", "is_active": True}
        mock_auth.return_value = user_data
        
        response = client.post('/api/v1/conversations', json=test_conversation_data)
        
        assert response.status_code == 200
        
        # List conversations should return the created one
        list_response = client.get('/api/v1/conversations')
        conversations = list_response.json()['conversations']
        
        assert len(conversations) == 1
        assert conversations[0]['name'] == test_conversation_data['name']