"""Add gemini_http_request to called_functions table

Revision ID: add_gemini_http_request_to_called_functions
Revises: f097f0553e29_add_test_conversations_table
Create Date: 2025-07-22 14:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_gemini_http_request_to_called_functions'
down_revision = 'f097f0553e29_add_test_conversations_table'
branch_labels = None
depends_on = None


def upgrade():
    # Add gemini_http_request column to called_functions table
    op.add_column('called_functions', sa.Column('gemini_http_request', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade():
    # Remove gemini_http_request column from called_functions table
    op.drop_column('called_functions', 'gemini_http_request')