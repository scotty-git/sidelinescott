"""Add custom function descriptions to function prompt templates

Revision ID: add_custom_function_descriptions
Revises: 166b10dcf984
Create Date: 2025-07-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_custom_function_descriptions'
down_revision = 'add_gemini_http_request_to_called_functions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add custom_function_descriptions JSON column to function_prompt_templates
    op.add_column('function_prompt_templates', 
        sa.Column('custom_function_descriptions', postgresql.JSONB(), nullable=True, server_default=sa.text("'{}'::jsonb"))
    )


def downgrade() -> None:
    # Remove custom_function_descriptions column
    op.drop_column('function_prompt_templates', 'custom_function_descriptions')