"""Add context fields to conversations table

Revision ID: 006
Revises: 005
Create Date: 2025-01-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    # Add context fields to conversations table
    op.add_column('conversations', sa.Column('call_context', sa.Text(), nullable=True))
    op.add_column('conversations', sa.Column('additional_context', sa.Text(), nullable=True))


def downgrade():
    # Remove context fields from conversations table
    op.drop_column('conversations', 'additional_context')
    op.drop_column('conversations', 'call_context')