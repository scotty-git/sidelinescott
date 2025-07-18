"""Add mock_customers and mirrored_mock_customers tables

Revision ID: add_mock_customers_tables
Revises: add_called_functions_table
Create Date: 2024-07-18 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_mock_customers_tables'
down_revision = 'add_called_functions_table'
branch_labels = None
depends_on = None


def upgrade():
    # Create mock_customers table
    op.create_table('mock_customers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_name', sa.String(length=255), nullable=False),
        sa.Column('job_title', sa.String(length=255), nullable=False),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('company_description', sa.Text(), nullable=False),
        sa.Column('company_size', sa.String(length=100), nullable=False),
        sa.Column('company_sector', sa.String(length=255), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Set default value for is_default column
    op.alter_column('mock_customers', 'is_default', server_default=sa.text('false'))
    
    # Create mirrored_mock_customers table
    op.create_table('mirrored_mock_customers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('evaluation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('original_customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_name', sa.String(length=255), nullable=False),
        sa.Column('job_title', sa.String(length=255), nullable=False),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('company_description', sa.Text(), nullable=False),
        sa.Column('company_size', sa.String(length=100), nullable=False),
        sa.Column('company_sector', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['evaluation_id'], ['evaluations.id'], ),
        sa.ForeignKeyConstraint(['original_customer_id'], ['mock_customers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for efficient querying
    op.create_index('idx_mock_customers_is_default', 'mock_customers', ['is_default'])
    op.create_index('idx_mirrored_mock_customers_evaluation', 'mirrored_mock_customers', ['evaluation_id'])
    op.create_index('idx_mirrored_mock_customers_original', 'mirrored_mock_customers', ['original_customer_id'])
    
    # Insert default Scott customer
    op.execute("""
        INSERT INTO mock_customers (
            id, user_name, job_title, company_name, company_description, 
            company_size, company_sector, is_default, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            'Scott',
            'Head of Marketing',
            'Quick Fit Windows',
            'A company specializing in efficient window installations and repairs, known for quick turnaround times and high-quality service. We serve residential and small commercial properties with custom window solutions.',
            '20 to 50 people',
            'window repairs',
            true,
            NOW(),
            NOW()
        )
    """)


def downgrade():
    # Drop the indexes
    op.drop_index('idx_mirrored_mock_customers_original', table_name='mirrored_mock_customers')
    op.drop_index('idx_mirrored_mock_customers_evaluation', table_name='mirrored_mock_customers')
    op.drop_index('idx_mock_customers_is_default', table_name='mock_customers')
    
    # Drop the tables
    op.drop_table('mirrored_mock_customers')
    op.drop_table('mock_customers')