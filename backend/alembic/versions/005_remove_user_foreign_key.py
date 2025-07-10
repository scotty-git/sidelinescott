"""Remove foreign key constraint from conversations to users table

Revision ID: 005_remove_user_fk
Revises: 004_add_prompt_engineering_tables
Create Date: 2025-07-09 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005_remove_user_fk'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove foreign key constraint from conversations.user_id to users.id"""
    
    # First, check if the foreign key constraint exists and remove it
    op.execute("""
        DO $$ 
        BEGIN
            -- Check if the foreign key constraint exists
            IF EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints 
                WHERE constraint_name = 'conversations_user_id_fkey' 
                AND table_name = 'conversations'
            ) THEN
                -- Drop the foreign key constraint
                ALTER TABLE conversations DROP CONSTRAINT conversations_user_id_fkey;
            END IF;
        END $$;
    """)
    
    # Add comment to document that user_id references Supabase Auth users
    op.execute("""
        COMMENT ON COLUMN conversations.user_id IS 'References Supabase Auth user ID (auth.users.id)';
    """)


def downgrade() -> None:
    """Restore foreign key constraint (note: this assumes users table exists)"""
    
    # Note: This downgrade will only work if the users table still exists
    # and contains the referenced user IDs
    op.execute("""
        DO $$ 
        BEGIN
            -- Only add the constraint if the users table exists
            IF EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_name = 'users'
            ) THEN
                -- Add back the foreign key constraint
                ALTER TABLE conversations 
                ADD CONSTRAINT conversations_user_id_fkey 
                FOREIGN KEY (user_id) REFERENCES users(id);
            END IF;
        END $$;
    """)
    
    # Remove the comment
    op.execute("""
        COMMENT ON COLUMN conversations.user_id IS NULL;
    """)