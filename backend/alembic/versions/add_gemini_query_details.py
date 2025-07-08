"""add gemini query details to turns

Revision ID: add_gemini_query_details
Revises: 
Create Date: 2025-01-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_gemini_query_details'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to turns table
    op.add_column('turns', sa.Column('timing_breakdown', sa.JSON(), nullable=True))
    op.add_column('turns', sa.Column('gemini_prompt', sa.Text(), nullable=True))
    op.add_column('turns', sa.Column('gemini_response', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove columns
    op.drop_column('turns', 'gemini_response')
    op.drop_column('turns', 'gemini_prompt')
    op.drop_column('turns', 'timing_breakdown')