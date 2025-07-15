"""add user_variable_history table

Revision ID: add_user_variable_history
Revises: add_template_variables
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_user_variable_history'
down_revision = 'add_template_variables'
branch_labels = None
depends_on = None


def upgrade():
    # Create user_variable_history table
    op.create_table(
        'user_variable_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('variable_name', sa.String(100), nullable=False),
        sa.Column('variable_value', sa.Text(), nullable=False),
        sa.Column('used_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('user_id', 'variable_name', 'variable_value', name='uq_user_variable_value')
    )
    
    # Add index for efficient querying
    op.create_index('idx_user_variable_history_user_var', 'user_variable_history', ['user_id', 'variable_name', 'used_at'])


def downgrade():
    # Drop table and index
    op.drop_index('idx_user_variable_history_user_var', table_name='user_variable_history')
    op.drop_table('user_variable_history')