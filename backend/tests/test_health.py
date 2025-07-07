import pytest
from fastapi.testclient import TestClient


def test_health_check_success(client: TestClient):
    """Test successful health check."""
    response = client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] in ["healthy", "degraded"]
    assert "database" in data
    assert "supabase" in data
    assert "gemini_api" in data
    assert "timestamp" in data
    assert "version" in data
    assert "environment" in data


def test_health_check_response_time(client: TestClient):
    """Test health check responds quickly."""
    import time
    
    start_time = time.time()
    response = client.get("/health")
    end_time = time.time()
    
    response_time_ms = (end_time - start_time) * 1000
    
    assert response.status_code == 200
    # Health check should be very fast (sub-100ms target)
    assert response_time_ms < 500  # Allow margin for test environment


def test_health_check_structure(client: TestClient):
    """Test health check response has correct structure."""
    response = client.get("/health")
    data = response.json()
    
    required_fields = [
        "status", "database", "supabase", "gemini_api", 
        "timestamp", "version", "environment"
    ]
    
    for field in required_fields:
        assert field in data, f"Missing required field: {field}"
    
    assert data["version"] == "1.0.0"
    assert data["environment"] == "development"