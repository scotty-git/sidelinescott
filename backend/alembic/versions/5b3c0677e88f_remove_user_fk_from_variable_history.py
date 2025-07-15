"""remove user fk from variable history

Revision ID: 5b3c0677e88f
Revises: 5a3b0677e77e
Create Date: 2025-01-15 13:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '5b3c0677e88f'
down_revision = '5a3b0677e77e'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the foreign key constraint from user_variable_history
    try:
        op.drop_constraint('user_variable_history_user_id_fkey', 'user_variable_history', type_='foreignkey')
    except Exception as e:
        # Constraint might not exist or have a different name
        print(f"Could not drop foreign key constraint: {e}")


def downgrade():
    # Note: We can't easily re-add the constraint without ensuring the users table exists
    pass