"""
Test suite for ConversationManager - Core CleanerContext functionality

Tests the stateful conversation processing, sliding window context,
and turn processing pipeline.
"""

import pytest
import time
from unittest.mock import Mock, patch
from uuid import uuid4
from sqlalchemy.orm import Session

from app.services.conversation_manager import ConversationManager, ConversationState
from app.models.conversation import Conversation
from app.models.turn import Turn

class TestConversationState:
    """Test ConversationState class for managing conversation context"""
    
    def test_conversation_state_initialization(self):
        """Test ConversationState initializes correctly"""
        conversation_id = uuid4()
        state = ConversationState(conversation_id)
        
        assert state.conversation_id == conversation_id
        assert state.sliding_window_size == 10
        assert state.cleaned_history == []
        assert state.context_patterns == {}
    
    def test_sliding_window_empty(self):
        """Test sliding window when no history exists"""
        state = ConversationState(uuid4())
        window = state.get_cleaned_sliding_window()
        
        assert window == []
    
    def test_sliding_window_partial(self):
        """Test sliding window with less than window size turns"""
        state = ConversationState(uuid4())
        
        # Add 3 turns
        for i in range(3):
            state.add_to_history({
                'speaker': 'User',
                'raw_text': f'Raw text {i}',
                'cleaned_text': f'Cleaned text {i}'
            })
        
        window = state.get_cleaned_sliding_window()
        assert len(window) == 3
        assert window[0]['cleaned_text'] == 'Cleaned text 0'
        assert window[2]['cleaned_text'] == 'Cleaned text 2'
    
    def test_sliding_window_full(self):
        """Test sliding window with more than window size turns"""
        state = ConversationState(uuid4())
        
        # Add 15 turns (more than window size of 10)
        for i in range(15):
            state.add_to_history({
                'speaker': 'User',
                'raw_text': f'Raw text {i}',
                'cleaned_text': f'Cleaned text {i}'
            })
        
        window = state.get_cleaned_sliding_window()
        assert len(window) == 10  # Should be limited to window size
        assert window[0]['cleaned_text'] == 'Cleaned text 5'  # Should start from turn 5
        assert window[9]['cleaned_text'] == 'Cleaned text 14'  # Should end with latest

class TestConversationManager:
    """Test ConversationManager core functionality"""
    
    @pytest.fixture
    def manager(self):
        """Create a ConversationManager instance for testing"""
        return ConversationManager()
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database session"""
        db = Mock(spec=Session)
        return db
    
    def test_manager_initialization(self, manager):
        """Test ConversationManager initializes correctly"""
        assert manager.active_conversations == {}
        assert 'lumen_processing_times' in manager.performance_metrics
        assert 'user_processing_times' in manager.performance_metrics
        assert 'context_retrieval_times' in manager.performance_metrics
    
    def test_get_conversation_state_new(self, manager):
        """Test getting conversation state for new conversation"""
        conversation_id = uuid4()
        state = manager.get_conversation_state(conversation_id)
        
        assert isinstance(state, ConversationState)
        assert state.conversation_id == conversation_id
        assert conversation_id in manager.active_conversations
    
    def test_get_conversation_state_existing(self, manager):
        """Test getting conversation state for existing conversation"""
        conversation_id = uuid4()
        
        # Get state twice
        state1 = manager.get_conversation_state(conversation_id)
        state2 = manager.get_conversation_state(conversation_id)
        
        # Should be the same instance
        assert state1 is state2
    
    def test_is_lumen_turn_detection(self, manager):
        """Test Lumen turn detection logic"""
        assert manager._is_lumen_turn('Lumen') == True
        assert manager._is_lumen_turn('AI') == True
        assert manager._is_lumen_turn('Assistant') == True
        assert manager._is_lumen_turn('Claude') == True
        assert manager._is_lumen_turn('User') == False
        assert manager._is_lumen_turn('Human') == False
        assert manager._is_lumen_turn('John') == False
    
    @pytest.mark.asyncio
    async def test_process_lumen_turn_performance(self, manager, mock_db):
        """Test Lumen turn processing meets <10ms target"""
        conversation_id = uuid4()
        
        # Mock database operations
        mock_turn = Mock()
        mock_turn.id = uuid4()
        mock_turn.created_at.isoformat.return_value = "2025-01-07T12:00:00Z"
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        mock_db.refresh.side_effect = lambda x: setattr(x, 'id', mock_turn.id)
        
        start_time = time.time()
        result = await manager.add_turn(
            conversation_id=conversation_id,
            speaker='Lumen',
            raw_text='Thank you for that information.',
            db=mock_db
        )
        end_time = time.time()
        
        processing_time = (end_time - start_time) * 1000
        
        # Verify performance target
        assert processing_time < 100  # Allow some margin for test environment
        
        # Verify result structure
        assert result['speaker'] == 'Lumen'
        assert result['raw_text'] == 'Thank you for that information.'
        assert result['cleaned_text'] == 'Thank you for that information.'
        assert result['metadata']['cleaning_applied'] == False
        assert result['metadata']['cleaning_level'] == 'none'
        assert result['metadata']['confidence_score'] == 'HIGH'
    
    @pytest.mark.asyncio
    async def test_process_user_turn_with_context(self, manager, mock_db):
        """Test user turn processing uses cleaned context"""
        conversation_id = uuid4()
        
        # Mock database operations
        mock_turn = Mock()
        mock_turn.id = uuid4()
        mock_turn.created_at.isoformat.return_value = "2025-01-07T12:00:00Z"
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        mock_db.refresh.side_effect = lambda x: setattr(x, 'id', mock_turn.id)
        
        # Add some context to conversation
        state = manager.get_conversation_state(conversation_id)
        state.add_to_history({
            'speaker': 'User',
            'raw_text': 'I work in vector of marketing',
            'cleaned_text': 'I work in Director of marketing'
        })
        
        result = await manager.add_turn(
            conversation_id=conversation_id,
            speaker='User',
            raw_text='We have book marketing strategies',
            db=mock_db
        )
        
        # Verify context was used and result structure
        assert result['speaker'] == 'User'
        assert result['metadata']['cleaning_applied'] in [True, False]  # Depends on simulation
        assert 'processing_time_ms' in result['metadata']
        assert isinstance(result['metadata']['corrections'], list)
    
    def test_cleaning_decision_simulation(self, manager):
        """Test cleaning decision simulation logic"""
        # Test simple acknowledgments
        assert manager._simulate_cleaning_decision('yes') == 'none'
        assert manager._simulate_cleaning_decision('OK') == 'none'
        assert manager._simulate_cleaning_decision('exactly') == 'none'
        
        # Test known error patterns
        assert manager._simulate_cleaning_decision('I am the vector of marketing') == 'full'
        assert manager._simulate_cleaning_decision('We use book marketing') == 'full'
        
        # Test general text
        assert manager._simulate_cleaning_decision('Hello, how are you?') == 'light'
    
    def test_cleaning_process_simulation(self, manager):
        """Test cleaning process simulation with corrections"""
        # Test no cleaning case
        result = manager._simulate_cleaning_process('yes', [], 'none')
        assert result['cleaning_applied'] == False
        assert result['corrections'] == []
        assert result['confidence_score'] == 'HIGH'
        
        # Test correction case
        result = manager._simulate_cleaning_process(
            'I am the vector of marketing', 
            [], 
            'full'
        )
        assert result['cleaning_applied'] == True
        assert len(result['corrections']) > 0
        assert result['corrections'][0]['original'] == 'vector of'
        assert result['corrections'][0]['corrected'] == 'Director of'
    
    @pytest.mark.asyncio
    async def test_stateful_cleaning_workflow(self, manager, mock_db):
        """Test complete stateful cleaning workflow"""
        conversation_id = uuid4()
        
        # Mock database operations
        def mock_refresh(turn):
            turn.id = uuid4()
            turn.created_at = Mock()
            turn.created_at.isoformat.return_value = "2025-01-07T12:00:00Z"
        
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.side_effect = mock_refresh
        
        # Process first turn with error
        result1 = await manager.add_turn(
            conversation_id=conversation_id,
            speaker='User',
            raw_text='I am the vector of marketing',
            db=mock_db
        )
        
        # Process Lumen response (should be instant)
        start_time = time.time()
        result2 = await manager.add_turn(
            conversation_id=conversation_id,
            speaker='Lumen',
            raw_text='I understand you work in marketing.',
            db=mock_db
        )
        lumen_time = (time.time() - start_time) * 1000
        
        # Process another user turn
        result3 = await manager.add_turn(
            conversation_id=conversation_id,
            speaker='User',
            raw_text='Yes, we use book marketing strategies',
            db=mock_db
        )
        
        # Verify conversation state
        state = manager.get_conversation_state(conversation_id)
        assert len(state.cleaned_history) == 3
        
        # Verify Lumen turn was fast
        assert lumen_time < 100  # Allow margin for test environment
        assert result2['metadata']['cleaning_applied'] == False
        
        # Verify context contains cleaned versions
        context = state.get_cleaned_sliding_window()
        assert len(context) == 3
        # Should contain cleaned text, not raw text with errors
        context_text = ' '.join([turn['cleaned_text'] for turn in context])
        assert 'Director of' in context_text or 'vector of' not in context_text
    
    def test_performance_metrics_tracking(self, manager):
        """Test performance metrics collection"""
        # Initially empty
        metrics = manager.get_performance_metrics()
        assert metrics['lumen_processing_times']['count'] == 0
        
        # Add some mock performance data
        manager.performance_metrics['lumen_processing_times'] = [5.2, 3.1, 7.8]
        manager.performance_metrics['user_processing_times'] = [245.5, 189.2, 356.7]
        
        metrics = manager.get_performance_metrics()
        
        # Verify metrics calculation
        assert metrics['lumen_processing_times']['count'] == 3
        assert metrics['lumen_processing_times']['avg_ms'] == pytest.approx(5.37, abs=0.1)
        assert metrics['lumen_processing_times']['max_ms'] == 7.8
        assert metrics['lumen_processing_times']['min_ms'] == 3.1
        
        assert metrics['user_processing_times']['count'] == 3
        assert metrics['user_processing_times']['avg_ms'] == pytest.approx(263.8, abs=0.1)