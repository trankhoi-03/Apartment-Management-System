"""add user_id to prevent tags data leakage

Revision ID: e07ba29cf125
Revises: ea698fd8387a
Create Date: 2026-10-01 20:28:32.388914
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e07ba29cf125"
down_revision: Union[str, Sequence[str], None] = "ea698fd8387a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------------------------------------------------------
    # 1. Make sure the database has at least one user.
    # ---------------------------------------------------------
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM users) THEN
                    RAISE EXCEPTION
                        'Cannot migrate tags: users table is empty';
                END IF;
            END $$;
            """
        )
    )

    # ---------------------------------------------------------
    # 2. Remove case-insensitive duplicate tags.
    #
    # Example:
    #   "Máy lạnh" and "máy lạnh"
    #
    # Keep the tag with the smallest ID.
    # ---------------------------------------------------------
    op.execute(
        sa.text(
            """
            DELETE FROM tags t
            USING tags duplicate
            WHERE t.id > duplicate.id
              AND LOWER(t.name) = LOWER(duplicate.name)
              AND t.type = duplicate.type;
            """
        )
    )

    # ---------------------------------------------------------
    # 3. Remove the old global unique constraint on name.
    #
    # The old model had:
    #     name = mapped_column(..., unique=True)
    #
    # After data isolation, uniqueness must be scoped to user.
    # ---------------------------------------------------------
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    unique_constraints = inspector.get_unique_constraints("tags")

    for constraint in unique_constraints:
        columns = constraint.get("column_names", [])

        if columns == ["name"]:
            constraint_name = constraint.get("name")

            if constraint_name:
                op.drop_constraint(
                    constraint_name,
                    "tags",
                    type_="unique",
                )

    # ---------------------------------------------------------
    # 4. Add user_id temporarily as nullable.
    #
    # Existing rows need to be populated before NOT NULL.
    # ---------------------------------------------------------
    op.add_column(
        "tags",
        sa.Column(
            "user_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    # ---------------------------------------------------------
    # 5. Assign all existing tags to the first user.
    #
    # The old schema had no owner information, so ownership
    # cannot be reconstructed from the existing tags.
    #
    # We preserve the existing tag IDs by assigning them to
    # the first existing user.
    # ---------------------------------------------------------
    op.execute(
        sa.text(
            """
            UPDATE tags
            SET user_id = (
                SELECT id
                FROM users
                ORDER BY id
                LIMIT 1
            )
            WHERE user_id IS NULL;
            """
        )
    )

    # ---------------------------------------------------------
    # 6. Clone the existing tags for every other user.
    #
    # Because rooms currently store tag names rather than
    # tag IDs, creating new tag IDs does not break room data.
    # ---------------------------------------------------------
    op.execute(
        sa.text(
            """
            INSERT INTO tags (user_id, name, type)
            SELECT
                u.id,
                t.name,
                t.type
            FROM users u
            CROSS JOIN tags t
            WHERE NOT EXISTS (
                SELECT 1
                FROM tags existing
                WHERE existing.user_id = u.id
                  AND LOWER(existing.name) = LOWER(t.name)
                  AND existing.type = t.type
            );
            """
        )
    )

    # ---------------------------------------------------------
    # 7. user_id must now be mandatory.
    # ---------------------------------------------------------
    op.alter_column(
        "tags",
        "user_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # ---------------------------------------------------------
    # 8. Create FK:
    #
    # tags.user_id -> users.id
    #
    # CASCADE means deleting a user also deletes that user's
    # private tags.
    # ---------------------------------------------------------
    op.create_foreign_key(
        "fk_tags_user_id_users",
        "tags",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # ---------------------------------------------------------
    # 9. Enforce per-user, case-insensitive uniqueness.
    #
    # Same tag:
    #   User A -> Máy lạnh
    #   User B -> Máy lạnh
    #
    # is allowed.
    #
    # But:
    #   User A -> Máy lạnh
    #   User A -> máy lạnh
    #
    # is NOT allowed for the same type.
    # ---------------------------------------------------------
    op.create_index(
        "uq_tags_user_lower_name_type",
        "tags",
        [
            "user_id",
            sa.text("LOWER(name)"),
            "type",
        ],
        unique=True,
    )


def downgrade() -> None:
    # Remove the new user-scoped uniqueness rule.
    op.drop_index(
        "uq_tags_user_lower_name_type",
        table_name="tags",
    )

    # Remove FK.
    op.drop_constraint(
        "fk_tags_user_id_users",
        "tags",
        type_="foreignkey",
    )

    # Remove user ownership.
    op.drop_column(
        "tags",
        "user_id",
    )

    # Restore the old global unique constraint.
    op.create_unique_constraint(
        "tags_name_key",
        "tags",
        ["name"],
    )