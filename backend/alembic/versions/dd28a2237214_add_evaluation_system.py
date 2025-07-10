"""add_evaluation_system

Revision ID: dd28a2237214
Revises: f097f0553e29
Create Date: 2025-07-10 19:08:57.933963

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd28a2237214'
down_revision: Union[str, Sequence[str], None] = 'f097f0553e29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create evaluations table
    op.create_table('evaluations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('prompt_template', sa.Text(), nullable=True),
        sa.Column('settings', sa.JSON(), nullable=True),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, default='active'),
        sa.Column('turns_processed', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create cleaned_turns table
    op.create_table('cleaned_turns',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('evaluation_id', sa.UUID(), nullable=False),
        sa.Column('turn_id', sa.UUID(), nullable=False),
        sa.Column('cleaned_text', sa.Text(), nullable=False),
        sa.Column('confidence_score', sa.String(length=10), nullable=False),
        sa.Column('cleaning_applied', sa.String(length=10), nullable=False),
        sa.Column('cleaning_level', sa.String(length=20), nullable=False),
        sa.Column('processing_time_ms', sa.Float(), nullable=False),
        sa.Column('corrections', sa.JSON(), nullable=True),
        sa.Column('context_detected', sa.String(length=100), nullable=True),
        sa.Column('ai_model_used', sa.String(length=100), nullable=True),
        sa.Column('timing_breakdown', sa.JSON(), nullable=True),
        sa.Column('gemini_prompt', sa.Text(), nullable=True),
        sa.Column('gemini_response', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['evaluation_id'], ['evaluations.id'], ),
        sa.ForeignKeyConstraint(['turn_id'], ['turns.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('cleaned_turns')
    op.drop_table('evaluations')
