"""add sort_order to watchlist

Revision ID: a1b2c3d4e5f6
Revises: 67b3d2da0aef
Create Date: 2026-03-05 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '67b3d2da0aef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add sort_order column with default 0
    op.add_column('watchlist', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))

    # Backfill existing rows: preserve current display order (added_at DESC)
    op.execute("""
        UPDATE watchlist AS w
        SET sort_order = sub.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY added_at DESC) - 1 AS rn
            FROM watchlist
        ) AS sub
        WHERE w.id = sub.id
    """)


def downgrade() -> None:
    op.drop_column('watchlist', 'sort_order')
