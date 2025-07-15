"""merge_variable_history_changes

Revision ID: c00f774c8cc4
Revises: 5b3c0677e88f, add_user_variable_history
Create Date: 2025-07-15 17:45:43.011005

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c00f774c8cc4'
down_revision: Union[str, Sequence[str], None] = ('5b3c0677e88f', 'add_user_variable_history')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
