from sqlalchemy import ForeignKey, String, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from .base import Base

if TYPE_CHECKING:
    from .room import Room


class UtilityReading(Base):
    __tablename__ = "utility_readings"
    __table_args__ = (
        UniqueConstraint("room_id", "billing_month", name="uq_room_month"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="RESTRICT"), nullable=False
    )

    billing_month: Mapped[str] = mapped_column(String(7), nullable=False)

    electric_old: Mapped[float] = mapped_column(Float, nullable=False)
    electric_new: Mapped[float] = mapped_column(Float, nullable=False)
    water_old: Mapped[float] = mapped_column(Float, nullable=False)
    water_new: Mapped[float] = mapped_column(Float, nullable=False)

    room: Mapped["Room"] = relationship(back_populates="utility_readings")