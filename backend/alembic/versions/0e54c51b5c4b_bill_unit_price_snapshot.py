"""bill unit price snapshot

Revision ID: 0e54c51b5c4b
Revises: d7e5c3a8b129
Create Date: 2026-10-29 22:02:42.722658

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e54c51b5c4b'
down_revision: Union[str, Sequence[str], None] = 'd7e5c3a8b129'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bills", sa.Column("electric_unit_price", sa.Numeric(12, 2), nullable=True))
    op.add_column("bills", sa.Column("water_unit_price", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("bills", "water_unit_price")
    op.drop_column("bills", "electric_unit_price")