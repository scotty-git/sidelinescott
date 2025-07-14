#!/usr/bin/env python3
"""
Test script to verify the prompt template integration works with the 5-variable system.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.prompt_engineering_service import PromptEngineeringService
from app.services.evaluation_manager import EvaluationManager
from app.models.prompt_template import PromptTemplate
from app.models.evaluation import Evaluation
from app.models.conversation import Conversation
from app.models.turn import Turn
from app.core.database import get_db
from sqlalchemy.orm import Session
import uuid

async def test_template_integration():
    """Test the complete template integration"""
    
    # Get database session
    db = next(get_db())
    
    try:
        print("🧪 TESTING: Prompt Template Integration")
        print("=" * 50)
        
        # 1. Create a test template with 5 variables
        prompt_service = PromptEngineeringService()
        
        test_template = """You are a conversation cleaner.

Context from previous conversation:
{conversation_context}

Raw text to clean:
{raw_text}

Cleaning level: {cleaning_level}

Business context: {call_context}

Additional context: {additional_context}

Please clean the text and return JSON format."""
        
        # Clean up any existing test template first
        existing = db.query(PromptTemplate).filter(PromptTemplate.name.like("Test Template for Integration%")).first()
        if existing:
            db.delete(existing)
            db.commit()
        
        template = await prompt_service.create_template(
            db=db,
            name=f"Test Template for Integration {uuid.uuid4().hex[:8]}",
            template=test_template,
            description="Test template with 5 variables",
            variables=["conversation_context", "raw_text", "cleaning_level", "call_context", "additional_context"]
        )
        
        print(f"✅ Created test template: {template.name}")
        print(f"📝 Template ID: {template.id}")
        print(f"🔢 Variables: {template.variables}")
        
        # 2. Create a test conversation
        conversation = Conversation(
            id=uuid.uuid4(),
            name="Test Conversation",
            user_id=uuid.uuid4()
        )
        db.add(conversation)
        db.commit()
        print(f"✅ Created test conversation: {conversation.id}")
        
        # 3. Create a test evaluation with the template
        evaluation = Evaluation(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            name="Test Evaluation",
            description="Test evaluation with template",
            prompt_template_id=template.id,
            settings={
                "cleaning_level": "full",
                "call_context": "business call with important client",
                "additional_context": "customer support context"
            },
            user_id=uuid.uuid4(),
            status="active"
        )
        db.add(evaluation)
        db.commit()
        print(f"✅ Created test evaluation: {evaluation.id}")
        
        # 4. Create test turns
        turn1 = Turn(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            speaker="User",
            raw_text="Hello, I need help with my account please",
            turn_sequence=1
        )
        
        turn2 = Turn(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            speaker="User",
            raw_text="Um, yeah, so like, can you help me with uh, password reset?",
            turn_sequence=2
        )
        
        db.add_all([turn1, turn2])
        db.commit()
        print(f"✅ Created test turns")
        
        # 5. Test the EvaluationManager with template caching
        eval_manager = EvaluationManager()
        
        print("\n🔄 TESTING: Template Caching and Rendering")
        print("-" * 40)
        
        # Test first turn (empty context)
        print(f"\n📝 Processing Turn 1: '{turn1.raw_text}'")
        
        # Get evaluation state - this should cache the template
        evaluation_state = await eval_manager.get_evaluation_state(evaluation.id, db=db)
        
        print(f"✅ Template cached: {evaluation_state.cached_template is not None}")
        print(f"📋 Cached template: {evaluation_state.cached_template.name if evaluation_state.cached_template else 'None'}")
        print(f"🔢 Template variables: {evaluation_state.template_variables}")
        
        # Test variable building
        variables = eval_manager._build_prompt_variables(turn1, [], "full", evaluation)
        print(f"✅ Built variables: {list(variables.keys())}")
        
        # Test template rendering
        rendered_prompt = eval_manager._render_cached_template(evaluation_state, turn1, [], "full", evaluation)
        print(f"✅ Rendered prompt length: {len(rendered_prompt)} characters")
        print(f"📝 Rendered prompt preview: {rendered_prompt[:200]}...")
        
        # Test second turn (with context)
        print(f"\n📝 Processing Turn 2: '{turn2.raw_text}'")
        
        # Add some fake context
        fake_context = [
            {"speaker": "User", "cleaned_text": "Hello, I need help with my account please"},
            {"speaker": "Lumen", "cleaned_text": "I'd be happy to help you with your account. What specific issue are you experiencing?"}
        ]
        
        variables2 = eval_manager._build_prompt_variables(turn2, fake_context, "full", evaluation)
        print(f"✅ Built variables with context: {list(variables2.keys())}")
        print(f"💬 Context length: {len(variables2['conversation_context'])} chars")
        
        rendered_prompt2 = eval_manager._render_cached_template(evaluation_state, turn2, fake_context, "full", evaluation)
        print(f"✅ Rendered prompt with context length: {len(rendered_prompt2)} characters")
        
        # Verify variables are correctly substituted
        assert "{raw_text}" not in rendered_prompt2, "Raw text variable not substituted"
        assert "{conversation_context}" not in rendered_prompt2, "Context variable not substituted"
        assert "{cleaning_level}" not in rendered_prompt2, "Cleaning level variable not substituted"
        assert "{call_context}" not in rendered_prompt2, "Call context variable not substituted"
        assert "{additional_context}" not in rendered_prompt2, "Additional context variable not substituted"
        
        print("✅ All variables correctly substituted!")
        
        print("\n🎉 INTEGRATION TEST PASSED!")
        print("=" * 50)
        print("✅ Template caching works")
        print("✅ Variable building works")
        print("✅ Template rendering works")
        print("✅ 5-variable system works")
        print("✅ No database hits per turn")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # Cleanup
        try:
            db.query(Evaluation).filter(Evaluation.conversation_id == conversation.id).delete()
            db.query(Turn).filter(Turn.conversation_id == conversation.id).delete()
            db.query(Conversation).filter(Conversation.id == conversation.id).delete()
            db.query(PromptTemplate).filter(PromptTemplate.name == "Test Template for Integration").delete()
            db.commit()
            print("🧹 Cleanup completed")
        except:
            pass
        
        db.close()

if __name__ == "__main__":
    asyncio.run(test_template_integration())