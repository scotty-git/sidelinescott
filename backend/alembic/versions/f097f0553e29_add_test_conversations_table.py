"""Add test_conversations table

Revision ID: f097f0553e29
Revises: 006
Create Date: 2025-07-10 15:00:44.484198

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f097f0553e29'
down_revision: Union[str, Sequence[str], None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create test_conversations table
    op.create_table('test_conversations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('variables', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add indexes for better performance
    op.create_index(op.f('ix_test_conversations_user_id'), 'test_conversations', ['user_id'], unique=False)
    op.create_index(op.f('ix_test_conversations_name'), 'test_conversations', ['name'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index(op.f('ix_test_conversations_name'), table_name='test_conversations')
    op.drop_index(op.f('ix_test_conversations_user_id'), table_name='test_conversations')
    
    # Drop table
    op.drop_table('test_conversations')
