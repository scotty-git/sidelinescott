"""Add business_insights field to mirrored_mock_customers

Revision ID: add_business_insights_field
Revises: add_mock_customers_tables
Create Date: 2024-07-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_business_insights_field'
down_revision = 'add_mock_customers_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Add business_insights column to mirrored_mock_customers table
    op.add_column('mirrored_mock_customers', 
                  sa.Column('business_insights', sa.JSON(), nullable=True))


def downgrade():
    # Remove business_insights column
    op.drop_column('mirrored_mock_customers', 'business_insights')