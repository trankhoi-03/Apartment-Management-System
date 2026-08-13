from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from .base import Base

if TYPE_CHECKING:
    from .room import Room


class House(Base):
    __tablename__ = "houses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contract_template: Mapped[str | None] = mapped_column(Text, nullable=True)

    theme_color: Mapped[str] = mapped_column(String(7), default="#3B82F6")
    rooms: Mapped[list["Room"]] = relationship(back_populates="house")