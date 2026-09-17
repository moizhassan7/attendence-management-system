"""Add retry_count to device sync logs

Revision ID: d4e5f6a7b8c9
Revises: c1a2e3f4b5d6
Create Date: 2026-09-17 10:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c1a2e3f4b5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.add_column(
            "device_sync_logs",
            sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
        )
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_column("device_sync_logs", "retry_count")
    except Exception:
        pass
