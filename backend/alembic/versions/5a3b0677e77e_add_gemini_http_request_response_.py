"""Add gemini HTTP request response columns to cleaned_turns

Revision ID: 5a3b0677e77e
Revises: f41ecfe016fe
Create Date: 2025-07-15 14:15:41.737489

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a3b0677e77e'
down_revision: Union[str, Sequence[str], None] = '840f63691b95'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add HTTP request/response columns to cleaned_turns table
    op.add_column('cleaned_turns', sa.Column('gemini_http_request', sa.JSON(), nullable=True))
    op.add_column('cleaned_turns', sa.Column('gemini_http_response', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove HTTP request/response columns from cleaned_turns table
    op.drop_column('cleaned_turns', 'gemini_http_response')
    op.drop_column('cleaned_turns', 'gemini_http_request')
