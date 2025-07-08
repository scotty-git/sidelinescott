"""Add prompt engineering tables

Revision ID: 004
Revises: 003
Create Date: 2025-01-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Create prompt_templates table
    op.create_table('prompt_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('template', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('variables', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create prompt_usage table
    op.create_table('prompt_usage',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('template_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('turn_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('rendered_prompt', sa.Text(), nullable=False),
        sa.Column('variables_used', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('token_count', sa.Integer(), nullable=True),
        sa.Column('processing_time_ms', sa.Float(), nullable=True),
        sa.Column('confidence_score', sa.String(length=10), nullable=True),
        sa.Column('corrections_count', sa.Integer(), nullable=True),
        sa.Column('context_turns_used', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create ab_tests table
    op.create_table('ab_tests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('prompt_a_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prompt_b_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('traffic_split_percent', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create ab_test_results table
    op.create_table('ab_test_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('test_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prompt_variant', sa.String(length=1), nullable=False),
        sa.Column('turn_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('processing_time_ms', sa.Float(), nullable=True),
        sa.Column('confidence_score', sa.String(length=10), nullable=True),
        sa.Column('corrections_count', sa.Integer(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('ab_test_results')
    op.drop_table('ab_tests')
    op.drop_table('prompt_usage')
    op.drop_table('prompt_templates')