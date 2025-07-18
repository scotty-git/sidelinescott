"""Add called_functions table for function calling evaluations

Revision ID: add_called_functions_table
Revises: 166b10dcf984
Create Date: 2024-07-18 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_called_functions_table'
down_revision = '166b10dcf984'
branch_labels = None
depends_on = None


def upgrade():
    # Create called_functions table
    op.create_table('called_functions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('evaluation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('turn_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('function_name', sa.String(length=100), nullable=False),
        sa.Column('parameters', sa.JSON(), nullable=False),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('executed', sa.Boolean(), nullable=False),
        sa.Column('confidence_score', sa.String(length=10), nullable=True),
        sa.Column('decision_reasoning', sa.Text(), nullable=True),
        sa.Column('processing_time_ms', sa.Float(), nullable=False),
        sa.Column('timing_breakdown', sa.JSON(), nullable=True),
        sa.Column('function_template_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('gemini_prompt', sa.Text(), nullable=True),
        sa.Column('gemini_response', sa.Text(), nullable=True),
        sa.Column('template_variables', sa.JSON(), nullable=True),
        sa.Column('mock_data_before', sa.JSON(), nullable=True),
        sa.Column('mock_data_after', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['evaluation_id'], ['evaluations.id'], ),
        sa.ForeignKeyConstraint(['function_template_id'], ['function_prompt_templates.id'], ),
        sa.ForeignKeyConstraint(['turn_id'], ['turns.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index for efficient querying
    op.create_index('idx_called_functions_evaluation_turn', 'called_functions', ['evaluation_id', 'turn_id'])
    
    # Set default value for executed column
    op.alter_column('called_functions', 'executed', server_default=sa.text('true'))


def downgrade():
    # Drop the index
    op.drop_index('idx_called_functions_evaluation_turn', table_name='called_functions')
    
    # Drop the table
    op.drop_table('called_functions')