from sqlalchemy import String, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Tag(Base):
    __tablename__ = "tags"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False,)
    id: Mapped[int] = mapped_column(primary_key=True,)
    name: Mapped[str] = mapped_column(String(100), nullable=False,)
    type: Mapped[str] = mapped_column(String(50), nullable=False,)

    __table_args__ = (
        Index(
            "uq_tags_user_lower_name_type",
            "user_id",
            func.lower(name),
            "type",
            unique=True,
        ),
    )