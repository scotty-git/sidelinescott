import pytest
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import User, Conversation, Turn
import uuid


class TestUserModel:
    """Test the User model."""
    
    def test_create_user(self, db_session: Session):
        """Test creating a user."""
        user = User(
            email="test@example.com",
            is_active=True
        )
        
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        assert user.id is not None
        assert isinstance(user.id, str)  # UUID as string
        assert user.email == "test@example.com"
        assert user.is_active is True
        assert isinstance(user.created_at, datetime)
        assert isinstance(user.updated_at, datetime)
    
    def test_user_email_unique(self, db_session: Session):
        """Test that user emails must be unique."""
        user1 = User(email="test@example.com", is_active=True)
        user2 = User(email="test@example.com", is_active=True)
        
        db_session.add(user1)
        db_session.commit()
        
        db_session.add(user2)
        
        with pytest.raises(Exception):  # Should raise integrity error
            db_session.commit()
    
    def test_user_relationships(self, db_session: Session):
        """Test user-conversation relationship."""
        user = User(email="test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        conversation = Conversation(
            user_id=user.id,
            name="Test Conversation",
            status="active",
            turns_count=0
        )
        db_session.add(conversation)
        db_session.commit()
        
        # Test relationship
        assert len(user.conversations) == 1
        assert user.conversations[0].name == "Test Conversation"


class TestConversationModel:
    """Test the Conversation model."""
    
    def test_create_conversation(self, db_session: Session):
        """Test creating a conversation."""
        user = User(email="test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        conversation = Conversation(
            user_id=user.id,
            name="Test Conversation",
            description="A test conversation",
            status="active",
            turns_count=0,
            conversation_metadata={"test": True}
        )
        
        db_session.add(conversation)
        db_session.commit()
        db_session.refresh(conversation)
        
        assert conversation.id is not None
        assert isinstance(conversation.id, str)  # UUID as string
        assert conversation.user_id == user.id
        assert conversation.name == "Test Conversation"
        assert conversation.description == "A test conversation"
        assert conversation.status == "active"
        assert conversation.turns_count == 0
        assert conversation.conversation_metadata == {"test": True}
        assert isinstance(conversation.created_at, datetime)
        assert isinstance(conversation.updated_at, datetime)
    
    def test_conversation_required_fields(self, db_session: Session):
        """Test that required fields are enforced."""
        user = User(email="test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # Missing name should fail
        conversation = Conversation(
            user_id=user.id,
            status="active",
            turns_count=0
        )
        
        db_session.add(conversation)
        
        with pytest.raises(Exception):  # Should raise integrity error
            db_session.commit()
    
    def test_conversation_turns_relationship(self, db_session: Session):
        """Test conversation-turns relationship."""
        user = User(email="test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        conversation = Conversation(
            user_id=user.id,
            name="Test Conversation",
            status="active",
            turns_count=0
        )
        db_session.add(conversation)
        db_session.commit()
        db_session.refresh(conversation)
        
        turn = Turn(
            conversation_id=conversation.id,
            speaker="User",
            raw_text="Hello",
            cleaned_text="Hello"
        )
        db_session.add(turn)
        db_session.commit()
        
        # Test relationship
        assert len(conversation.turns) == 1
        assert conversation.turns[0].raw_text == "Hello"


class TestTurnModel:
    """Test the Turn model."""
    
    def test_create_basic_turn(self, db_session: Session):
        """Test creating a basic turn."""
        user = User(email="test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        conversation = Conversation(
            user_id=user.id,
            name="Test Conversation",
            status="active",
            turns_count=0
        )
        db_session.add(conversation)
        db_session.commit()
        db_session.refresh(conversation)
        
        turn = Turn(
            conversation_id=conversation.id,
            speaker="User",
            raw_text="I'm the vector of Marketing",
            cleaned_text="I'm the Director of Marketing"
        )
        
        db_session.add(turn)
        db_session.commit()
        db_session.refresh(turn)
        
        assert turn.id is not None
        assert isinstance(turn.id, str)  # UUID as string
        assert turn.conversation_id == conversation.id
        assert turn.speaker == "User"
        assert turn.raw_text == "I'm the vector of Marketing"
        assert turn.cleaned_text == "I'm the Director of Marketing"
        assert isinstance(turn.created_at, datetime)
    
    def test_create_turn_with_cleaner_metadata(self, db_session: Session):
        """Test creating a turn with full CleanerContext metadata."""
        user = User(email="test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        conversation = Conversation(
            user_id=user.id,
            name="Test Conversation",
            status="active",
            turns_count=0
        )
        db_session.add(conversation)
        db_session.commit()
        db_session.refresh(conversation)
        
        corrections = [
            {
                "original": "vector of",
                "corrected": "Director of",
                "confidence": "HIGH",
                "reason": "contextual_understanding"
            }
        ]
        
        turn = Turn(
            conversation_id=conversation.id,
            speaker="User",
            raw_text="I'm the vector of Marketing",
            cleaned_text="I'm the Director of Marketing",
            confidence_score="HIGH",
            cleaning_applied=True,
            cleaning_level="full",
            processing_time_ms=250,
            corrections=corrections,
            context_detected="identity_discussion",
            ai_model_used="gemini-pro"
        )
        
        db_session.add(turn)
        db_session.commit()
        db_session.refresh(turn)
        
        assert turn.confidence_score == "HIGH"
        assert turn.cleaning_applied is True
        assert turn.cleaning_level == "full"
        assert turn.processing_time_ms == 250
        assert turn.corrections == corrections
        assert turn.context_detected == "identity_discussion"
        assert turn.ai_model_used == "gemini-pro"
    
    def test_create_lumen_turn(self, db_session: Session):
        """Test creating a Lumen turn (no processing)."""
        user = User(email="test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        conversation = Conversation(
            user_id=user.id,
            name="Test Conversation",
            status="active",
            turns_count=0
        )
        db_session.add(conversation)
        db_session.commit()
        db_session.refresh(conversation)
        
        turn = Turn(
            conversation_id=conversation.id,
            speaker="Lumen",
            raw_text="I understand you're the Director of Marketing.",
            cleaned_text="I understand you're the Director of Marketing.",
            confidence_score="HIGH",
            cleaning_applied=False,
            cleaning_level="none",
            processing_time_ms=5,
            corrections=[],
            context_detected="acknowledgment",
            ai_model_used="none"
        )
        
        db_session.add(turn)
        db_session.commit()
        db_session.refresh(turn)
        
        assert turn.speaker == "Lumen"
        assert turn.raw_text == turn.cleaned_text  # No cleaning for Lumen
        assert turn.cleaning_applied is False
        assert turn.cleaning_level == "none"
        assert turn.processing_time_ms == 5  # Very fast for Lumen
        assert turn.corrections == []
        assert turn.ai_model_used == "none"
    
    def test_turn_required_fields(self, db_session: Session):
        """Test that required fields are enforced."""
        user = User(email="test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        conversation = Conversation(
            user_id=user.id,
            name="Test Conversation",
            status="active",
            turns_count=0
        )
        db_session.add(conversation)
        db_session.commit()
        db_session.refresh(conversation)
        
        # Missing required fields should fail
        turn = Turn(
            conversation_id=conversation.id,
            # Missing speaker and raw_text
            cleaned_text="Hello"
        )
        
        db_session.add(turn)
        
        with pytest.raises(Exception):  # Should raise integrity error
            db_session.commit()


class TestModelPerformance:
    """Test model performance characteristics."""
    
    def test_bulk_turn_creation(self, db_session: Session):
        """Test creating multiple turns efficiently."""
        import time
        
        user = User(email="test@example.com", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        conversation = Conversation(
            user_id=user.id,
            name="Performance Test",
            status="active",
            turns_count=0
        )
        db_session.add(conversation)
        db_session.commit()
        db_session.refresh(conversation)
        
        start_time = time.time()
        
        # Create 50 turns
        turns = []
        for i in range(50):
            turn = Turn(
                conversation_id=conversation.id,
                speaker="User" if i % 2 == 0 else "Lumen",
                raw_text=f"Turn {i} content",
                cleaned_text=f"Turn {i} content"
            )
            turns.append(turn)
        
        db_session.add_all(turns)
        db_session.commit()
        
        end_time = time.time()
        creation_time = (end_time - start_time) * 1000
        
        # Should complete reasonably quickly
        assert creation_time < 5000  # 5 seconds max for 50 turns
        
        # Verify all turns were created
        turn_count = db_session.query(Turn).filter_by(conversation_id=conversation.id).count()
        assert turn_count == 50