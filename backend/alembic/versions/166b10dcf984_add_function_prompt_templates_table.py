"""add_function_prompt_templates_table

Revision ID: 166b10dcf984
Revises: c00f774c8cc4
Create Date: 2025-07-18 12:27:44.438017

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '166b10dcf984'
down_revision: Union[str, Sequence[str], None] = 'c00f774c8cc4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create function_prompt_templates table
    op.create_table('function_prompt_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('template', sa.Text(), nullable=False),
        sa.Column('variables', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('version', sa.String(length=50), nullable=False, server_default=sa.text("'1.0.0'")),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # Create unique index to ensure only one default template
    op.create_index(
        'idx_function_prompt_templates_unique_default',
        'function_prompt_templates',
        ['is_default'],
        unique=True,
        postgresql_where=sa.text('is_default = true')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_function_prompt_templates_unique_default', 'function_prompt_templates')
    op.drop_table('function_prompt_templates')
