# Testing Strategy - Comprehensive Quality Assurance

## 🎯 Testing Philosophy

**Core Principle**: Test-driven development with comprehensive coverage ensures quality at every step. Write tests before implementation, verify all requirements, and maintain >95% code coverage throughout development.

**Quality Standards**:
- **Test First**: Write tests before implementation code
- **Comprehensive Coverage**: >95% code coverage for all critical paths
- **Performance Validation**: All sub-100ms targets must be tested
- **Real-world Testing**: Test with realistic data and scenarios
- **Continuous Testing**: Automated testing in CI/CD pipeline

## 🏗️ Testing Pyramid Architecture

### Test Distribution Strategy

```
                🔺 E2E Tests (5%)
              ┌─────────────────┐
              │   End-to-End    │
              │   User Flows    │
              └─────────────────┘
            🔺 Integration Tests (25%)
          ┌─────────────────────────┐
          │    API Integration      │
          │    Component Testing    │
          │    Database Testing     │
          └─────────────────────────┘
        🔺 Unit Tests (70%)
      ┌─────────────────────────────────┐
      │         Unit Testing            │
      │    Functions, Components        │
      │    Business Logic, Utilities    │
      └─────────────────────────────────┘
```

### Testing Framework Stack

```typescript
interface TestingStack {
  // Frontend testing
  frontend: {
    unit: 'Vitest + Testing Library';
    integration: 'Vitest + MSW (Mock Service Worker)';
    e2e: 'Playwright';
    performance: 'Web Vitals + Lighthouse CI';
    accessibility: 'axe-core + Testing Library';
  };
  
  // Backend testing
  backend: {
    unit: 'pytest + pytest-asyncio';
    integration: 'pytest + httpx + testcontainers';
    load: 'Locust';
    security: 'bandit + safety';
    api: 'pytest + FastAPI TestClient';
  };
  
  // Real-time testing
  realtime: {
    websocket: 'pytest-websocket + Playwright';
    performance: 'Artillery.io';
    reliability: 'Chaos Monkey';
  };
  
  // Infrastructure testing
  infrastructure: {
    database: 'pytest + SQLAlchemy test fixtures';
    deployment: 'Docker + health checks';
    monitoring: 'Synthetic monitoring tests';
  };
}
```

## 📅 Phase-Specific Testing Requirements

### Week 1: Foundation Testing

**Day 1-2: Environment & Setup Testing**
```typescript
// Development environment tests
describe('Development Environment', () => {
  test('Vite dev server starts successfully', async () => {
    const response = await fetch('http://127.0.0.1:5173');
    expect(response.status).toBe(200);
  });
  
  test('Backend API health check responds', async () => {
    const response = await fetch('http://127.0.0.1:8000/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'healthy',
      database: 'connected'
    });
  });
  
  test('UnoCSS generates styles correctly', () => {
    render(<div className="p-4 bg-blue-500">Test</div>);
    const element = screen.getByText('Test');
    const styles = getComputedStyle(element);
    expect(styles.padding).toBe('16px');
    expect(styles.backgroundColor).toContain('blue');
  });
  
  test('Database migrations apply successfully', async () => {
    const result = await runMigrations();
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

**Day 3-4: Authentication Testing**
```python
# Backend authentication tests
class TestAuthentication:
    async def test_user_registration(self, client: TestClient):
        """Test user registration flow"""
        response = client.post("/api/v1/auth/register", json={
            "email": "test@example.com",
            "password": "SecurePassword123!",
            "profile": {"name": "Test User"}
        })
        
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@example.com"
    
    async def test_login_flow(self, client: TestClient):
        """Test user login and token generation"""
        # Create user first
        await self.create_test_user()
        
        response = client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "SecurePassword123!"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        
        # Verify token is valid
        token = data["access_token"]
        auth_response = client.get("/api/v1/auth/me", 
                                 headers={"Authorization": f"Bearer {token}"})
        assert auth_response.status_code == 200
    
    async def test_protected_endpoint_requires_auth(self, client: TestClient):
        """Test that protected endpoints require authentication"""
        response = client.get("/api/v1/conversations")
        assert response.status_code == 401
        
        response = client.post("/api/v1/conversations", json={"name": "Test"})
        assert response.status_code == 401
```

**Day 5: Week 1 Quality Gate Testing**
```typescript
// Integration tests for Week 1 deliverables
describe('Week 1 Integration Tests', () => {
  test('Complete authentication flow works end-to-end', async () => {
    // Register user
    const registerResponse = await api.register({
      email: 'test@example.com',
      password: 'SecurePassword123!'
    });
    expect(registerResponse.success).toBe(true);
    
    // Login user
    const loginResponse = await api.login({
      email: 'test@example.com',
      password: 'SecurePassword123!'
    });
    expect(loginResponse.access_token).toBeDefined();
    
    // Access protected resource
    const protectedResponse = await api.getConversations({
      token: loginResponse.access_token
    });
    expect(protectedResponse.status).toBe(200);
  });
  
  test('Database operations work correctly', async () => {
    const conversation = await db.createConversation({
      name: 'Test Conversation',
      user_id: 'test-user-id'
    });
    
    expect(conversation.id).toBeDefined();
    expect(conversation.name).toBe('Test Conversation');
    
    const retrieved = await db.getConversation(conversation.id);
    expect(retrieved).toEqual(conversation);
  });
});
```

### Week 2: CleanerContext Core Testing

**CleanerContext Implementation Tests**
```python
class TestCleanerContextImplementation:
    async def test_stateful_cleaning_maintains_cleaned_history(self):
        """Test that cleaned history is used in sliding window"""
        processor = ConversationProcessor()
        
        # Process turn with error
        turn1 = await processor.process_turn("User", "I'm the vector of marketing")
        assert "Director of marketing" in turn1.cleaned_text
        assert turn1.metadata.cleaning_applied == True
        
        # Process subsequent turn
        turn2 = await processor.process_turn("User", "As I mentioned about my role...")
        
        # Verify sliding window contains cleaned version
        context = processor.get_sliding_window()
        assert "Director of marketing" in ' '.join([t.cleaned_text for t in context])
        assert "vector of marketing" not in ' '.join([t.cleaned_text for t in context])
    
    async def test_lumen_turn_bypass(self):
        """Test that Lumen turns are processed with zero latency"""
        processor = ConversationProcessor()
        
        start_time = time.time()
        result = await processor.process_turn("Lumen", "Thank you for that information.")
        processing_time = (time.time() - start_time) * 1000
        
        assert result.metadata.cleaning_applied == False
        assert result.metadata.processing_time_ms < 10
        assert processing_time < 50  # Including overhead
        assert result.cleaned_text == "Thank you for that information."
    
    async def test_cleaning_decision_engine_accuracy(self):
        """Test cleaning decision accuracy"""
        engine = CleaningDecisionEngine()
        
        # Test simple acknowledgments
        assert engine.assess_cleaning_need("Yes") == "none"
        assert engine.assess_cleaning_need("That's right") == "none"
        assert engine.assess_cleaning_need("Mm-hmm") == "none"
        
        # Test error patterns
        assert engine.assess_cleaning_need("I'm the vector of marketing") == "full"
        assert engine.assess_cleaning_need("We use book advertising") == "full"
        assert engine.assess_cleaning_need("Our generic CEO helps") == "full"
        
        # Test light cleaning
        assert engine.assess_cleaning_need("we have good results") == "light"
        assert engine.assess_cleaning_need("The company is growing") == "light"
    
    async def test_json_output_format_compliance(self):
        """Test exact JSON output format specification"""
        processor = ConversationProcessor()
        
        result = await processor.process_turn("User", "I'm the vector of marketing")
        
        # Verify required fields
        assert "cleaned_text" in result
        assert "metadata" in result
        
        metadata = result["metadata"]
        assert metadata["confidence_score"] in ["HIGH", "MEDIUM", "LOW"]
        assert isinstance(metadata["cleaning_applied"], bool)
        assert metadata["cleaning_level"] in ["none", "light", "full"]
        assert isinstance(metadata["corrections"], list)
        assert isinstance(metadata["processing_time_ms"], (int, float))
        
        # Verify correction structure
        if metadata["corrections"]:
            correction = metadata["corrections"][0]
            assert "original" in correction
            assert "corrected" in correction
            assert "confidence" in correction
            assert "reason" in correction
    
    async def test_flexible_context_detection(self):
        """Test dynamic context detection"""
        detector = FlexibleContextDetector()
        
        history = [
            {"text": "I'm the Director of Marketing", "speaker": "User"},
            {"text": "We have 75 employees and run Facebook campaigns", "speaker": "User"}
        ]
        
        contexts = detector.detect_active_contexts(history)
        
        assert "identity_discussion" in contexts
        assert "company_info" in contexts
        assert "marketing_discussion" in contexts
        assert len(contexts) >= 2  # Multiple contexts detected
    
    async def test_confidence_based_auto_application(self):
        """Test confidence-based processing decisions"""
        processor = ConfidenceBasedProcessor()
        
        high_confidence_response = {
            "cleaned_text": "I'm the Director of Marketing",
            "metadata": {
                "confidence_score": "HIGH",
                "corrections": [{
                    "original": "vector of",
                    "corrected": "Director of",
                    "confidence": "HIGH",
                    "reason": "contextual_understanding"
                }]
            }
        }
        
        decision = await processor.process_with_confidence(high_confidence_response)
        
        assert decision["applied"] == True
        assert decision["user_notification"] == "subtle"
        assert decision["tracking"] == "standard"
```

**Performance Testing for CleanerContext**
```typescript
describe('CleanerContext Performance Tests', () => {
  test('User turn processing meets 500ms target', async () => {
    const processor = new ConversationProcessor();
    const testCases = [
      "I'm the vector of marketing at quick fit windows",
      "We have seventy five employees in our team",
      "Our book marketing generates fifty leads monthly",
      "The generic CEO helps with our paper click campaigns"
    ];
    
    for (const testCase of testCases) {
      const startTime = performance.now();
      const result = await processor.processUserTurn(testCase);
      const processingTime = performance.now() - startTime;
      
      expect(processingTime).toBeLessThan(500);
      expect(result.metadata.cleaning_applied).toBe(true);
      expect(result.metadata.confidence_score).toBeDefined();
    }
  });
  
  test('Cleaning decision engine meets 50ms target', async () => {
    const engine = new CleaningDecisionEngine();
    const testCases = [
      "Yes", "That's right", "Mm-hmm",
      "I'm the vector of marketing",
      "We use book advertising",
      "The company is growing well"
    ];
    
    for (const testCase of testCases) {
      const startTime = performance.now();
      const decision = engine.assessCleaningNeed(testCase);
      const decisionTime = performance.now() - startTime;
      
      expect(decisionTime).toBeLessThan(50);
      expect(['none', 'light', 'full']).toContain(decision);
    }
  });
});
```

### Week 3: Real-time & UI Testing

**WebSocket Real-time Testing**
```typescript
describe('Real-time WebSocket Tests', () => {
  test('WebSocket connection establishes within 1s', async () => {
    const startTime = performance.now();
    const manager = new SupabaseRealtimeManager(supabase);
    
    await manager.connect();
    const connectionTime = performance.now() - startTime;
    
    expect(connectionTime).toBeLessThan(1000);
    expect(manager.isConnected()).toBe(true);
  });
  
  test('Turn processing updates appear within 100ms', async () => {
    const manager = new SupabaseRealtimeManager(supabase);
    await manager.connect();
    
    const updatePromise = new Promise((resolve) => {
      const startTime = performance.now();
      
      manager.on('turn:processed', (data) => {
        const updateTime = performance.now() - startTime;
        resolve({ updateTime, data });
      });
    });
    
    // Trigger turn processing
    await triggerTurnProcessing('test-conversation-id');
    
    const { updateTime, data } = await updatePromise;
    expect(updateTime).toBeLessThan(100);
    expect(data.turn).toBeDefined();
    expect(data.conversationId).toBe('test-conversation-id');
  });
  
  test('Confidence indicators update in real-time', async () => {
    const confidenceIndicator = render(<ConfidenceIndicator />);
    const manager = new SupabaseRealtimeManager(supabase);
    
    await manager.connect();
    
    // Simulate confidence update
    manager.emit('confidence:updated', {
      confidence: 'HIGH',
      corrections: [{ original: 'vector of', corrected: 'Director of' }]
    });
    
    await waitFor(() => {
      expect(confidenceIndicator.getByText('HIGH')).toBeInTheDocument();
      expect(confidenceIndicator.getByText('✓')).toBeInTheDocument(); // High confidence icon
    }, { timeout: 100 });
  });
});
```

**UI Performance Testing**
```typescript
describe('UI Performance Tests', () => {
  test('Button interactions provide sub-50ms feedback', async () => {
    const handleClick = jest.fn();
    const button = render(<Button onClick={handleClick}>Test Button</Button>);
    const buttonElement = button.getByRole('button');
    
    const startTime = performance.now();
    fireEvent.mouseDown(buttonElement);
    
    // Check visual feedback appears immediately
    await new Promise(resolve => requestAnimationFrame(resolve));
    const feedbackTime = performance.now() - startTime;
    
    expect(feedbackTime).toBeLessThan(50);
    expect(buttonElement).toHaveStyle({ transform: 'scale(0.95)' });
  });
  
  test('Form validation displays within 100ms', async () => {
    const form = render(
      <form>
        <input type="email" required />
        <button type="submit">Submit</button>
      </form>
    );
    
    const input = form.getByRole('textbox');
    const submitButton = form.getByRole('button');
    
    // Enter invalid email
    fireEvent.change(input, { target: { value: 'invalid-email' } });
    
    const startTime = performance.now();
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      const validationTime = performance.now() - startTime;
      const errorMessage = form.queryByText(/invalid email/i);
      
      expect(errorMessage).toBeInTheDocument();
      expect(validationTime).toBeLessThan(100);
    });
  });
  
  test('Progressive disclosure reveals content smoothly', async () => {
    const disclosure = render(
      <ProgressiveDisclosure
        basicContent={<div>Basic content</div>}
        detailedContent={<div>Detailed content</div>}
      />
    );
    
    const showDetailsButton = disclosure.getByText(/show details/i);
    
    const startTime = performance.now();
    fireEvent.click(showDetailsButton);
    
    await waitFor(() => {
      const revealTime = performance.now() - startTime;
      const detailedContent = disclosure.getByText('Detailed content');
      
      expect(detailedContent).toBeInTheDocument();
      expect(revealTime).toBeLessThan(200);
    });
  });
});
```

**Design System Testing**
```typescript
describe('Design System Component Tests', () => {
  test('All components implement consistent accessibility', async () => {
    const components = [
      <Button>Test Button</Button>,
      <Input placeholder="Test input" />,
      <Modal isOpen={true}>Test modal</Modal>,
      <Card>Test card</Card>
    ];
    
    for (const component of components) {
      const { container } = render(component);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    }
  });
  
  test('Components use consistent design tokens', () => {
    const button = render(<Button variant="primary">Test</Button>);
    const card = render(<Card>Test</Card>);
    
    const buttonElement = button.getByRole('button');
    const cardElement = card.container.firstChild;
    
    // Check consistent spacing
    const buttonStyles = getComputedStyle(buttonElement);
    const cardStyles = getComputedStyle(cardElement);
    
    expect(buttonStyles.borderRadius).toBe(cardStyles.borderRadius);
    // Verify other design token consistency
  });
  
  test('All interactive components provide proper focus management', () => {
    const form = render(
      <form>
        <Input data-testid="input1" />
        <Input data-testid="input2" />
        <Button data-testid="submit">Submit</Button>
      </form>
    );
    
    const input1 = form.getByTestId('input1');
    const input2 = form.getByTestId('input2');
    const submitButton = form.getByTestId('submit');
    
    // Test tab navigation
    input1.focus();
    fireEvent.keyDown(input1, { key: 'Tab' });
    expect(input2).toHaveFocus();
    
    fireEvent.keyDown(input2, { key: 'Tab' });
    expect(submitButton).toHaveFocus();
    
    // Test shift+tab navigation
    fireEvent.keyDown(submitButton, { key: 'Tab', shiftKey: true });
    expect(input2).toHaveFocus();
  });
});
```

### Week 4: Integration & Production Testing

**End-to-End Testing**
```typescript
// Playwright E2E tests
import { test, expect } from '@playwright/test';

test.describe('Complete User Workflows', () => {
  test('User can complete full evaluation workflow', async ({ page }) => {
    // Login
    await page.goto('http://127.0.0.1:3000');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'SecurePassword123!');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    
    // Create new conversation
    await page.click('[data-testid="new-conversation"]');
    await page.fill('[data-testid="conversation-name"]', 'E2E Test Conversation');
    
    // Upload file
    const fileInput = page.locator('[data-testid="file-upload"]');
    await fileInput.setInputFiles('test-data/sample-conversation.md');
    
    // Configure evaluation
    await page.fill('[data-testid="cleaning-prompt"]', 'Clean this conversation transcript...');
    await page.selectOption('[data-testid="model-select"]', 'gemini-2.0-flash-exp');
    
    // Start evaluation
    const startTime = Date.now();
    await page.click('[data-testid="start-evaluation"]');
    
    // Wait for completion
    await expect(page.locator('[data-testid="evaluation-complete"]')).toBeVisible({ timeout: 30000 });
    const evaluationTime = Date.now() - startTime;
    
    // Verify results
    await expect(page.locator('[data-testid="results-accuracy"]')).toContainText('%');
    await expect(page.locator('[data-testid="results-processing-time"]')).toContainText('ms');
    
    // Export results
    await page.click('[data-testid="export-results"]');
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toMatch(/evaluation-results.*\.json/);
    
    // Verify performance
    expect(evaluationTime).toBeLessThan(60000); // Should complete within 1 minute
  });
  
  test('Real-time updates work correctly', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000/conversations/test-conversation');
    
    // Start evaluation in background
    await page.click('[data-testid="start-evaluation"]');
    
    // Verify real-time progress updates
    await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible();
    
    // Check for streaming results
    await expect(page.locator('[data-testid="turn-result-1"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="confidence-indicator"]')).toBeVisible();
    
    // Verify final completion
    await expect(page.locator('[data-testid="evaluation-complete"]')).toBeVisible({ timeout: 30000 });
  });
  
  test('Self-correction system works end-to-end', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000/conversations/test-conversation');
    
    // Process initial turn with error
    await page.fill('[data-testid="user-input"]', "I'm the vector of marketing");
    await page.click('[data-testid="process-turn"]');
    
    // Verify cleaned output appears
    await expect(page.locator('[data-testid="cleaned-output"]')).toContainText('Director of Marketing');
    
    // User provides correction
    await page.fill('[data-testid="user-input"]', "Actually, I meant Director of Operations");
    await page.click('[data-testid="process-turn"]');
    
    // Verify correction is applied
    await expect(page.locator('[data-testid="cleaned-output"]')).toContainText('Director of Operations');
    
    // Verify conversation state is updated
    const conversationHistory = page.locator('[data-testid="conversation-history"]');
    await expect(conversationHistory).toContainText('Director of Operations');
    await expect(conversationHistory).not.toContainText('Director of Marketing');
  });
});
```

**Load Testing**
```python
# Locust load testing
from locust import HttpUser, task, between
import random

class EvaluationLoadTest(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Setup test user and data"""
        # Login
        response = self.client.post("/api/v1/auth/login", json={
            "email": "loadtest@example.com",
            "password": "LoadTestPassword123!"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create test conversation
        conv_response = self.client.post("/api/v1/conversations",
            json={"name": f"Load Test {random.randint(1, 1000)}"},
            headers=self.headers
        )
        self.conversation_id = conv_response.json()["id"]
    
    @task(1)
    def list_conversations_performance(self):
        """Test conversation listing under load"""
        with self.client.get("/api/v1/conversations",
                           headers=self.headers,
                           catch_response=True) as response:
            if response.elapsed.total_seconds() * 1000 > 150:
                response.failure(f"Too slow: {response.elapsed.total_seconds() * 1000}ms")
    
    @task(3)
    def process_user_turns_concurrently(self):
        """Test concurrent user turn processing"""
        test_inputs = [
            "I'm the vector of marketing",
            "We have seventy five employees", 
            "Our book advertising is working",
            "We get fifty leads per month"
        ]
        
        turn_data = {
            "speaker": "User",
            "raw_text": random.choice(test_inputs)
        }
        
        with self.client.post(f"/api/v1/conversations/{self.conversation_id}/turns",
                            json=turn_data,
                            headers=self.headers,
                            catch_response=True) as response:
            
            if response.elapsed.total_seconds() * 1000 > 500:
                response.failure(f"User turn too slow: {response.elapsed.total_seconds() * 1000}ms")
            
            if response.status_code == 200:
                result = response.json()
                if not result.get("cleaned_text"):
                    response.failure("Missing cleaned text in response")
    
    @task(2)
    def websocket_connection_load(self):
        """Test WebSocket connection under load"""
        # This would require websocket support in Locust
        # or separate WebSocket load testing tool
        pass
```

## 🔒 Security Testing

### Authentication & Authorization Testing
```python
class TestSecurity:
    async def test_sql_injection_protection(self, client: TestClient):
        """Test SQL injection attack prevention"""
        malicious_inputs = [
            "'; DROP TABLE conversations; --",
            "' OR '1'='1",
            "' UNION SELECT * FROM users --"
        ]
        
        for malicious_input in malicious_inputs:
            response = client.post("/api/v1/conversations", 
                json={"name": malicious_input},
                headers=self.auth_headers
            )
            
            # Should not cause server error
            assert response.status_code in [200, 201, 400]
            
            # Database should still be intact
            conversations = client.get("/api/v1/conversations", headers=self.auth_headers)
            assert conversations.status_code == 200
    
    async def test_xss_protection(self, client: TestClient):
        """Test XSS attack prevention"""
        xss_payloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>"
        ]
        
        for payload in xss_payloads:
            response = client.post("/api/v1/conversations",
                json={"name": payload, "description": payload},
                headers=self.auth_headers
            )
            
            # Should sanitize input
            if response.status_code in [200, 201]:
                data = response.json()
                assert "<script>" not in data.get("name", "")
                assert "javascript:" not in data.get("description", "")
    
    async def test_rate_limiting(self, client: TestClient):
        """Test API rate limiting"""
        # Make rapid requests
        responses = []
        for i in range(100):
            response = client.get("/api/v1/conversations", headers=self.auth_headers)
            responses.append(response.status_code)
        
        # Should eventually rate limit
        assert 429 in responses  # Too Many Requests
    
    async def test_jwt_token_security(self, client: TestClient):
        """Test JWT token security"""
        # Test with invalid token
        invalid_headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/v1/conversations", headers=invalid_headers)
        assert response.status_code == 401
        
        # Test with expired token
        expired_token = self.create_expired_token()
        expired_headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/api/v1/conversations", headers=expired_headers)
        assert response.status_code == 401
        
        # Test with tampered token
        tampered_token = self.tamper_token(self.valid_token)
        tampered_headers = {"Authorization": f"Bearer {tampered_token}"}
        response = client.get("/api/v1/conversations", headers=tampered_headers)
        assert response.status_code == 401
```

## ♿ Accessibility Testing

### WCAG 2.1 AA Compliance Testing
```typescript
describe('Accessibility Tests', () => {
  test('All pages pass axe-core accessibility checks', async () => {
    const pages = [
      '/',
      '/login',
      '/conversations',
      '/conversations/new',
      '/evaluation/results'
    ];
    
    for (const page of pages) {
      const { container } = render(<Router initialPath={page} />);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    }
  });
  
  test('Keyboard navigation works correctly', async () => {
    const { getByRole, getByTestId } = render(<ConversationForm />);
    
    const nameInput = getByTestId('conversation-name');
    const descriptionInput = getByTestId('conversation-description');
    const submitButton = getByRole('button', { name: /create/i });
    
    // Tab through form elements
    nameInput.focus();
    expect(nameInput).toHaveFocus();
    
    fireEvent.keyDown(nameInput, { key: 'Tab' });
    expect(descriptionInput).toHaveFocus();
    
    fireEvent.keyDown(descriptionInput, { key: 'Tab' });
    expect(submitButton).toHaveFocus();
    
    // Test form submission with Enter key
    fireEvent.keyDown(submitButton, { key: 'Enter' });
    // Verify form submission logic
  });
  
  test('Screen reader announcements work correctly', async () => {
    const { getByRole } = render(<EvaluationProgress />);
    
    // Mock screen reader announcements
    const announcements = [];
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'div' && arguments[1]?.role === 'status') {
        const element = document.createElement('div');
        Object.defineProperty(element, 'textContent', {
          set: (text) => announcements.push(text)
        });
        return element;
      }
      return document.createElement(tagName);
    });
    
    // Trigger progress update
    fireEvent.click(getByRole('button', { name: /start evaluation/i }));
    
    // Verify announcements
    expect(announcements).toContain('Evaluation started');
    expect(announcements).toContain('Processing turn 1 of 10');
  });
  
  test('Color contrast meets WCAG requirements', () => {
    const { container } = render(<App />);
    
    // Check primary button contrast
    const primaryButton = container.querySelector('.btn-primary');
    const styles = getComputedStyle(primaryButton);
    
    const backgroundColor = styles.backgroundColor;
    const textColor = styles.color;
    
    const contrastRatio = calculateContrastRatio(backgroundColor, textColor);
    expect(contrastRatio).toBeGreaterThan(4.5); // WCAG AA requirement
  });
});
```

## 🌐 Cross-Browser Testing

### Browser Compatibility Matrix
```typescript
// Playwright cross-browser tests
const browsers = ['chromium', 'firefox', 'webkit'];

for (const browserName of browsers) {
  test.describe(`${browserName} compatibility`, () => {
    test.use({ browserName });
    
    test('Core functionality works across browsers', async ({ page }) => {
      await page.goto('http://127.0.0.1:3000');
      
      // Test basic navigation
      await page.click('[data-testid="conversations-link"]');
      await expect(page.locator('[data-testid="conversations-list"]')).toBeVisible();
      
      // Test form interactions
      await page.click('[data-testid="new-conversation"]');
      await page.fill('[data-testid="conversation-name"]', 'Browser Test');
      await page.click('[data-testid="create-button"]');
      
      // Test real-time features
      await page.click('[data-testid="start-evaluation"]');
      await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible();
    });
    
    test('Performance meets targets across browsers', async ({ page }) => {
      await page.goto('http://127.0.0.1:3000');
      
      // Measure page load performance
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        };
      });
      
      expect(performanceMetrics.domContentLoaded).toBeLessThan(3000);
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2000);
    });
  });
}
```

## 🤖 Automated Testing & CI/CD

### GitHub Actions CI Pipeline
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Run unit tests
        run: cd frontend && npm run test:unit
      
      - name: Run integration tests
        run: cd frontend && npm run test:integration
      
      - name: Check test coverage
        run: cd frontend && npm run test:coverage
        env:
          COVERAGE_THRESHOLD: 95
      
      - name: Run accessibility tests
        run: cd frontend && npm run test:a11y
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3

  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest-cov
      
      - name: Run unit tests
        run: cd backend && pytest tests/unit --cov=app --cov-report=xml
      
      - name: Run integration tests
        run: cd backend && pytest tests/integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run security tests
        run: |
          cd backend
          pip install bandit safety
          bandit -r app/
          safety check
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Start application
        run: |
          # Start backend
          cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000 &
          
          # Start frontend
          cd frontend && npm run build && npm run start &
          
          # Wait for services to be ready
          npx wait-on http://127.0.0.1:3000 http://127.0.0.1:8000/health
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
      
      - name: Run load tests
        run: |
          cd backend
          pip install locust
          locust --headless -u 10 -r 2 -t 30s --host http://127.0.0.1:8000
```

## 📊 Quality Gates & Success Criteria

### Phase-Specific Quality Gates

**Week 1 Quality Gate:**
- [ ] All unit tests pass (>90% coverage)
- [ ] Authentication flow works end-to-end
- [ ] Database migrations apply successfully
- [ ] API health checks respond correctly
- [ ] Basic UI components render properly

**Week 2 Quality Gate:**
- [ ] CleanerContext tests pass (>95% coverage)
- [ ] Stateful cleaning works correctly
- [ ] Lumen turn bypass under 10ms
- [ ] JSON output format compliance
- [ ] Cleaning decision accuracy >85%

**Week 3 Quality Gate:**
- [ ] Real-time WebSocket tests pass
- [ ] UI performance meets sub-100ms targets
- [ ] Design system accessibility compliance
- [ ] Self-correction system works end-to-end
- [ ] Cross-browser compatibility verified

**Week 4 Quality Gate:**
- [ ] All test suites pass (>95% coverage)
- [ ] Load testing meets performance targets
- [ ] Security testing shows no vulnerabilities
- [ ] E2E tests cover all critical workflows
- [ ] Production deployment successful

### Continuous Quality Monitoring

```typescript
// Quality metrics dashboard
interface QualityMetrics {
  test_coverage: {
    frontend_unit: number;     // Target: >95%
    backend_unit: number;      // Target: >95%
    integration: number;       // Target: >90%
    e2e: number;              // Target: >80%
  };
  
  performance: {
    ui_feedback_time: number;  // Target: <50ms
    api_response_time: number; // Target: <100ms
    page_load_time: number;    // Target: <2s
    bundle_size: number;       // Target: <2MB
  };
  
  accessibility: {
    wcag_compliance: number;   // Target: 100%
    keyboard_navigation: boolean; // Target: true
    screen_reader_support: boolean; // Target: true
    color_contrast: number;    // Target: >4.5
  };
  
  security: {
    vulnerabilities: number;   // Target: 0
    auth_coverage: number;     // Target: 100%
    input_validation: number;  // Target: 100%
    security_headers: boolean; // Target: true
  };
}
```

---

This comprehensive testing strategy ensures quality at every step of development, with specific tests for each component of the cleanercontext.md vision and robust validation of all performance and security requirements.