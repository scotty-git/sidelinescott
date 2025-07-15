"""add_unique_default_constraint_to_prompt_templates

Revision ID: 840f63691b95
Revises: 8c7f2366fd83
Create Date: 2025-07-14 17:17:57.843462

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '840f63691b95'
down_revision: Union[str, Sequence[str], None] = '8c7f2366fd83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add unique constraint to ensure only one default prompt template."""
    
    # Create a unique partial index to ensure only one is_default = true at a time
    # This is the standard PostgreSQL approach for this type of constraint
    op.create_index(
        'idx_prompt_templates_unique_default',
        'prompt_templates',
        ['is_default'],
        unique=True,
        postgresql_where=sa.text('is_default = true')
    )
    
    # Ensure we have at least one default template
    # This will be enforced at application level since we can't use
    # subqueries in CHECK constraints
    connection = op.get_bind()
    
    # Check if we have any default templates
    result = connection.execute(sa.text("""
        SELECT COUNT(*) FROM prompt_templates WHERE is_default = true
    """)).fetchone()
    
    if result[0] == 0:
        # Set the first template as default if no default exists
        connection.execute(sa.text("""
            UPDATE prompt_templates 
            SET is_default = true 
            WHERE id = (
                SELECT id FROM prompt_templates 
                ORDER BY created_at ASC 
                LIMIT 1
            )
        """))


def downgrade() -> None:
    """Remove unique constraint from prompt templates."""
    
    # Drop the unique partial index
    op.drop_index('idx_prompt_templates_unique_default', 'prompt_templates')
