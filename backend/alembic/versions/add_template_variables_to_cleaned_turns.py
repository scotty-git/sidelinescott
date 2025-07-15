"""add template_variables to cleaned_turns

Revision ID: add_template_variables
Revises: 5a3b0677e77e
Create Date: 2025-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_template_variables'
down_revision = '5a3b0677e77e'
branch_labels = None
depends_on = None


def upgrade():
    # Add template_variables column to cleaned_turns table
    op.add_column('cleaned_turns', sa.Column('template_variables', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade():
    # Remove template_variables column from cleaned_turns table
    op.drop_column('cleaned_turns', 'template_variables')