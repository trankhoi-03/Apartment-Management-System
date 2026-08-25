"""Add handler_info to incidents

Revision ID: ac7dca694404
Revises: 65c6597a3969
Create Date: 2026-08-24 21:44:17.728248

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ac7dca694404'
down_revision: Union[str, Sequence[str], None] = '65c6597a3969'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('incidents', sa.Column('handler_info', sa.String(length=255), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('incidents', 'handler_info')
    # ### end Alembic commands ###
