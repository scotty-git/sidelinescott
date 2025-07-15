"""replace_is_active_with_is_default_in_prompt_templates

Revision ID: 8c7f2366fd83
Revises: 9e03476c50fb
Create Date: 2025-07-14 16:15:31.829915

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c7f2366fd83'
down_revision: Union[str, Sequence[str], None] = '9e03476c50fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Replace is_active with is_default column in prompt_templates table."""
    
    # Add the new is_default column as nullable first
    op.add_column('prompt_templates', sa.Column('is_default', sa.Boolean(), nullable=True))
    
    # Get a connection to execute SQL
    connection = op.get_bind()
    
    # Set all templates to is_default = false initially
    connection.execute(sa.text("""
        UPDATE prompt_templates SET is_default = false
    """))
    
    # Find the currently active template (if any) and make it the default
    result = connection.execute(sa.text("""
        SELECT id FROM prompt_templates WHERE is_active = true LIMIT 1
    """)).fetchone()
    
    if result:
        # Set the active template as default
        connection.execute(sa.text("""
            UPDATE prompt_templates SET is_default = true WHERE id = :template_id
        """), {"template_id": result[0]})
    else:
        # If no active template, make the first template (by creation date) the default
        first_template = connection.execute(sa.text("""
            SELECT id FROM prompt_templates ORDER BY created_at ASC LIMIT 1
        """)).fetchone()
        
        if first_template:
            connection.execute(sa.text("""
                UPDATE prompt_templates SET is_default = true WHERE id = :template_id
            """), {"template_id": first_template[0]})
    
    # Now make the column NOT NULL after setting values
    op.alter_column('prompt_templates', 'is_default', nullable=False)
    
    # Note: "Only one default" constraint will be enforced at application level
    # PostgreSQL doesn't support subqueries in CHECK constraints
    
    # Drop the old is_active column
    op.drop_column('prompt_templates', 'is_active')


def downgrade() -> None:
    """Revert back to is_active column."""
    
    # Add back the is_active column
    op.add_column('prompt_templates', sa.Column('is_active', sa.Boolean(), default=False, nullable=False))
    
    # Get a connection to execute SQL
    connection = op.get_bind()
    
    # Set the default template as active
    connection.execute(sa.text("""
        UPDATE prompt_templates SET is_active = true WHERE is_default = true
    """))
    
    # No constraint to drop (was enforced at application level)
    
    # Drop the is_default column
    op.drop_column('prompt_templates', 'is_default')
