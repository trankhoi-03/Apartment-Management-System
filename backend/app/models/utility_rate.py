from datetime import date
from sqlalchemy import ForeignKey, Numeric, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from .base import Base

if TYPE_CHECKING:
    from .room import Room


class UtilityRate(Base):
    __tablename__ = "utility_rates"

    id: Mapped[int] = mapped_column(primary_key=True)

    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="RESTRICT"), nullable=False
    )

    electric_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    water_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    default_water_amount: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )

    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    # Giá này áp dụng TỪ ngày này - khi giá Nhà nước/chủ trọ thay đổi,

    room: Mapped["Room"] = relationship(back_populates="utility_rates")