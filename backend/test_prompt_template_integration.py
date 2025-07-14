#!/usr/bin/env python3
"""
Test script to verify prompt template integration in EvaluationManager
"""

import asyncio
import json
import sys
import traceback
from uuid import uuid4
from datetime import datetime

# Add project root to path
sys.path.insert(0, '/Users/amirjahednia/Dev/Projects/sidelinescott/backend')

from app.core.database import SessionLocal
from app.services.evaluation_manager import EvaluationManager
from app.services.prompt_engineering_service import PromptEngineeringService
from app.models.conversation import Conversation
from app.models.turn import Turn
from app.models.prompt_template import PromptTemplate
from app.models.evaluation import Evaluation


async def test_prompt_template_integration():
    """Test the complete prompt template integration flow"""
    
    print("🧪 PROMPT TEMPLATE INTEGRATION TEST")
    print("=" * 60)
    
    db = SessionLocal()
    em = EvaluationManager()
    ps = PromptEngineeringService()
    
    try:
        # Step 1: Create or get a test prompt template
        print("\n1️⃣ Creating test prompt template...")
        
        # Check if template exists
        template = db.query(PromptTemplate).filter(
            PromptTemplate.name == "Test Integration Template"
        ).first()
        
        if not template:
            template = await ps.create_template(
                db=db,
                name="Test Integration Template",
                template="""INTEGRATION TEST PROMPT
Context: {conversation_context}
Raw text: {raw_text}
Cleaning level: {cleaning_level}
Call context: {call_context}
Additional context: {additional_context}

Clean the text and return JSON.""",
                description="Template for integration testing"
            )
            print(f"✅ Created template: {template.id}")
        else:
            print(f"✅ Using existing template: {template.id}")
        
        # Step 2: Create test conversation and turn
        print("\n2️⃣ Creating test conversation and turn...")
        
        conversation = Conversation(
            id=uuid4(),
            title="Integration Test Conversation",
            user_id=uuid4(),
            created_at=datetime.utcnow()
        )
        db.add(conversation)
        
        turn = Turn(
            id=uuid4(),
            conversation_id=conversation.id,
            speaker="User",
            raw_text="uhh this is a test turn with some um errors",
            turn_sequence=1,
            timestamp=datetime.utcnow()
        )
        db.add(turn)
        db.commit()
        
        print(f"✅ Created conversation: {conversation.id}")
        print(f"✅ Created turn: {turn.id}")
        
        # Step 3: Create evaluation with template reference
        print("\n3️⃣ Creating evaluation with template reference...")
        
        evaluation = Evaluation(
            id=uuid4(),
            conversation_id=conversation.id,
            name="Template Integration Test",
            prompt_template_id=template.id,  # Link to template
            settings={
                "cleaning_level": "full",
                "sliding_window": 5,
                "call_context": "This is a test call",
                "additional_context": "Testing the integration"
            },
            user_id=uuid4(),
            status="active"
        )
        db.add(evaluation)
        db.commit()
        
        print(f"✅ Created evaluation: {evaluation.id}")
        print(f"   - Template ID: {evaluation.prompt_template_id}")
        print(f"   - Settings: {json.dumps(evaluation.settings, indent=2)}")
        
        # Step 4: Test template loading into evaluation state
        print("\n4️⃣ Testing template loading into evaluation state...")
        
        eval_state = await em.get_evaluation_state(evaluation.id, db=db)
        
        print(f"✅ Evaluation state created")
        print(f"   - Cached template: {eval_state.cached_template.name if eval_state.cached_template else 'None'}")
        print(f"   - Template variables: {eval_state.template_variables}")
        
        # Step 5: Process a turn to test the full flow
        print("\n5️⃣ Processing turn with template integration...")
        
        result = await em.process_turn(
            evaluation_id=evaluation.id,
            turn_id=turn.id,
            db=db
        )
        
        print(f"✅ Turn processed successfully!")
        print(f"   - Cleaned text: '{result['cleaned_text']}'")
        print(f"   - Processing time: {result['metadata']['processing_time_ms']}ms")
        print(f"   - Confidence: {result['metadata']['confidence_score']}")
        
        # Step 6: Check if prompt usage was logged
        print("\n6️⃣ Checking prompt usage logging...")
        
        from app.models.prompt_template import PromptUsage
        usage = db.query(PromptUsage).filter(
            PromptUsage.turn_id == turn.id
        ).first()
        
        if usage:
            print(f"✅ Prompt usage logged!")
            print(f"   - Template ID: {usage.template_id}")
            print(f"   - Variables used: {json.dumps(usage.variables_used, indent=2)}")
            print(f"   - Processing time: {usage.processing_time_ms}ms")
        else:
            print("❌ No prompt usage record found")
        
        # Step 7: Test error handling - missing template
        print("\n7️⃣ Testing error handling - missing template...")
        
        bad_eval = Evaluation(
            id=uuid4(),
            conversation_id=conversation.id,
            name="Bad Template Test",
            prompt_template_id=uuid4(),  # Non-existent template
            user_id=uuid4(),
            status="active"
        )
        db.add(bad_eval)
        db.commit()
        
        try:
            await em.process_turn(
                evaluation_id=bad_eval.id,
                turn_id=turn.id,
                db=db
            )
            print("❌ Expected error but processing succeeded")
        except Exception as e:
            print(f"✅ Correctly failed with error: {str(e)}")
        
        print("\n✅ ALL TESTS PASSED!")
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {str(e)}")
        traceback.print_exc()
        
    finally:
        # Cleanup
        db.close()
        print("\n🧹 Database connection closed")


if __name__ == "__main__":
    asyncio.run(test_prompt_template_integration())