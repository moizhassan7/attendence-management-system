"""Add preferred_transport to devices

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-17 10:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.add_column(
            "devices",
            sa.Column("preferred_transport", sa.String(length=10), server_default="auto", nullable=False),
        )
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_column("devices", "preferred_transport")
    except Exception:
        pass
