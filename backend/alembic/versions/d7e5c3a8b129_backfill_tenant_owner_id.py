"""Backfill tenants.owner_id from the unique owner of historical contract houses.

Revision ID: d7e5c3a8b129
Revises: 4b1378866bba

This migration is PostgreSQL-specific. It leaves unlinked tenants with NULL
owner_id and stores a small audit of modified rows for a guarded downgrade.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d7e5c3a8b129"
down_revision: Union[str, Sequence[str], None] = "4b1378866bba"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

AUDIT_TABLE = "tenant_owner_backfill_audit_20261026"


def _scalar(connection, statement: str) -> int:
    return int(connection.execute(sa.text(statement)).scalar_one())


def _lock_source_tables(connection) -> None:
    # Prevent inconsistent owner inference if the application is writing at
    # the same time. Prefer running migrations during a maintenance window.
    connection.execute(sa.text(
        "LOCK TABLE public.tenants, public.contracts, public.rooms, "
        "public.user_house, public.users IN SHARE ROW EXCLUSIVE MODE"
    ))


def upgrade() -> None:
    conn = op.get_bind()
    _lock_source_tables(conn)

    # Fail closed if ANY contract has no usable Room -> House -> unique Owner.
    invalid_contracts = conn.execute(sa.text("""
        SELECT c.id
        FROM public.contracts c
        LEFT JOIN public.rooms r ON r.id = c.room_id
        LEFT JOIN public.user_house uh ON uh.house_id = r.house_id
        LEFT JOIN public.users u ON u.id = uh.user_id AND u.role = 'owner'
        GROUP BY c.id
        HAVING COUNT(DISTINCT u.id) <> 1
        LIMIT 10
    """)).scalars().all()
    if invalid_contracts:
        raise RuntimeError(
            "Backfill aborted: contracts with zero/multiple owners: "
            f"{invalid_contracts} (up to 10 shown)"
        )

    # A tenant must not have contracts belonging to different owners.
    ambiguous_tenants = conn.execute(sa.text("""
        SELECT c.tenant_id
        FROM public.contracts c
        JOIN public.rooms r ON r.id = c.room_id
        JOIN public.user_house uh ON uh.house_id = r.house_id
        JOIN public.users u ON u.id = uh.user_id AND u.role = 'owner'
        GROUP BY c.tenant_id
        HAVING COUNT(DISTINCT u.id) <> 1
        LIMIT 10
    """)).scalars().all()
    if ambiguous_tenants:
        raise RuntimeError(
            "Backfill aborted: tenants linked to multiple owners: "
            f"{ambiguous_tenants} (up to 10 shown)"
        )

    # Do not silently overwrite owners already assigned by the application.
    already_assigned_with_contract = _scalar(conn, """
        SELECT COUNT(*) FROM public.tenants t
        WHERE t.owner_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.tenant_id = t.id)
    """)
    if already_assigned_with_contract:
        raise RuntimeError(
            "Backfill aborted: some linked tenants already have owner_id. "
            "Inspect these records before retrying."
        )

    # The audit records EXACTLY which rows this migration owns, allowing a
    # downgrade that will not erase newly created/unrelated tenant records.
    op.create_table(
        AUDIT_TABLE,
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("assigned_owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        schema="public",
    )
    conn.execute(sa.text(f"""
        INSERT INTO public.{AUDIT_TABLE} (tenant_id, assigned_owner_id)
        SELECT c.tenant_id, MIN(u.id)
        FROM public.contracts c
        JOIN public.rooms r ON r.id = c.room_id
        JOIN public.user_house uh ON uh.house_id = r.house_id
        JOIN public.users u ON u.id = uh.user_id AND u.role = 'owner'
        JOIN public.tenants t ON t.id = c.tenant_id
        WHERE t.owner_id IS NULL
        GROUP BY c.tenant_id
        HAVING COUNT(DISTINCT u.id) = 1
    """))

    expected = _scalar(conn, f"SELECT COUNT(*) FROM public.{AUDIT_TABLE}")
    updated = conn.execute(sa.text(f"""
        UPDATE public.tenants AS t
        SET owner_id = a.assigned_owner_id
        FROM public.{AUDIT_TABLE} AS a
        WHERE t.id = a.tenant_id AND t.owner_id IS NULL
    """))
    if updated.rowcount != expected:
        raise RuntimeError(
            f"Backfill mismatch: expected {expected}, updated {updated.rowcount}. "
            "Transaction will roll back."
        )

    remaining_linked = _scalar(conn, """
        SELECT COUNT(*) FROM public.tenants t
        WHERE t.owner_id IS NULL
          AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.tenant_id = t.id)
    """)
    if remaining_linked:
        raise RuntimeError(
            f"Backfill incomplete: {remaining_linked} tenant(s) with contracts still unassigned."
        )
    print(f"Tenant owner backfill: assigned {expected} tenant(s); unlinked tenants unchanged.")


def downgrade() -> None:
    conn = op.get_bind()
    _lock_source_tables(conn)

    # Refuse downgrade if ownership changed since this migration; otherwise
    # resetting values would discard legitimate later changes.
    mismatched = conn.execute(sa.text(f"""
        SELECT a.tenant_id
        FROM public.{AUDIT_TABLE} a
        LEFT JOIN public.tenants t ON t.id = a.tenant_id
        WHERE t.id IS NULL OR t.owner_id IS DISTINCT FROM a.assigned_owner_id
        LIMIT 10
    """)).scalars().all()
    if mismatched:
        raise RuntimeError(
            "Downgrade refused: backfilled owners have since changed: "
            f"{mismatched}. Resolve manually; no data was modified."
        )

    expected = _scalar(conn, f"SELECT COUNT(*) FROM public.{AUDIT_TABLE}")
    cleared = conn.execute(sa.text(f"""
        UPDATE public.tenants t SET owner_id = NULL
        FROM public.{AUDIT_TABLE} a
        WHERE t.id = a.tenant_id AND t.owner_id = a.assigned_owner_id
    """))
    if cleared.rowcount != expected:
        raise RuntimeError("Downgrade update mismatch; transaction will roll back.")
    op.drop_table(AUDIT_TABLE, schema="public")
    print(f"Tenant owner backfill downgrade: cleared {expected} audited tenant(s).")
