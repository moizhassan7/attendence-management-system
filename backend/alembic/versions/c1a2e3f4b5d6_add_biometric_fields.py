"""Add biometric fields to personnel

Revision ID: c1a2e3f4b5d6
Revises: b8fd22b7ba2b
Create Date: 2026-09-12 22:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2e3f4b5d6'
down_revision: Union[str, None] = 'b8fd22b7ba2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Handle safe addition
    try:
        op.add_column('personnel', sa.Column('has_fingerprint', sa.Boolean(), server_default='0', nullable=False))
    except Exception:
        pass
    try:
        op.add_column('personnel', sa.Column('has_face', sa.Boolean(), server_default='0', nullable=False))
    except Exception:
        pass


def downgrade() -> None:
    op.drop_column('personnel', 'has_face')
    op.drop_column('personnel', 'has_fingerprint')
